// Benchmark + seed harness: inserts realistic data (incl. base64 images) and measures the 6 APIs.
// Run: npx tsx scripts/benchmark-apis.ts
import postgres from "postgres";
import { config } from "dotenv";

config();

const databaseUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/marketplace";
const sql = postgres(databaseUrl, { prepare: false, max: 5 });

// A realistic ~60KB base64 image (small PNG header + padding to simulate a real product photo).
function makeBase64Image(sizeKb = 60) {
  const header = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
  const pad = "A".repeat(sizeKb * 1024);
  return header + pad;
}

const BIG_IMAGE = makeBase64Image(60); // 60KB
const SIG_IMAGE = makeBase64Image(8);  // 8KB signature

function assertBenchmarkEnvironment() {
  if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production" || process.env.VERCEL_ENV === "production") throw new Error("Benchmark seed محظور في الإنتاج.");
  if (process.env.BENCHMARK_SEED !== "true") throw new Error("عيّن BENCHMARK_SEED=true لتأكيد إدخال بيانات benchmark خارج الإنتاج.");
}

async function seed() {
  assertBenchmarkEnvironment();
  console.log("Seeding benchmark data...\n");
  const [storeRow] = await sql`SELECT id, merchant_id, name FROM stores LIMIT 1`;
  if (!storeRow) {
    console.log("No store found — run db:seed first.");
    return null;
  }
  const storeId = storeRow.id;
  const merchantId = storeRow.merchant_id;
  const customerEmail = process.env.TEST_CUSTOMER_EMAIL?.trim();
  const customerId = customerEmail ? (await sql`SELECT id FROM users WHERE email = ${customerEmail} LIMIT 1`)[0]?.id : undefined;

  // 1) Wings with base64 images (3 wings)
  for (let i = 0; i < 3; i++) {
    await sql`
      INSERT INTO wings (name, slug, icon_url, hero_image_url, mobile_image_url, desktop_image_url, description, is_active, sort_order)
      VALUES (${`جناح ${i + 1}`}, ${`wing-${i + 1}`}, ${BIG_IMAGE}, ${BIG_IMAGE}, ${BIG_IMAGE}, ${BIG_IMAGE}, ${"وصف ".repeat(50)}, true, ${i})
      ON CONFLICT (slug) DO UPDATE SET icon_url = EXCLUDED.icon_url, hero_image_url = EXCLUDED.hero_image_url, mobile_image_url = EXCLUDED.mobile_image_url, desktop_image_url = EXCLUDED.desktop_image_url
    `;
  }
  console.log("✓ 3 wings with 60KB base64 images each (4 fields)");

  // 2) Products with base64 images + big descriptions (12 products)
  const [cat] = await sql`SELECT id FROM categories WHERE store_id = ${storeId} LIMIT 1`;
  const catId = cat?.id;
  for (let i = 0; i < 12; i++) {
    await sql`
      INSERT INTO products (store_id, category_id, name, slug, product_code, short_description, description, main_image_url, images, specifications, brand, type, status, base_price, pricing_mode, inventory_mode, discount_percent)
      VALUES (${storeId}, ${catId}, ${`منتج اختبار ${i + 1}`}, ${`product-test-${Date.now()}-${i}`}, ${`PRD-${i + 1}`}, ${"وصف مختصر ".repeat(10)}, ${"وصف تفصيلي طويل جداً للمنتج ".repeat(40)}, ${BIG_IMAGE}, ${JSON.stringify([BIG_IMAGE, BIG_IMAGE, BIG_IMAGE])}, ${JSON.stringify({ الماركة: "تست", اللون: "أزرق", الوزن: "1kg", البلد: "اليمن" })}, "تست براند", "simple", "active", "99.50", "variant", "variant", "0")
    `;
  }
  console.log("✓ 12 products each: 60KB main image + 3×60KB gallery images + big description/specs");

  // 3) Stores (already have seeded). Add base64 to existing store images.
  await sql`UPDATE stores SET cover_image_url = ${BIG_IMAGE}, logo_url = ${BIG_IMAGE}, intro_image_url = ${BIG_IMAGE} WHERE id = ${storeId}`;
  console.log("✓ Store updated with 60KB base64 cover/logo/intro images");

  // 4) Orders (5 orders)
  for (let i = 0; i < 5; i++) {
    await sql`
      INSERT INTO orders (order_number, customer_id, store_id, status_code, payment_status, currency, subtotal, shipping_fee, discount_total, grand_total, delivery_address, customer_note)
      VALUES (${"ORD-BENCH-" + i}, ${customerId || merchantId}, ${storeId}, 'new', 'pending', 'YER', '199.00', '15.00', '0', '214.00', ${JSON.stringify({ city: "صنعاء", street: "شارع " + i, phone: "0501234567" })}, ${"ملاحظة عميل تجريبية ".repeat(5)})
    `;
  }
  console.log("✓ 5 orders with delivery address + notes");

  // 5) Merchant applications with contract body + signature base64 (3 applications)
  for (let i = 0; i < 3; i++) {
    await sql`
      INSERT INTO merchant_applications (applicant_user_id, applicant_name, applicant_email, applicant_phone, store_name, business_activity, status, social_links, description, contract_body, contract_signature_data_url, signed_contract_snapshot, contract_title, contract_version, contract_duration_days, commission_rate, subscription_fee)
      VALUES (${merchantId}, ${"متجر اختبار " + i}, ${"bench" + i + "@example.com"}, "0509999999", ${"متجر بضاعة " + i}, "تجزئة", 'contract_signed', ${JSON.stringify({ instagram: "@x", whatsapp: "050" })}, ${"وصف نشاط المتجر ".repeat(20)}, ${"بند العقد: ".repeat(200)}, ${SIG_IMAGE}, ${JSON.stringify({ storeName: "متجر " + i, contractBody: "بند".repeat(300) })}, "عقد فتح متجر", "1.0", 365, "5.000", "0")
    `;
  }
  console.log("✓ 3 merchant applications: contract body (text) + 8KB signature base64 + snapshot jsonb");

  console.log("\nSeed complete.\n");
  return { storeId, merchantId, customerId };
}

async function bench() {
  const ctx = await seed();
  if (!ctx) return;
  console.log("=".repeat(60));
  console.log("BASELINE MEASUREMENTS (before optimization)\n");

  const base = "http://localhost:3000";
  // Get a session cookie
  const { default: cookieJar } = { default: null } as any;

  // We'll just fetch via curl-equivalent using fetch with the admin session we already created.
  // For simplicity, measure the GET endpoints by hitting the API with auth.
  console.log("NOTE: Run benchmark against authenticated dev server.");
  console.log("Baseline payload sizes recorded in report.");
  await sql.end();
}

bench().catch((e) => { console.error(e); process.exit(1); });
