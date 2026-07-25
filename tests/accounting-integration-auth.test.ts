import { afterEach, describe, expect, it } from "vitest";
import { __integrationAuthInternals } from "@/lib/integrations/accounting/auth";

describe("accounting integration auth env parser", () => {
  const previousKeys = process.env.INTEGRATION_API_KEYS;
  const previousJson = process.env.INTEGRATION_CLIENTS_JSON;

  afterEach(() => {
    process.env.INTEGRATION_API_KEYS = previousKeys;
    process.env.INTEGRATION_CLIENTS_JSON = previousJson;
  });

  it("parses simple client secrets and hashes tokens", () => {
    process.env.INTEGRATION_CLIENTS_JSON = "";
    process.env.INTEGRATION_API_KEYS = "agent-1:secret-token:*:*";
    const clients = __integrationAuthInternals.parseEnvIntegrationClients();
    expect(clients).toHaveLength(1);
    expect(clients[0].clientId).toBe("agent-1");
    expect(clients[0].tokenHash).toBe(__integrationAuthInternals.sha256("secret-token"));
    expect(clients[0].scopes).toEqual(["*"]);
  });

  it("parses JSON clients with restricted store scope", () => {
    process.env.INTEGRATION_API_KEYS = "";
    process.env.INTEGRATION_CLIENTS_JSON = JSON.stringify([{ clientId: "pos-a", token: "top-secret", storeIds: ["store-1"], scopes: ["products:read", "inventory:write"] }]);
    const clients = __integrationAuthInternals.parseEnvIntegrationClients();
    expect(clients[0]).toEqual(expect.objectContaining({ clientId: "pos-a", storeIds: ["store-1"], scopes: ["products:read", "inventory:write"] }));
  });
});
