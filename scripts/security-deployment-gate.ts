import { getAdminProtectionSnapshot } from "@/lib/admin/platform-protection-center";

async function main() {
  const snapshot = await getAdminProtectionSnapshot({ persist: process.env.SECURITY_GATE_PERSIST === "true" });
  const gate = snapshot.deploymentGate;
  console.log(JSON.stringify({
    allowed: gate.allowed,
    score: snapshot.score,
    grade: snapshot.grade,
    blockers: gate.blockers,
    warnings: gate.warnings,
    checkedAt: gate.checkedAt
  }, null, 2));
  if (!gate.allowed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
