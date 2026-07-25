import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, integrationClients } from "@/lib/db";

export type IntegrationScope =
  | "products:read"
  | "products:write"
  | "inventory:read"
  | "inventory:write"
  | "orders:read"
  | "orders:write"
  | "invoices:read"
  | "invoices:write"
  | "events:read"
  | "events:write"
  | "sales_reports:write";

export type IntegrationAuthContext = {
  clientId: string;
  name: string;
  provider: "accounting" | string;
  scopes: string[];
  storeIds: string[];
  source: "database" | "environment";
};

export class IntegrationAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "IntegrationAuthError";
    this.status = status;
  }
}

type EnvClient = IntegrationAuthContext & { tokenHash: string; rawToken?: string };

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function readToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.replace(/^Bearer\s+/i, "").trim();
  const apiKey = request.headers.get("x-api-key")?.trim() || "";
  return bearer || apiKey;
}

function readClientId(request: Request) {
  return request.headers.get("x-integration-client-id")?.trim() || request.headers.get("x-client-id")?.trim() || "";
}

function parseList(value: string | undefined) {
  return String(value || "").split(/[|,\s]+/).map((item) => item.trim()).filter(Boolean);
}

export function parseEnvIntegrationClients(): EnvClient[] {
  const json = process.env.INTEGRATION_CLIENTS_JSON;
  if (json) {
    try {
      const raw = JSON.parse(json) as Array<Record<string, unknown>>;
      return raw.map((item, index) => ({
        clientId: String(item.clientId || item.clientKey || `env-client-${index + 1}`),
        name: String(item.name || item.clientId || `Env Integration Client ${index + 1}`),
        provider: String(item.provider || "accounting"),
        scopes: Array.isArray(item.scopes) ? item.scopes.map(String) : parseList(String(item.scopes || "")),
        storeIds: Array.isArray(item.storeIds) ? item.storeIds.map(String) : parseList(String(item.storeIds || "")),
        tokenHash: String(item.tokenHash || (item.token ? sha256(String(item.token)) : "")),
        source: "environment" as const
      })).filter((item) => item.tokenHash);
    } catch {
      return [];
    }
  }

  return String(process.env.INTEGRATION_API_KEYS || "")
    .split(",")
    .map((item, index) => item.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const parts = entry.split(":");
      if (parts.length >= 2) {
        const [clientId, tokenOrHash, storeIds = "*", scopes = "*"] = parts;
        const tokenHash = tokenOrHash.startsWith("sha256=") ? tokenOrHash.slice("sha256=".length) : sha256(tokenOrHash);
        return { clientId, name: clientId, provider: "accounting", scopes: scopes === "*" ? ["*"] : parseList(scopes), storeIds: storeIds === "*" ? [] : parseList(storeIds), tokenHash, source: "environment" as const };
      }
      return { clientId: `env-key-${index + 1}`, name: `Env API Key ${index + 1}`, provider: "accounting", scopes: ["*"], storeIds: [], tokenHash: sha256(entry), source: "environment" as const };
    });
}

function hasScope(scopes: string[], required?: IntegrationScope) {
  if (!required) return true;
  return scopes.includes("*") || scopes.includes(required);
}

export function assertStoreAllowed(context: IntegrationAuthContext, storeId?: string | null) {
  if (!storeId || !context.storeIds.length) return;
  if (!context.storeIds.includes(storeId)) throw new IntegrationAuthError("هذا العميل غير مصرح له بالوصول إلى هذا المتجر", 403);
}

async function authenticateDatabaseClient(clientId: string, token: string, requiredScope?: IntegrationScope): Promise<IntegrationAuthContext | null> {
  if (!clientId) return null;
  try {
    const [client] = await db.select().from(integrationClients).where(and(eq(integrationClients.clientKey, clientId), eq(integrationClients.status, "active"))).limit(1);
    if (!client) return null;
    if (!safeEqual(client.tokenHash, sha256(token))) throw new IntegrationAuthError("بيانات اعتماد التكامل غير صحيحة", 401);
    if (!hasScope(client.scopes, requiredScope)) throw new IntegrationAuthError("نطاق صلاحية التكامل غير كافٍ", 403);
    await db.update(integrationClients).set({ lastSeenAt: new Date(), updatedAt: new Date() }).where(eq(integrationClients.id, client.id));
    return { clientId: client.clientKey, name: client.name, provider: client.provider, scopes: client.scopes, storeIds: client.storeIds, source: "database" };
  } catch (error) {
    if (error instanceof IntegrationAuthError) throw error;
    return null;
  }
}

function authenticateEnvClient(token: string, requiredScope?: IntegrationScope): IntegrationAuthContext | null {
  const tokenHash = sha256(token);
  const client = parseEnvIntegrationClients().find((item) => safeEqual(item.tokenHash, tokenHash));
  if (!client) return null;
  if (!hasScope(client.scopes, requiredScope)) throw new IntegrationAuthError("نطاق صلاحية التكامل غير كافٍ", 403);
  return client;
}

export async function authenticateIntegrationRequest(request: Request, requiredScope?: IntegrationScope): Promise<IntegrationAuthContext> {
  const token = readToken(request);
  if (!token) throw new IntegrationAuthError("يلزم إرسال API Key أو Bearer Token", 401);

  const clientId = readClientId(request);
  const dbClient = await authenticateDatabaseClient(clientId, token, requiredScope);
  if (dbClient) return dbClient;

  const envClient = authenticateEnvClient(token, requiredScope);
  if (envClient) return envClient;

  throw new IntegrationAuthError("بيانات اعتماد التكامل غير صحيحة", 401);
}

export const __integrationAuthInternals = { parseEnvIntegrationClients, sha256 };
