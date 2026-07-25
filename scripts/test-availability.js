// Standalone verification of the variant-availability matrix logic.
// Simulates a product with two attributes (العبوة × اللون) and proves that
// unavailable combos are detected and sold-out combos are flagged separately.
// Run: node scripts/test-availability.js

function buildAvailability(attributeNames, currentAttributes, variants) {
  const matrix = new Map();
  for (const attr of attributeNames) {
    const inner = new Map();
    for (const variant of variants) {
      const matchesOthers = Object.entries(currentAttributes)
        .filter(([key]) => key !== attr)
        .every(([key, val]) => variant.attributes?.[key] === val);
      if (!matchesOthers) continue;
      const value = variant.attributes?.[attr];
      if (value == null) continue;
      const entry = inner.get(value) || { exists: false, inStock: false };
      entry.exists = true;
      if ((variant.stockQuantity || 0) > 0) entry.inStock = true;
      inner.set(value, entry);
    }
    matrix.set(attr, inner);
  }
  return matrix;
}

// Scenario: product "تيشيرت" with:
//   العبوة: حبة, كرتون
//   اللون: أحمر, أزرق, أخضر
// Variants (only 4 of the 6 possible combos exist):
//   حبة+أحمر   stock 10   ✓ in stock
//   حبة+أزرق   stock 0    ✗ sold out (exists, no stock)
//   كرتون+أحمر stock 5    ✓ in stock
//   كرتون+أخضر stock 3    ✓ in stock
// MISSING combos: حبة+أخضر, كرتون+أزرق
const variants = [
  { attributes: { "العبوة": "حبة", "اللون": "أحمر" }, stockQuantity: 10 },
  { attributes: { "العبوة": "حبة", "اللون": "أزرق" }, stockQuantity: 0 },
  { attributes: { "العبوة": "كرتون", "اللون": "أحمر" }, stockQuantity: 5 },
  { attributes: { "العبوة": "كرتون", "اللون": "أخضر" }, stockQuantity: 3 }
];
const attributeNames = ["العبوة", "اللون"];

let pass = 0, fail = 0;
function check(label, cond) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); }
}

console.log("=== TEST 1: shopper selects العبوة=حبة ===");
{
  const currentAttributes = { "العبوة": "حبة" }; // اللون not yet chosen
  const matrix = buildAvailability(attributeNames, currentAttributes, variants);
  const colors = matrix.get("اللون");
  check("أحمر exists & inStock", colors.get("أحمر")?.exists === true && colors.get("أحمر")?.inStock === true);
  check("أزرق exists but sold out", colors.get("أزرق")?.exists === true && colors.get("أزرق")?.inStock === false);
  // أخضر should be UNAVAILABLE: either absent from map or exists=false (UI treats both as disabled)
  const akhdar = colors.get("أخضر");
  check("أخضر unavailable (absent or exists=false)", !akhdar || akhdar.exists === false);
}

console.log("\n=== TEST 2: shopper selects العبوة=كرتون ===");
{
  const currentAttributes = { "العبوة": "كرتون" };
  const matrix = buildAvailability(attributeNames, currentAttributes, variants);
  const colors = matrix.get("اللون");
  check("أحمر inStock", colors.get("أحمر")?.inStock === true);
  check("أخضر inStock", colors.get("أخضر")?.inStock === true);
  const azraq = colors.get("أزرق");
  check("أزرق unavailable with كرتون", !azraq || azraq.exists === false);
}

console.log("\n=== TEST 3: shopper selects اللون=أحمر → which packs available? ===");
{
  const currentAttributes = { "اللون": "أحمر" };
  const matrix = buildAvailability(attributeNames, currentAttributes, variants);
  const packs = matrix.get("العبوة");
  check("حبة available", packs.get("حبة")?.exists === true && packs.get("حبة")?.inStock === true);
  check("كرتون available", packs.get("كرتون")?.exists === true && packs.get("كرتون")?.inStock === true);
}

console.log("\n=== TEST 4: no selection yet (default first variant) ===");
{
  const currentAttributes = variants[0].attributes; // {العبوة:حبة, اللون:أحمر}
  const matrix = buildAvailability(attributeNames, currentAttributes, variants);
  const colors = matrix.get("اللون");
  check("with حبة selected: أحمر available", colors.get("أحمر")?.inStock === true);
  check("with حبة selected: أزرق sold out", colors.get("أزرق")?.exists === true && colors.get("أزرق")?.inStock === false);
}

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
