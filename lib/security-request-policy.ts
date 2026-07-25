/** Browser mutations retain CSRF protection. Integration routes are exempt only
 * when a machine credential is actually present and will be verified by the
 * route's integration auth contract. */
export function hasMachineIntegrationCredential(headers: Headers) {
  const authorization = headers.get("authorization")?.trim() || "";
  const apiKey = headers.get("x-api-key")?.trim() || "";
  return /^Bearer\s+\S+/i.test(authorization) || apiKey.length >= 16;
}

export function isMachineIntegrationRequest(pathname: string, headers: Headers) {
  return pathname.startsWith("/api/integrations/") && hasMachineIntegrationCredential(headers);
}

export function isSignedPaymentWebhook(pathname: string) {
  return pathname === "/api/payments/stripe/webhook" || pathname === "/api/payments/local-gateway/webhook";
}
