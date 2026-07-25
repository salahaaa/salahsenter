using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SalahCenter.LocalSyncAgent.Configuration;
using SalahCenter.LocalSyncAgent.Connectors;
using SalahCenter.LocalSyncAgent.Models;
using SalahCenter.LocalSyncAgent.Storage;

namespace SalahCenter.LocalSyncAgent.Sync;

/** Offline-safe orchestration: drain durable outbox, pull platform work, apply locally, then acknowledge. */
public sealed class SyncWorker(
    ILogger<SyncWorker> logger,
    IOptions<AgentOptions> options,
    ILocalConnector connector,
    LocalStateDb stateDb,
    PlatformApiClient apiClient) : BackgroundService
{
    private readonly AgentOptions _options = options.Value;
    private readonly string _deviceId = CreateDeviceId();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await stateDb.InitializeAsync(stoppingToken);
        logger.LogInformation("Starting Salah Center Local Sync Agent. DeviceId={DeviceId}, Connector={Connector}", _deviceId, connector.ConnectorType);
        await RetryAsync(() => apiClient.RegisterAsync(_deviceId, stoppingToken), stoppingToken);

        var lastHeartbeat = DateTimeOffset.MinValue;
        var lastProducts = DateTimeOffset.MinValue;
        var lastInventory = DateTimeOffset.MinValue;
        var lastOrdersPull = DateTimeOffset.MinValue;
        var lastEventsPull = DateTimeOffset.MinValue;

        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTimeOffset.UtcNow;
            try
            {
                await DrainOutboxAsync(stoppingToken);
                await ProcessInboxAsync(stoppingToken);

                if ((now - lastHeartbeat).TotalSeconds >= _options.HeartbeatSeconds)
                {
                    var counts = await stateDb.GetHealthCountsAsync(stoppingToken);
                    await apiClient.HeartbeatAsync(_deviceId, counts.PendingOutbox, counts.FailedItems, stoppingToken);
                    lastHeartbeat = now;
                }
                if (_options.EnableProductPush && (now - lastProducts).TotalSeconds >= _options.ProductsPushSeconds) { await PushProductsAsync(stoppingToken); lastProducts = now; }
                if ((now - lastInventory).TotalSeconds >= _options.InventoryPushSeconds) { await PushInventoryAsync(stoppingToken); lastInventory = now; }
                if (_options.EnableOrdersPull && (now - lastOrdersPull).TotalSeconds >= _options.OrdersPullSeconds) { await PullOrdersAsync(stoppingToken); lastOrdersPull = now; }
                if (_options.EnableEventsPull && (now - lastEventsPull).TotalSeconds >= _options.EventsPullSeconds) { await PullEventsAsync(stoppingToken); lastEventsPull = now; }
            }
            catch (Exception ex) { logger.LogError(ex, "Sync loop failed; durable outbox/inbox items remain for retry."); }
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }

    private async Task DrainOutboxAsync(CancellationToken cancellationToken)
    {
        foreach (var item in await stateDb.GetDueOutboxAsync(_options.BatchSize, cancellationToken))
        {
            try { await apiClient.PushOutboxAsync(item.Resource, item.Payload, item.IdempotencyKey, cancellationToken); await stateDb.MarkOutboxProcessedAsync(item.Id, cancellationToken); }
            catch (Exception ex) { await stateDb.MarkOutboxRetryAsync(item, ex.Message, _options.MaxOutboxAttempts, cancellationToken); logger.LogWarning(ex, "Outbox item {Id} will retry", item.Id); }
        }
    }

    private async Task ProcessInboxAsync(CancellationToken cancellationToken)
    {
        var acknowledgedEvents = new List<string>();
        foreach (var item in await stateDb.GetDueInboxAsync(_options.BatchSize, cancellationToken))
        {
            try
            {
                if (item.EventType == "platform.order")
                {
                    var order = JsonSerializer.Deserialize<PlatformOrderDto>(item.Payload) ?? throw new InvalidOperationException("Invalid platform order payload");
                    await connector.ApplyPlatformOrderAsync(order, cancellationToken);
                }
                else if (item.EventType == "platform.event")
                {
                    var platformEvent = JsonSerializer.Deserialize<PlatformEventDto>(item.Payload) ?? throw new InvalidOperationException("Invalid platform event payload");
                    await connector.ApplyPlatformEventAsync(platformEvent, cancellationToken);
                    acknowledgedEvents.Add(platformEvent.Id);
                }
                else throw new InvalidOperationException($"Unsupported inbox event type {item.EventType}");
                await stateDb.MarkInboxProcessedAsync(item.Id, cancellationToken);
            }
            catch (Exception ex) { await stateDb.MarkInboxRetryAsync(item, ex.Message, _options.MaxOutboxAttempts, cancellationToken); logger.LogWarning(ex, "Inbox item {Id} will retry", item.Id); }
        }
        if (acknowledgedEvents.Any()) await apiClient.AckEventsAsync(acknowledgedEvents, "processed", null, cancellationToken);
    }

    private async Task PullOrdersAsync(CancellationToken cancellationToken)
    {
        var checkpoint = await stateDb.GetCheckpointAsync("orders_pull", cancellationToken);
        var page = await apiClient.PullOrdersAsync(checkpoint == DateTimeOffset.UnixEpoch ? null : checkpoint.ToString("O"), _options.BatchSize, cancellationToken);
        foreach (var order in page.Data) await stateDb.EnqueueInboxAsync($"order:{order.OrderId}", "platform.order", JsonSerializer.Serialize(order), cancellationToken);
        if (page.Data.Any()) await stateDb.SetCheckpointAsync("orders_pull", page.Data.Max(order => order.UpdatedAt), page.PageInfo.NextCursor, cancellationToken);
        logger.LogInformation("Pulled {Count} platform orders", page.Data.Count);
    }

    private async Task PullEventsAsync(CancellationToken cancellationToken)
    {
        var checkpoint = await stateDb.GetCheckpointAsync("events_pull", cancellationToken);
        var page = await apiClient.PullEventsAsync(checkpoint == DateTimeOffset.UnixEpoch ? null : checkpoint.ToString("O"), _options.BatchSize, cancellationToken);
        foreach (var platformEvent in page.Data) await stateDb.EnqueueInboxAsync($"event:{platformEvent.Id}", "platform.event", JsonSerializer.Serialize(platformEvent), cancellationToken);
        if (page.Data.Any()) await stateDb.SetCheckpointAsync("events_pull", page.Data.Max(platformEvent => platformEvent.CreatedAt), page.PageInfo.NextCursor, cancellationToken);
        logger.LogInformation("Pulled {Count} platform events", page.Data.Count);
    }

    private async Task PushProductsAsync(CancellationToken cancellationToken)
    {
        var since = await stateDb.GetCheckpointAsync("products", cancellationToken); var rows = await connector.ReadChangedProductsAsync(since, _options.BatchSize, cancellationToken);
        if (!rows.Any()) return;
        var idempotencyKey = $"{_options.ClientKey}:{_options.StoreId}:products:{DateTimeOffset.UtcNow:yyyyMMddHHmmss}"; var runId = await apiClient.StartSyncRunAsync("products", "local_to_platform", _deviceId, since.ToString("O"), cancellationToken);
        try { var outboxId = await stateDb.EnqueueOutboxAsync("products", rows, idempotencyKey, cancellationToken); await apiClient.PushProductsAsync(rows, idempotencyKey, cancellationToken); await stateDb.MarkOutboxProcessedAsync(outboxId, cancellationToken); await stateDb.SetCheckpointAsync("products", rows.Max(x => x.UpdatedAt), null, cancellationToken); await apiClient.FinishSyncRunAsync(runId, "completed", rows.Count, rows.Max(x => x.UpdatedAt).ToString("O"), null, cancellationToken); }
        catch (Exception ex) { await apiClient.FinishSyncRunAsync(runId, "failed", 0, since.ToString("O"), ex.Message, cancellationToken); throw; }
    }

    private async Task PushInventoryAsync(CancellationToken cancellationToken)
    {
        var since = await stateDb.GetCheckpointAsync("inventory", cancellationToken); var rows = await connector.ReadChangedInventoryAsync(since, _options.BatchSize, cancellationToken);
        if (!rows.Any()) return;
        var idempotencyKey = $"{_options.ClientKey}:{_options.StoreId}:inventory:{DateTimeOffset.UtcNow:yyyyMMddHHmmss}"; var runId = await apiClient.StartSyncRunAsync("inventory", "local_to_platform", _deviceId, since.ToString("O"), cancellationToken);
        try { var outboxId = await stateDb.EnqueueOutboxAsync("inventory", rows, idempotencyKey, cancellationToken); await apiClient.PushInventoryAsync(rows, idempotencyKey, cancellationToken); await stateDb.MarkOutboxProcessedAsync(outboxId, cancellationToken); await stateDb.SetCheckpointAsync("inventory", rows.Max(x => x.UpdatedAt), null, cancellationToken); await apiClient.FinishSyncRunAsync(runId, "completed", rows.Count, rows.Max(x => x.UpdatedAt).ToString("O"), null, cancellationToken); }
        catch (Exception ex) { await apiClient.FinishSyncRunAsync(runId, "failed", 0, since.ToString("O"), ex.Message, cancellationToken); throw; }
    }

    private async Task RetryAsync(Func<Task> action, CancellationToken cancellationToken)
    {
        var delays = new[] { 2, 5, 15, 30 };
        for (var attempt = 0; ; attempt++) { try { await action(); return; } catch when (attempt < delays.Length && !cancellationToken.IsCancellationRequested) { await Task.Delay(TimeSpan.FromSeconds(delays[attempt]), cancellationToken); } }
    }

    private static string CreateDeviceId()
    {
        var raw = $"{Environment.MachineName}|{Environment.UserName}|{Environment.OSVersion.Platform}";
        return Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(raw))).ToLowerInvariant()[..32];
    }
}
