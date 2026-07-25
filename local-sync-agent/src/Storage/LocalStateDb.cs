using Microsoft.Data.Sqlite;
using System.Text.Json;

namespace SalahCenter.LocalSyncAgent.Storage;

public sealed record OutboxItem(string Id, string Resource, string Payload, string IdempotencyKey, int Attempts);
public sealed record InboxItem(string Id, string EventType, string Payload, int Attempts);

/** Durable SQLite state. The platform is acknowledged only after local apply succeeds. */
public sealed class LocalStateDb
{
    private readonly string _connectionString;

    public LocalStateDb()
    {
        var folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "SalahCenter", "LocalSyncAgent");
        Directory.CreateDirectory(folder);
        _connectionString = new SqliteConnectionStringBuilder { DataSource = Path.Combine(folder, "agent-state.db") }.ToString();
    }

    public async Task InitializeAsync(CancellationToken cancellationToken)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """
        create table if not exists sync_checkpoints (
          resource text primary key, cursor text, last_synced_at text
        );
        create table if not exists sync_outbox (
          id text primary key, resource text not null, payload text not null, idempotency_key text not null,
          status text not null default 'pending', attempts integer not null default 0,
          next_attempt_at text not null, last_error text, created_at text not null, processed_at text
        );
        create unique index if not exists sync_outbox_idempotency_unique on sync_outbox(idempotency_key);
        create table if not exists sync_inbox (
          id text primary key, event_type text not null, payload text not null,
          status text not null default 'pending', attempts integer not null default 0,
          next_attempt_at text not null, last_error text, processed_at text, created_at text not null
        );
        create table if not exists dead_letters (
          id text primary key, source_id text, reason text, payload text, created_at text not null
        );
        """;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<DateTimeOffset> GetCheckpointAsync(string resource, CancellationToken cancellationToken)
    {
        await using var connection = new SqliteConnection(_connectionString); await connection.OpenAsync(cancellationToken);
        var command = connection.CreateCommand(); command.CommandText = "select last_synced_at from sync_checkpoints where resource=$resource"; command.Parameters.AddWithValue("$resource", resource);
        var value = await command.ExecuteScalarAsync(cancellationToken) as string;
        return DateTimeOffset.TryParse(value, out var parsed) ? parsed : DateTimeOffset.UnixEpoch;
    }

    public async Task SetCheckpointAsync(string resource, DateTimeOffset checkpoint, string? cursor, CancellationToken cancellationToken)
    {
        await using var connection = new SqliteConnection(_connectionString); await connection.OpenAsync(cancellationToken);
        var command = connection.CreateCommand();
        command.CommandText = """insert into sync_checkpoints(resource, cursor, last_synced_at) values($resource, $cursor, $last_synced_at) on conflict(resource) do update set cursor=$cursor, last_synced_at=$last_synced_at""";
        command.Parameters.AddWithValue("$resource", resource); command.Parameters.AddWithValue("$cursor", cursor ?? ""); command.Parameters.AddWithValue("$last_synced_at", checkpoint.ToString("O"));
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<string> EnqueueOutboxAsync<T>(string resource, T payload, string idempotencyKey, CancellationToken cancellationToken)
    {
        await using var connection = new SqliteConnection(_connectionString); await connection.OpenAsync(cancellationToken);
        var id = Guid.NewGuid().ToString("N");
        var command = connection.CreateCommand();
        command.CommandText = """insert or ignore into sync_outbox(id, resource, payload, idempotency_key, status, next_attempt_at, created_at) values($id, $resource, $payload, $idempotency_key, 'pending', $next_attempt_at, $created_at)""";
        command.Parameters.AddWithValue("$id", id); command.Parameters.AddWithValue("$resource", resource); command.Parameters.AddWithValue("$payload", JsonSerializer.Serialize(payload)); command.Parameters.AddWithValue("$idempotency_key", idempotencyKey); command.Parameters.AddWithValue("$next_attempt_at", DateTimeOffset.UtcNow.ToString("O")); command.Parameters.AddWithValue("$created_at", DateTimeOffset.UtcNow.ToString("O"));
        await command.ExecuteNonQueryAsync(cancellationToken);
        return id;
    }

    public async Task<IReadOnlyList<OutboxItem>> GetDueOutboxAsync(int limit, CancellationToken cancellationToken)
    {
        await using var connection = new SqliteConnection(_connectionString); await connection.OpenAsync(cancellationToken);
        var command = connection.CreateCommand(); command.CommandText = "select id, resource, payload, idempotency_key, attempts from sync_outbox where status in ('pending','retry') and next_attempt_at <= $now order by created_at limit $limit"; command.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToString("O")); command.Parameters.AddWithValue("$limit", limit);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken); var rows = new List<OutboxItem>();
        while (await reader.ReadAsync(cancellationToken)) rows.Add(new OutboxItem(reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetInt32(4)));
        return rows;
    }

    public async Task MarkOutboxProcessedAsync(string id, CancellationToken cancellationToken)
    {
        await ExecuteAsync("update sync_outbox set status='processed', processed_at=$now, last_error=null where id=$id", new() { ["$id"] = id, ["$now"] = DateTimeOffset.UtcNow.ToString("O") }, cancellationToken);
    }

    public async Task MarkOutboxRetryAsync(OutboxItem item, string error, int maxAttempts, CancellationToken cancellationToken)
    {
        var attempts = item.Attempts + 1; var dead = attempts >= maxAttempts; var next = DateTimeOffset.UtcNow.AddSeconds(Math.Min(900, Math.Pow(2, Math.Min(attempts, 9)) * 5));
        await ExecuteAsync("update sync_outbox set status=$status, attempts=$attempts, next_attempt_at=$next, last_error=$error where id=$id", new() { ["$id"] = item.Id, ["$status"] = dead ? "dead" : "retry", ["$attempts"] = attempts, ["$next"] = next.ToString("O"), ["$error"] = error[..Math.Min(error.Length, 2000)] }, cancellationToken);
        if (dead) await AddDeadLetterAsync(item.Id, error, item.Payload, cancellationToken);
    }

    public async Task EnqueueInboxAsync(string id, string eventType, string payload, CancellationToken cancellationToken)
    {
        await ExecuteAsync("insert or ignore into sync_inbox(id, event_type, payload, status, attempts, next_attempt_at, created_at) values($id,$eventType,$payload,'pending',0,$now,$now)", new() { ["$id"] = id, ["$eventType"] = eventType, ["$payload"] = payload, ["$now"] = DateTimeOffset.UtcNow.ToString("O") }, cancellationToken);
    }

    public async Task<IReadOnlyList<InboxItem>> GetDueInboxAsync(int limit, CancellationToken cancellationToken)
    {
        await using var connection = new SqliteConnection(_connectionString); await connection.OpenAsync(cancellationToken);
        var command = connection.CreateCommand(); command.CommandText = "select id,event_type,payload,attempts from sync_inbox where status in ('pending','retry') and next_attempt_at <= $now order by created_at limit $limit"; command.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToString("O")); command.Parameters.AddWithValue("$limit", limit);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken); var rows = new List<InboxItem>();
        while (await reader.ReadAsync(cancellationToken)) rows.Add(new InboxItem(reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetInt32(3)));
        return rows;
    }

    public Task MarkInboxProcessedAsync(string id, CancellationToken cancellationToken) => ExecuteAsync("update sync_inbox set status='processed', processed_at=$now, last_error=null where id=$id", new() { ["$id"] = id, ["$now"] = DateTimeOffset.UtcNow.ToString("O") }, cancellationToken);

    public async Task MarkInboxRetryAsync(InboxItem item, string error, int maxAttempts, CancellationToken cancellationToken)
    {
        var attempts = item.Attempts + 1; var dead = attempts >= maxAttempts; var next = DateTimeOffset.UtcNow.AddSeconds(Math.Min(900, Math.Pow(2, Math.Min(attempts, 9)) * 5));
        await ExecuteAsync("update sync_inbox set status=$status, attempts=$attempts, next_attempt_at=$next, last_error=$error where id=$id", new() { ["$id"] = item.Id, ["$status"] = dead ? "dead" : "retry", ["$attempts"] = attempts, ["$next"] = next.ToString("O"), ["$error"] = error[..Math.Min(error.Length, 2000)] }, cancellationToken);
        if (dead) await AddDeadLetterAsync(item.Id, error, item.Payload, cancellationToken);
    }

    public async Task<(int PendingOutbox, int FailedItems)> GetHealthCountsAsync(CancellationToken cancellationToken)
    {
        await using var connection = new SqliteConnection(_connectionString); await connection.OpenAsync(cancellationToken);
        var command = connection.CreateCommand(); command.CommandText = "select (select count(*) from sync_outbox where status in ('pending','retry')), (select count(*) from sync_outbox where status='dead') + (select count(*) from sync_inbox where status='dead')";
        await using var reader = await command.ExecuteReaderAsync(cancellationToken); if (!await reader.ReadAsync(cancellationToken)) return (0, 0);
        return (reader.GetInt32(0), reader.GetInt32(1));
    }

    private async Task AddDeadLetterAsync(string sourceId, string reason, string payload, CancellationToken cancellationToken) => await ExecuteAsync("insert into dead_letters(id,source_id,reason,payload,created_at) values($id,$sourceId,$reason,$payload,$now)", new() { ["$id"] = Guid.NewGuid().ToString("N"), ["$sourceId"] = sourceId, ["$reason"] = reason[..Math.Min(reason.Length, 2000)], ["$payload"] = payload, ["$now"] = DateTimeOffset.UtcNow.ToString("O") }, cancellationToken);

    private async Task ExecuteAsync(string commandText, Dictionary<string, object> values, CancellationToken cancellationToken)
    {
        await using var connection = new SqliteConnection(_connectionString); await connection.OpenAsync(cancellationToken); var command = connection.CreateCommand(); command.CommandText = commandText;
        foreach (var value in values) command.Parameters.AddWithValue(value.Key, value.Value);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
