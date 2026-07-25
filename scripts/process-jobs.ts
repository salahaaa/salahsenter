import "dotenv/config";
import { processDueJobs } from "../lib/queue/processor";
import { getAutoScalingRuntimeHints } from "../lib/scaling/auto-scaling-intelligence";

function argValue(name: string) {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
}

async function main() {
  const scalingHints = await getAutoScalingRuntimeHints().catch(() => null);
  const explicitLimit = argValue("limit");
  const explicitQueue = argValue("queue");
  const limit = Number(explicitLimit || process.env.JOBS_PROCESS_LIMIT || scalingHints?.workerBatchLimit || 25);
  const queue = process.env.JOBS_QUEUE || explicitQueue || "default";
  const loop = process.argv.includes("--loop") || process.env.JOBS_LOOP === "true";
  const intervalMs = Number(process.env.JOBS_LOOP_INTERVAL_MS || scalingHints?.loopIntervalMs || 5000);

  do {
    const summary = await processDueJobs({ limit, queue });
    console.log(JSON.stringify({ ts: new Date().toISOString(), queue, scalingHints, summary }));
    if (!loop) break;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (true);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
