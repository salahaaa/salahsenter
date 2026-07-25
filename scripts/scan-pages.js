// Comprehensive dashboard scanner: tests every admin + merchant page authenticated,
// reports HTTP status, size, and error markers. Run: node scripts/scan-pages.js
const BASE = "http://localhost:3000";

async function login(email, password) {
  const r0 = await fetch(BASE + "/");
  const sc0 = r0.headers.get("set-cookie") || "";
  const csrf = (sc0.match(/mall_csrf=([^;]+)/) || [])[1] || "";
  const jar = sc0.split(",").map((c) => c.split(";")[0].trim()).join("; ");
  const r1 = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrf, "x-requested-with": "XMLHttpRequest", cookie: jar },
    body: JSON.stringify({ email, password })
  });
  const sc = r1.headers.get("set-cookie") || "";
  const s = (sc.match(/mall_session=([^;]+)/) || [])[1] || "";
  const c = (sc.match(/mall_csrf=([^;]+)/) || [])[1] || csrf;
  return `mall_session=${s}; mall_csrf=${c}`;
}

const ERROR_MARKERS = [
  "شيء ما حدث",
  "حدث خطأ",
  "تعذر",
  "Something went wrong",
  "Digest:",
  "Application error",
  "relation \"",
  "does not exist",
  "column \"",
  "TypeError",
  "Cannot read propert",
  "is not a function",
  "nextApplicationHint"
];

async function scan(path, cookie) {
  try {
    const r = await fetch(BASE + path, { headers: { cookie }, redirect: "manual" });
    const html = await r.text();
    const foundErrors = ERROR_MARKERS.filter((m) => html.includes(m));
    const isLogin = r.status >= 300 && r.status < 400 && (r.headers.get("location") || "").includes("login");
    const hasContent = html.length > 2000;
    return { path, status: r.status, size: html.length, errors: foundErrors, isLogin, hasContent, ok: r.status === 200 && foundErrors.length === 0 && !isLogin };
  } catch (e) {
    return { path, status: 0, size: 0, errors: [e.message], isLogin: false, hasContent: false, ok: false };
  }
}

async function main() {
  const adminCookie = await login(process.env.TEST_ADMIN_EMAIL || "", process.env.TEST_ADMIN_PASSWORD || "");
  const merchantCookie = await login(process.env.TEST_MERCHANT_EMAIL || "", process.env.TEST_MERCHANT_PASSWORD || "");
  const customerCookie = await login(process.env.TEST_CUSTOMER_EMAIL || "", process.env.TEST_CUSTOMER_PASSWORD || "");
  const adminPages = [
    "/admin", "/admin/ads-platform", "/admin/ads", "/admin/audit-log", "/admin/backups", "/admin/branches",
    "/admin/cms", "/admin/command-center", "/admin/commissions-taxes", "/admin/contracts", "/admin/default-media",
    "/admin/employees", "/admin/geography", "/admin/home-builder", "/admin/home-visibility", "/admin/master",
    "/admin/merchant-applications", "/admin/news", "/admin/notifications-center", "/admin/offers",
    "/admin/products", "/admin/rbac-builder", "/admin/reports", "/admin/roles", "/admin/security",
    "/admin/settings", "/admin/stores", "/admin/stores/frozen", "/admin/subscriptions", "/admin/tenants",
    "/admin/theme-builder", "/admin/users", "/admin/wings"
  ];

  const merchantPages = [
    "/merchant", "/merchant/ads", "/merchant/ai-assistant", "/merchant/announcements", "/merchant/branches",
    "/merchant/categories", "/merchant/currencies", "/merchant/employees", "/merchant/inventory",
    "/merchant/media", "/merchant/offers", "/merchant/onboarding", "/merchant/operations-settings",
    "/merchant/orders", "/merchant/product-intake", "/merchant/product-taxonomy", "/merchant/products",
    "/merchant/reports", "/merchant/settings", "/merchant/smart-setup", "/merchant/smart-tools"
  ];

  const publicPages = ["/", "/login", "/register", "/offers", "/orders", "/wings", "/smart-map", "/notifications", "/wallet", "/apply-store"];

  console.log("=".repeat(90));
  console.log("ADMIN PAGES (" + adminPages.length + ")");
  console.log("=".repeat(90));
  const adminResults = [];
  for (const p of adminPages) { const r = await scan(p, adminCookie); adminResults.push(r); printResult(r); await new Promise((res) => setTimeout(res, 1200)); }

  console.log("\n" + "=".repeat(90));
  console.log("MERCHANT PAGES (" + merchantPages.length + ")");
  console.log("=".repeat(90));
  const merchantResults = [];
  for (const p of merchantPages) { const r = await scan(p, merchantCookie); merchantResults.push(r); printResult(r); await new Promise((res) => setTimeout(res, 1200)); }

  console.log("\n" + "=".repeat(90));
  console.log("SUMMARY");
  console.log("=".repeat(90));
  const all = [...adminResults, ...merchantResults];
  const ok = all.filter((r) => r.ok).length;
  const broken = all.filter((r) => !r.ok);
  console.log(`OK: ${ok}/${all.length} | BROKEN: ${broken.length}`);
  if (broken.length) {
    console.log("\n--- BROKEN PAGES ---");
    broken.forEach((r) => console.log(`  ${r.status === 0 ? "CRASH" : r.status} ${r.isLogin ? "REDIR-LOGIN" : ""} ${r.path}  ${r.errors.length ? "[" + r.errors.join(", ") + "]" : ""}`));
  }
}

function printResult(r) {
  const flag = r.ok ? "✓ OK " : r.isLogin ? "⚠ LOGIN" : r.status === 500 ? "✗ ERR " : "✗ BROKEN";
  const errStr = r.errors.length ? `  ⚑ ${r.errors.join("; ")}` : "";
  console.log(`  ${flag} ${String(r.status).padEnd(4)} ${(r.size + "b").padStart(7)}  ${r.path}${errStr}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
