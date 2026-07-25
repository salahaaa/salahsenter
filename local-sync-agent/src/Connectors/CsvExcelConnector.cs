using CsvHelper;
using CsvHelper.Configuration;
using Microsoft.Extensions.Options;
using SalahCenter.LocalSyncAgent.Configuration;
using SalahCenter.LocalSyncAgent.Models;
using System.Globalization;
using System.Text.Json;

namespace SalahCenter.LocalSyncAgent.Connectors;

public sealed class CsvExcelConnector(IOptions<CsvExcelOptions> csvOptions, IOptions<MappingOptions> mappingOptions) : ILocalConnector
{
    private readonly CsvExcelOptions _options = csvOptions.Value;
    private readonly MappingOptions _mapping = mappingOptions.Value;
    public string ConnectorType => "csv_excel";

    public Task<IReadOnlyList<ProductSyncDto>> ReadChangedProductsAsync(DateTimeOffset since, int limit, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(_options.WatchFolder);
        var files = Directory.GetFiles(_options.WatchFolder, "*.csv").OrderBy(File.GetCreationTimeUtc).Take(10).ToArray();
        var rows = new List<ProductSyncDto>();
        foreach (var file in files)
        {
            using var reader = new StreamReader(file);
            using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture) { DetectDelimiter = true });
            foreach (var record in csv.GetRecords<dynamic>())
            {
                if (rows.Count >= limit) break;
                var dict = (IDictionary<string, object>)record;
                rows.Add(new ProductSyncDto
                {
                    ExternalProductId = Get(dict, _mapping.ProductCode),
                    ProductCode = Get(dict, _mapping.ProductCode),
                    Barcode = Get(dict, _mapping.Barcode),
                    Name = Get(dict, _mapping.Name) ?? "Unnamed",
                    BasePrice = new MoneyDto(decimal.TryParse(Get(dict, _mapping.Price), out var price) ? price : 0),
                    Stock = int.TryParse(Get(dict, _mapping.Stock), out var stock) ? stock : 0,
                    UpdatedAt = DateTimeOffset.TryParse(Get(dict, _mapping.UpdatedAt), out var updated) ? updated : DateTimeOffset.UtcNow
                });
            }
        }
        return Task.FromResult<IReadOnlyList<ProductSyncDto>>(rows);
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

    public async Task ApplyPlatformOrderAsync(PlatformOrderDto orderDto, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(_options.InboundOrdersFolder);
        var safeName = $"order-{orderDto.OrderNumber}-{orderDto.OrderId}.json".Replace(Path.DirectorySeparatorChar, '-');
        var path = Path.Combine(_options.InboundOrdersFolder, safeName);
        await File.WriteAllTextAsync(path, JsonSerializer.Serialize(orderDto, new JsonSerializerOptions { WriteIndented = true }), cancellationToken);
    }

    public async Task ApplyPlatformEventAsync(PlatformEventDto eventDto, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(_options.InboundEventsFolder);
        var safeName = $"event-{eventDto.EventType}-{eventDto.Id}.json".Replace(Path.DirectorySeparatorChar, '-');
        var path = Path.Combine(_options.InboundEventsFolder, safeName);
        await File.WriteAllTextAsync(path, JsonSerializer.Serialize(eventDto, new JsonSerializerOptions { WriteIndented = true }), cancellationToken);
    }

    private static string? Get(IDictionary<string, object> row, string key) => row.TryGetValue(key, out var value) ? Convert.ToString(value) : null;
}
