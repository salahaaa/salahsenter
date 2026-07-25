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
async function t(label, path, cookie) {
  const r = await fetch(BASE + path, { headers: { cookie } });
  const j = await r.json();
  const d = j.data || j;
  const info = {
    status: r.status,
    totalCount: d.totalCount ?? d.movementsTotalCount,
    hasNext: d.hasNext ?? d.movementsHasNext,
    page: d.page,
    items: (d.items || d.products || d.orders || d.applications || d.stores || d.wings || d.variants || []).length
  };
  console.log(`${label.padEnd(40)} ${JSON.stringify(info)}`);
}
async function main() {
  const mc = await login(process.env.TEST_MERCHANT_EMAIL || "", process.env.TEST_MERCHANT_PASSWORD || "");
  const ac = await login(process.env.TEST_ADMIN_EMAIL || "", process.env.TEST_ADMIN_PASSWORD || "");
  console.log("=== PAGINATION (products) ===");
  await t("products page=1 pageSize=5", "/api/merchant/products?page=1&pageSize=5", mc);
  await t("products page=2 pageSize=5", "/api/merchant/products?page=2&pageSize=5", mc);
  console.log("=== SEARCH (q=منتج) ===");
  await t("products search منتج", "/api/merchant/products?q=" + encodeURIComponent("منتج"), mc);
  console.log("=== FILTER ===");
  await t("products status=active", "/api/merchant/products?status=active", mc);
  console.log("=== STORES ===");
  await t("stores search SLH", "/api/admin/stores?q=SLH", ac);
  console.log("=== ORDERS ===");
  await t("orders status=new", "/api/orders?status=new", mc);
  console.log("=== APPS ===");
  await t("apps status=contract_signed", "/api/merchant-applications?status=contract_signed", ac);
  console.log("=== INVENTORY ===");
  await t("inventory page=1 size=2", "/api/merchant/inventory?page=1&pageSize=2", mc);
}
main().catch((e) => { console.error(e); process.exit(1); });
