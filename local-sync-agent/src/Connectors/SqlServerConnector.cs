using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;
using SalahCenter.LocalSyncAgent.Configuration;
using SalahCenter.LocalSyncAgent.Models;
using System.Text.Json;

namespace SalahCenter.LocalSyncAgent.Connectors;

public sealed class SqlServerConnector(IOptions<SqlServerOptions> sqlOptions, IOptions<MappingOptions> mappingOptions) : ILocalConnector
{
    private readonly SqlServerOptions _options = sqlOptions.Value;
    private readonly MappingOptions _mapping = mappingOptions.Value;
    public string ConnectorType => "sql_server";

    public async Task<IReadOnlyList<ProductSyncDto>> ReadChangedProductsAsync(DateTimeOffset since, int limit, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.ConnectionString) || string.IsNullOrWhiteSpace(_options.ProductsQuery)) return Array.Empty<ProductSyncDto>();
        var rows = new List<ProductSyncDto>();
        await using var connection = new SqlConnection(_options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(_options.ProductsQuery, connection);
        command.Parameters.AddWithValue("@since", since.UtcDateTime);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken) && rows.Count < limit)
        {
            rows.Add(new ProductSyncDto
            {
                ExternalProductId = ReadString(reader, _mapping.ProductCode),
                ProductCode = ReadString(reader, _mapping.ProductCode),
                Barcode = ReadString(reader, _mapping.Barcode),
                Name = ReadString(reader, _mapping.Name) ?? "Unnamed",
                BasePrice = new MoneyDto(ReadDecimal(reader, _mapping.Price)),
                Stock = Convert.ToInt32(ReadDecimal(reader, _mapping.Stock)),
                UpdatedAt = ReadDate(reader, _mapping.UpdatedAt) ?? DateTimeOffset.UtcNow
            });
        }
        return rows;
    }

    public async Task<IReadOnlyList<InventorySyncDto>> ReadChangedInventoryAsync(DateTimeOffset since, int limit, CancellationToken cancellationToken)
    {
        var products = await ReadChangedProductsAsync(since, limit, cancellationToken);
        return products.Select(product => new InventorySyncDto
        {
            ExternalProductId = product.ExternalProductId,
            ProductCode = product.ProductCode,
            Barcode = product.Barcode,
            ProductName = product.Name,
            QuantityOnHand = product.Stock,
            AvailableQuantity = product.Stock,
            UpdatedAt = product.UpdatedAt
        }).ToList();
    }

    public Task ApplyPlatformOrderAsync(PlatformOrderDto orderDto, CancellationToken cancellationToken) =>
        ExecuteInboundCommandAsync(_options.ApplyOrderCommand, "order", orderDto.OrderId, JsonSerializer.Serialize(orderDto), cancellationToken);

    public Task ApplyPlatformEventAsync(PlatformEventDto eventDto, CancellationToken cancellationToken) =>
        ExecuteInboundCommandAsync(_options.ApplyEventCommand, "event", eventDto.Id, JsonSerializer.Serialize(eventDto), cancellationToken);

    private async Task ExecuteInboundCommandAsync(string commandText, string kind, string externalId, string payloadJson, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.ConnectionString)) throw new InvalidOperationException("SQL Server connection string is required for inbound ERP commands.");
        if (string.IsNullOrWhiteSpace(commandText)) throw new InvalidOperationException($"{kind} inbound command is not configured. Set SqlServer:Apply{(kind == "order" ? "Order" : "Event")}Command before enabling pull.");
        await using var connection = new SqlConnection(_options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(commandText, connection);
        command.Parameters.AddWithValue("@externalId", externalId);
        command.Parameters.AddWithValue("@payloadJson", payloadJson);
        command.Parameters.AddWithValue("@receivedAt", DateTimeOffset.UtcNow.UtcDateTime);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static string? ReadString(SqlDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal) ? null : Convert.ToString(reader.GetValue(ordinal));
    }

    private static decimal ReadDecimal(SqlDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        return reader.IsDBNull(ordinal) ? 0 : Convert.ToDecimal(reader.GetValue(ordinal));
    }

    private static DateTimeOffset? ReadDate(SqlDataReader reader, string column)
    {
        var ordinal = reader.GetOrdinal(column);
        if (reader.IsDBNull(ordinal)) return null;
        var value = reader.GetValue(ordinal);
        return value is DateTimeOffset dto ? dto : new DateTimeOffset(Convert.ToDateTime(value));
    }
}
