// Merchant-only page scanner. Run inside scan-merchant-only.sh
const BASE = "http://localhost:3000";
async function login(email, password) {
  const r0 = await fetch(BASE + "/");
  const sc0 = r0.headers.get("set-cookie") || "";
  const csrf = (sc0.match(/mall_csrf=([^;]+)/) || [])[1] || "";
  const jar = sc0.split(",").map((c) => c.split(";")[0].trim()).join("; ");
  const r1 = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": csrf, "x-requested-with": "XMLHttpRequest", cookie: jar }, body: JSON.stringify({ email, password }) });
  const sc = r1.headers.get("set-cookie") || "";
  const s = (sc.match(/mall_session=([^;]+)/) || [])[1] || "";
  const c = (sc.match(/mall_csrf=([^;]+)/) || [])[1] || csrf;
  return `mall_session=${s}; mall_csrf=${c}`;
}
const ERROR_MARKERS = ["شيء ما حدث", "حدث خطأ", "تعذر", "Something went wrong", "Digest:", "Application error", "relation \"", "does not exist", "column \"", "TypeError", "Cannot read propert", "is not a function"];
async function scan(path, cookie) {
  try {
    const r = await fetch(BASE + path, { headers: { cookie }, redirect: "manual" });
    const html = await r.text();
    const foundErrors = ERROR_MARKERS.filter((m) => html.includes(m));
    const isLogin = r.status >= 300 && r.status < 400 && (r.headers.get("location") || "").includes("login");
    return { path, status: r.status, size: html.length, errors: foundErrors, isLogin, ok: r.status === 200 && foundErrors.length === 0 && !isLogin };
  } catch (e) { return { path, status: 0, size: 0, errors: [e.message], isLogin: false, ok: false }; }
}
async function main() {
  const merchantCookie = await login(process.env.TEST_MERCHANT_EMAIL || "", process.env.TEST_MERCHANT_PASSWORD || "");
  const merchantPages = ["/merchant", "/merchant/ads", "/merchant/ai-assistant", "/merchant/announcements", "/merchant/branches", "/merchant/categories", "/merchant/currencies", "/merchant/employees", "/merchant/inventory", "/merchant/media", "/merchant/offers", "/merchant/onboarding", "/merchant/operations-settings", "/merchant/orders", "/merchant/product-intake", "/merchant/product-taxonomy", "/merchant/products", "/merchant/reports", "/merchant/settings", "/merchant/smart-setup", "/merchant/smart-tools"];
  console.log("MERCHANT PAGES (" + merchantPages.length + ")");
  console.log("=".repeat(80));
  const results = [];
  for (const p of merchantPages) { const r = await scan(p, merchantCookie); results.push(r); const flag = r.ok ? "✓ OK " : r.isLogin ? "⚠ LOGIN" : r.status === 500 ? "✗ ERR " : "✗ BROKEN"; const errStr = r.errors.length ? `  ⚑ ${r.errors.join("; ")}` : ""; console.log(`  ${flag} ${String(r.status).padEnd(4)} ${(r.size + "b").padStart(7)}  ${r.path}${errStr}`); await new Promise((res) => setTimeout(res, 1500)); }
  const ok = results.filter((r) => r.ok).length;
  const broken = results.filter((r) => !r.ok);
  console.log(`\nOK: ${ok}/${results.length} | BROKEN: ${broken.length}`);
  if (broken.length) { console.log("\n--- BROKEN ---"); broken.forEach((r) => console.log(`  ${r.status} ${r.path} ${r.errors.join(",")}`)); }
}
main().catch((e) => { console.error(e); process.exit(1); });
