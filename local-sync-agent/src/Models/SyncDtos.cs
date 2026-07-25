using System.Text.Json;
using System.Text.Json.Serialization;

namespace SalahCenter.LocalSyncAgent.Models;

public sealed record MoneyDto(decimal Amount, string Currency = "YER");

public sealed record ProductSyncDto
{
    public string? ExternalProductId { get; init; }
    public string? ProductCode { get; init; }
    public string? Barcode { get; init; }
    public string Name { get; init; } = "";
    public MoneyDto BasePrice { get; init; } = new(0);
    public int Stock { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}

public sealed record InventorySyncDto
{
    public string? ExternalProductId { get; init; }
    public string? ProductCode { get; init; }
    public string? Barcode { get; init; }
    public string ProductName { get; init; } = "";
    public int QuantityOnHand { get; init; }
    public int AvailableQuantity { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}

/** Platform-owned order sent to a local ERP staging/import connector. */
public sealed record PlatformOrderDto
{
    public string OrderId { get; init; } = "";
    public string OrderNumber { get; init; } = "";
    public string StoreId { get; init; } = "";
    public string StatusCode { get; init; } = "";
    public string PaymentStatus { get; init; } = "pending";
    public string Currency { get; init; } = "YER";
    public JsonElement DeliveryAddress { get; init; }
    public JsonElement Customer { get; init; }
    public IReadOnlyList<PlatformOrderLineDto> Lines { get; init; } = Array.Empty<PlatformOrderLineDto>();
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}

public sealed record PlatformOrderLineDto
{
    public string LineId { get; init; } = "";
    public string ProductId { get; init; } = "";
    public string VariantId { get; init; } = "";
    public string? Sku { get; init; }
    public string? ProductCode { get; init; }
    public string ProductName { get; init; } = "";
    public string? VariantTitle { get; init; }
    public int Quantity { get; init; }
    public MoneyDto UnitPrice { get; init; } = new(0);
}

/** Durable outbound event consumed only after local application succeeds. */
public sealed record PlatformEventDto
{
    public string Id { get; init; } = "";
    public string EventType { get; init; } = "";
    public string EntityType { get; init; } = "";
    public string? EntityId { get; init; }
    public string? StoreId { get; init; }
    public JsonElement Payload { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

public sealed record PushEnvelope<T>
{
    public string? StoreId { get; init; }
    public string SourceSystem { get; init; } = "Local Sync Agent";
    public string SourceType { get; init; } = "other";
    public string? BatchId { get; init; }
    public string? IdempotencyKey { get; init; }
    public IReadOnlyList<T> Items { get; init; } = Array.Empty<T>();
}

public sealed record PullPage<T>
{
    [JsonPropertyName("data")]
    public IReadOnlyList<T> Data { get; init; } = Array.Empty<T>();

    [JsonPropertyName("pageInfo")]
    public PageInfo PageInfo { get; init; } = new();
}

public sealed record PageInfo
{
    public int Limit { get; init; }
    public bool HasMore { get; init; }
    public string? NextCursor { get; init; }
    public DateTimeOffset GeneratedAt { get; init; }
}

public sealed record PlatformResponse<T>
{
    public bool Success { get; init; }
    public T? Data { get; init; }
    public string? Message { get; init; }
}
