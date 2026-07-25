// Minimal test: verify fetch to running server works.
const BASE = "http://localhost:3000";
console.log("PING TEST: fetching homepage...");
try {
  const r = await fetch(BASE + "/");
  const html = await r.text();
  console.log(`  status=${r.status} size=${html.length}`);
  console.log("PING TEST: OK");
} catch (e) {
  console.log("PING TEST: FAILED -", e.message);
}
process.exit(0);
