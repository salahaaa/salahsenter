using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using SalahCenter.LocalSyncAgent.Configuration;

namespace SalahCenter.LocalSyncAgent.Security;

/** Resolves the API key without requiring it to live in appsettings.json. */
public sealed class AgentSecretProvider(IOptions<AgentOptions> options)
{
    private readonly AgentOptions _options = options.Value;

    public string GetApiKey()
    {
        var environmentKey = Environment.GetEnvironmentVariable("SALAH_SYNC_API_KEY");
        if (!string.IsNullOrWhiteSpace(environmentKey)) return environmentKey.Trim();

        if (OperatingSystem.IsWindows() && !string.IsNullOrWhiteSpace(_options.ApiKeyProtectedPath) && File.Exists(_options.ApiKeyProtectedPath))
        {
            var protectedBytes = File.ReadAllBytes(_options.ApiKeyProtectedPath);
            var bytes = ProtectedData.Unprotect(protectedBytes, optionalEntropy: null, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(bytes).Trim();
        }

        if (!string.IsNullOrWhiteSpace(_options.ApiKey) && !_options.ApiKey.Contains("PUT_API_KEY", StringComparison.OrdinalIgnoreCase)) return _options.ApiKey.Trim();
        throw new InvalidOperationException("Agent API key is missing. Set SALAH_SYNC_API_KEY or configure a Windows DPAPI-protected key file.");
    }
}
