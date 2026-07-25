/** True while Next compiles/builds routes. Runtime DB reads must not run here. */
export function isNextProductionBuildPhase() {
  return process.env.NEXT_PHASE === "phase-production-build";
}
