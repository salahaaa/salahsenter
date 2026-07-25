// Benchmark measurement: calls each of the 6 APIs with auth, prints payload size + timing.
// Run: npx tsx scripts/bench-measure.ts
const BASE = "http://localhost:3000";

async function login(email: string, password: string) {
  // get csrf cookie
  const r0 = await fetch(BASE + "/");
  const setCookie = r0.headers.get("set-cookie") || "";
  const csrfMatch = setCookie.match(/mall_csrf=([^;]+)/);
  const csrf = csrfMatch ? csrfMatch[1] : "";
  const cookieJar = setCookie.split(",").map((c) => c.split(";")[0].trim()).join("; ");
  const r1 = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrf, "x-requested-with": "XMLHttpRequest", cookie: cookieJar },
    body: JSON.stringify({ email, password })
  });
  const sc = r1.headers.get("set-cookie") || "";
  const sessionMatch = sc.match(/mall_session=([^;]+)/);
  const csrfMatch2 = sc.match(/mall_csrf=([^;]+)/);
  return [sessionMatch ? `mall_session=${sessionMatch[1]}` : "", csrfMatch2 ? `mall_csrf=${csrfMatch2[1]}` : csrf ? `mall_csrf=${csrf}` : ""].filter(Boolean).join("; ");
}

async function measure(label: string, path: string, cookie: string) {
  const t0 = performance.now();
  const r = await fetch(BASE + path, { headers: { cookie } });
  const t1 = performance.now();
  const buf = Buffer.from(await r.arrayBuffer());
  const ms = Math.round(t1 - t0);
  const kb = (buf.length / 1024).toFixed(1);
  // detect base64 in payload
  const text = buf.toString("utf8");
  const hasBase64 = /data:image\/[a-zA-Z0-9.+-]+;base64,/.test(text);
  const base64Count = (text.match(/data:image\/[a-zA-Z0-9.+-]+;base64,/g) || []).length;
  const status = r.status;
  // try to get array length
  let arrLen = "-";
  try {
    const json = JSON.parse(text);
    const d = json.data || json;
    const key = Object.keys(d).find((k) => Array.isArray(d[k]));
    if (key) arrLen = String(d[key].length);
  } catch {}
  console.log(`${label.padEnd(28)} HTTP ${status}  ${String(ms).padStart(4)}ms  ${String(kb).padStart(8)} KB  base64×${String(base64Count).padStart(3)}  items=${arrLen}`);
  return { label, ms, kb, hasBase64, base64Count, status };
}

async function main() {
  console.log("Logging in as admin + customer...\n");
  const adminCookie = await login(process.env.TEST_ADMIN_EMAIL || "", process.env.TEST_ADMIN_PASSWORD || "");
  const custCookie = await login(process.env.TEST_CUSTOMER_EMAIL || "", process.env.TEST_CUSTOMER_PASSWORD || "");
  console.log("Logged in.\n");
  console.log("API".padEnd(28) + "  " + "time".padStart(7) + "  " + "payload".padStart(9) + "  base64    items");
  console.log("-".repeat(75));
  const results: any[] = [];
  results.push(await measure("admin/wings", "/api/admin/wings", adminCookie));
  results.push(await measure("admin/stores", "/api/admin/stores", adminCookie));
  results.push(await measure("merchant/products", "/api/merchant/products", adminCookie));
  results.push(await measure("merchant/inventory", "/api/merchant/inventory", adminCookie));
  results.push(await measure("orders (customer)", "/api/orders", custCookie));
  results.push(await measure("merchant-applications", "/api/merchant-applications", adminCookie));
  console.log("\n=== SUMMARY ===");
  const totalKb = results.reduce((s, r) => s + parseFloat(r.kb), 0);
  const totalB64 = results.reduce((s, r) => s + r.base64Count, 0);
  console.log(`Total payload across 6 APIs: ${totalKb.toFixed(1)} KB | base64 occurrences: ${totalB64}`);
  return results;
}

main().catch((e) => { console.error(e); process.exit(1); });
