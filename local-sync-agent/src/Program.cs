using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using SalahCenter.LocalSyncAgent.Configuration;
using SalahCenter.LocalSyncAgent.Connectors;
using SalahCenter.LocalSyncAgent.Storage;
using SalahCenter.LocalSyncAgent.Sync;
using SalahCenter.LocalSyncAgent.Security;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/local-sync-agent-.log", rollingInterval: RollingInterval.Day, retainedFileCountLimit: 14)
    .CreateLogger();

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddSerilog();

builder.Services.Configure<AgentOptions>(builder.Configuration.GetSection("Agent"));
builder.Services.Configure<MappingOptions>(builder.Configuration.GetSection("Mapping"));
builder.Services.Configure<SqlServerOptions>(builder.Configuration.GetSection("SqlServer"));
builder.Services.Configure<AccessOptions>(builder.Configuration.GetSection("Access"));
builder.Services.Configure<CsvExcelOptions>(builder.Configuration.GetSection("CsvExcel"));

builder.Services.AddSingleton<LocalStateDb>();
builder.Services.AddSingleton<AgentSecretProvider>();
builder.Services.AddSingleton<SqlServerConnector>();
builder.Services.AddSingleton<AccessOdbcConnector>();
builder.Services.AddSingleton<CsvExcelConnector>();
builder.Services.AddSingleton<ILocalConnector>(sp =>
{
    var options = sp.GetRequiredService<IOptions<AgentOptions>>().Value;
    return options.ConnectorType.ToLowerInvariant() switch
    {
        "sql_server" => sp.GetRequiredService<SqlServerConnector>(),
        "access" or "odbc" => sp.GetRequiredService<AccessOdbcConnector>(),
        "csv_excel" => sp.GetRequiredService<CsvExcelConnector>(),
        _ => sp.GetRequiredService<SqlServerConnector>()
    };
});

builder.Services.AddHttpClient<PlatformApiClient>((sp, client) =>
{
    var options = sp.GetRequiredService<IOptions<AgentOptions>>().Value;
    client.BaseAddress = new Uri(options.BaseUrl.TrimEnd('/'));
    client.Timeout = TimeSpan.FromSeconds(60);
});

builder.Services.AddHostedService<SyncWorker>();

await builder.Build().RunAsync();
