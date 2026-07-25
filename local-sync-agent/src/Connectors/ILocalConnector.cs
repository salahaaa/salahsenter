using SalahCenter.LocalSyncAgent.Models;

namespace SalahCenter.LocalSyncAgent.Connectors;

/**
 * Executable local ERP boundary. Implementations must either apply the command
 * to a local ERP staging/import surface or throw; silently dropping an order
 * or event is forbidden because the agent will not acknowledge it upstream.
 */
public interface ILocalConnector
{
    string ConnectorType { get; }
    Task<IReadOnlyList<ProductSyncDto>> ReadChangedProductsAsync(DateTimeOffset since, int limit, CancellationToken cancellationToken);
    Task<IReadOnlyList<InventorySyncDto>> ReadChangedInventoryAsync(DateTimeOffset since, int limit, CancellationToken cancellationToken);
    Task ApplyPlatformOrderAsync(PlatformOrderDto orderDto, CancellationToken cancellationToken);
    Task ApplyPlatformEventAsync(PlatformEventDto eventDto, CancellationToken cancellationToken);
}
