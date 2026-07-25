namespace SalahCenter.LocalSyncAgent.Configuration;

public sealed class AgentOptions
{
    public string BaseUrl { get; set; } = "https://salahsentar22.vercel.app";
    public string ClientKey { get; set; } = "";
    /** Legacy fallback only; use SALAH_SYNC_API_KEY or ApiKeyProtectedPath in production. */
    public string ApiKey { get; set; } = "";
    public string ApiKeyProtectedPath { get; set; } = "";
    public string StoreId { get; set; } = "";
    public string DeviceName { get; set; } = Environment.MachineName;
    public string ConnectorType { get; set; } = "sql_server";
    public bool EnableOrdersPull { get; set; } = true;
    public bool EnableEventsPull { get; set; } = true;
    public int MaxOutboxAttempts { get; set; } = 10;
    // Product names, descriptions, images and merchant prices are platform authority.
    // Keep disabled unless a future, explicitly approved migration changes policy.
    public bool EnableProductPush { get; set; } = false;
    public int ProductsPushSeconds { get; set; } = 900;
    public int InventoryPushSeconds { get; set; } = 300;
    public int OrdersPullSeconds { get; set; } = 300;
    public int EventsPullSeconds { get; set; } = 120;
    public int HeartbeatSeconds { get; set; } = 60;
    public int BatchSize { get; set; } = 200;
}

public sealed class MappingOptions
{
    public string ProductCode { get; set; } = "ItemCode";
    public string Barcode { get; set; } = "Barcode";
    public string Name { get; set; } = "ItemName";
    public string Price { get; set; } = "SalePrice";
    public string Stock { get; set; } = "Quantity";
    public string UpdatedAt { get; set; } = "LastModified";
}

public sealed class SqlServerOptions
{
    public string ConnectionString { get; set; } = "";
    public string ProductsQuery { get; set; } = "";
    /** Parameterized command that writes a platform order to a local ERP staging table. */
    public string ApplyOrderCommand { get; set; } = "";
    /** Parameterized command that writes an outbound platform event to a local staging table. */
    public string ApplyEventCommand { get; set; } = "";
}

public sealed class AccessOptions
{
    public string OdbcConnectionString { get; set; } = "";
    public string ProductsQuery { get; set; } = "";
    public string ApplyOrderCommand { get; set; } = "";
    public string ApplyEventCommand { get; set; } = "";
}

public sealed class CsvExcelOptions
{
    public string WatchFolder { get; set; } = "C:\\SalahSync\\exports";
    public string ProcessedFolder { get; set; } = "C:\\SalahSync\\processed";
    public string FailedFolder { get; set; } = "C:\\SalahSync\\failed";
    public string InboundOrdersFolder { get; set; } = "C:\\SalahSync\\inbound-orders";
    public string InboundEventsFolder { get; set; } = "C:\\SalahSync\\inbound-events";
}
