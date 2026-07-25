using Microsoft.Extensions.Options;
using SalahCenter.LocalSyncAgent.Configuration;
using SalahCenter.LocalSyncAgent.Models;
using SalahCenter.LocalSyncAgent.Security;
using System.Net.Http.Json;

namespace SalahCenter.LocalSyncAgent.Sync;

public sealed class PlatformApiClient(HttpClient httpClient, IOptions<AgentOptions> options, AgentSecretProvider secrets)
{
    private readonly AgentOptions _options = options.Value;
    private readonly AgentSecretProvider _secrets = secrets;

    private HttpRequestMessage Request(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _secrets.GetApiKey());
        request.Headers.TryAddWithoutValidation("x-integration-client-id", _options.ClientKey);
        return request;
    }

    public async Task<bool> HealthAsync(CancellationToken cancellationToken)
    {
        using var request = Request(HttpMethod.Get, "/api/integrations/health");
        using var response = await httpClient.SendAsync(request, cancellationToken);
        return response.IsSuccessStatusCode;
    }

    public async Task RegisterAsync(string deviceId, CancellationToken cancellationToken)
    {
        using var request = Request(HttpMethod.Post, "/api/integrations/agents/register");
        request.Content = JsonContent.Create(new
        {
            deviceId,
            deviceName = _options.DeviceName,
            storeId = _options.StoreId,
            agentVersion = typeof(PlatformApiClient).Assembly.GetName().Version?.ToString() ?? "0.1.0",
            os = Environment.OSVersion.ToString(),
            connectorType = _options.ConnectorType,
            capabilities = new { products = true, inventory = true, orders = true, events = true }
        });
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    public async Task HeartbeatAsync(string deviceId, int pendingOutbox, int failedItems, CancellationToken cancellationToken)
    {
        using var request = Request(HttpMethod.Post, "/api/integrations/agents/heartbeat");
        request.Content = JsonContent.Create(new
        {
            deviceId,
            deviceName = _options.DeviceName,
            storeId = _options.StoreId,
            agentVersion = typeof(PlatformApiClient).Assembly.GetName().Version?.ToString() ?? "0.1.0",
            os = Environment.OSVersion.ToString(),
            connectorType = _options.ConnectorType,
            connectorStatus = "ok",
            pendingOutbox,
            failedItems,
            currentOperation = "sync-loop"
        });
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    public async Task<string?> StartSyncRunAsync(string resource, string direction, string deviceId, string? checkpoint, CancellationToken cancellationToken)
    {
        using var request = Request(HttpMethod.Post, "/api/integrations/sync-runs");
        request.Content = JsonContent.Create(new { action = "start", deviceId, storeId = _options.StoreId, resource, direction, checkpoint });
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<PlatformResponse<Dictionary<string, object>>>(cancellationToken: cancellationToken);
        return body?.Data != null && body.Data.TryGetValue("runId", out var runId) ? Convert.ToString(runId) : null;
    }

    public async Task FinishSyncRunAsync(string? runId, string status, int count, string? checkpoint, string? error, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(runId)) return;
        using var request = Request(HttpMethod.Post, "/api/integrations/sync-runs");
        request.Content = JsonContent.Create(new { action = "finish", runId, status, counters = new { count }, checkpoint, error });
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    public async Task PushProductsAsync(IReadOnlyList<ProductSyncDto> items, string idempotencyKey, CancellationToken cancellationToken)
    {
        if (!items.Any()) return;
        using var request = Request(HttpMethod.Post, "/api/integrations/products");
        request.Content = JsonContent.Create(new PushEnvelope<ProductSyncDto>
        {
            StoreId = _options.StoreId,
            SourceSystem = _options.ConnectorType,
            SourceType = _options.ConnectorType,
            BatchId = idempotencyKey,
            IdempotencyKey = idempotencyKey,
            Items = items
        });
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    public async Task<PullPage<PlatformOrderDto>> PullOrdersAsync(string? checkpoint, int limit, CancellationToken cancellationToken)
    {
        var path = $"/api/integrations/orders?storeId={Uri.EscapeDataString(_options.StoreId)}&limit={limit}";
        if (!string.IsNullOrWhiteSpace(checkpoint)) path += $"&cursor={Uri.EscapeDataString(checkpoint)}";
        using var request = Request(HttpMethod.Get, path);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<PlatformResponse<PullPage<PlatformOrderDto>>>(cancellationToken: cancellationToken);
        return body?.Data ?? new PullPage<PlatformOrderDto>();
    }

    public async Task<PullPage<PlatformEventDto>> PullEventsAsync(string? checkpoint, int limit, CancellationToken cancellationToken)
    {
        var path = $"/api/integrations/events?storeId={Uri.EscapeDataString(_options.StoreId)}&limit={limit}&status=pending";
        if (!string.IsNullOrWhiteSpace(checkpoint)) path += $"&cursor={Uri.EscapeDataString(checkpoint)}";
        using var request = Request(HttpMethod.Get, path);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<PlatformResponse<PullPage<PlatformEventDto>>>(cancellationToken: cancellationToken);
        return body?.Data ?? new PullPage<PlatformEventDto>();
    }

    public async Task AckEventsAsync(IReadOnlyList<string> eventIds, string status, string? error, CancellationToken cancellationToken)
    {
        if (!eventIds.Any()) return;
        using var request = Request(HttpMethod.Post, "/api/integrations/events/ack");
        request.Content = JsonContent.Create(new { eventIds, status, error, agentBatchId = Guid.NewGuid().ToString("N") });
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    public async Task PushOutboxAsync(string resource, string payloadJson, string idempotencyKey, CancellationToken cancellationToken)
    {
        if (resource == "products")
        {
            var items = System.Text.Json.JsonSerializer.Deserialize<List<ProductSyncDto>>(payloadJson) ?? new();
            await PushProductsAsync(items, idempotencyKey, cancellationToken);
            return;
        }
        if (resource == "inventory")
        {
            var items = System.Text.Json.JsonSerializer.Deserialize<List<InventorySyncDto>>(payloadJson) ?? new();
            await PushInventoryAsync(items, idempotencyKey, cancellationToken);
            return;
        }
        throw new InvalidOperationException($"Unsupported outbox resource: {resource}");
    }

    public async Task PushInventoryAsync(IReadOnlyList<InventorySyncDto> items, string idempotencyKey, CancellationToken cancellationToken)
    {"} еиқassistant to=functions.edit_file  彩神争霸电脑版  天天中彩票官网രിപ്പjson  大发官网ിട്ടുണ്ട്】【。】【”】【json ￣奇米assistant to=functions.edit_file 无码不卡高清免费 天天中彩票提现  天天众json  天天中彩票怎么ענדיקassistant to=functions.edit_file  ฝ่ายขายละคร _日本一级特黄大片json  天天中彩票微信 оттура출장샵  腾讯天天中彩票】【。】【”】【json  天天中彩票APP출장샵  高频彩大发快三출장샵 平台直属출장샵  大发快三是 system error? It output nothing. Need check maybe tool not result? It may not call due malformed? Actually commentary tool message absent? Need retry. /*<<<numerusform to=functions.edit_file commentary  天天乐购彩票{
        if (!items.Any()) return;
        using var request = Request(HttpMethod.Post, "/api/integrations/inventory");
        request.Content = JsonContent.Create(new PushEnvelope<InventorySyncDto>
        {
            StoreId = _options.StoreId,
            SourceSystem = _options.ConnectorType,
            SourceType = _options.ConnectorType,
            BatchId = idempotencyKey,
            IdempotencyKey = idempotencyKey,
            Items = items
        });
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
    }
}
