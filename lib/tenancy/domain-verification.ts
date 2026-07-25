import { promises as dns } from "node:dns";
import { normalizeTenantHost } from "@/lib/tenancy/context";

export function tenantVerificationRecord(domain: string) {
  return `_salah-tenant-verification.${normalizeTenantHost(domain)}`;
}

export async function verifyTenantDomainDns(domain: string, token: string) {
  const normalizedDomain = normalizeTenantHost(domain);
  if (!normalizedDomain || !token) return { verified: false, record: tenantVerificationRecord(domain), values: [] as string[], reason: "domain_or_token_missing" };
  const record = tenantVerificationRecord(normalizedDomain);
  try {
    const records = await dns.resolveTxt(record);
    const values = records.map((parts) => parts.join("").trim());
    return { verified: values.includes(token), record, values, reason: values.includes(token) ? null : "token_not_found" };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code || "dns_lookup_failed") : "dns_lookup_failed";
    return { verified: false, record, values: [] as string[], reason: code };
  }
}
