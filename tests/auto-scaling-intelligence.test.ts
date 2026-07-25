import { describe, expect, it } from "vitest";
import { calculateScalingDecision, defaultScalingPolicy, type DesiredScalingState, type ScalingSignals } from "@/lib/scaling/auto-scaling-intelligence";

function current(): DesiredScalingState {
  return { apiInstances: 2, queueWorkers: 2, workerBatchLimit: 25, redisMode: "normal", loadBalancingMode: "normal", updatedAt: new Date().toISOString() };
}

function healthySignals(): ScalingSignals {
  return {
    cpuUsagePercent: 18,
    memoryUsagePercent: 35,
    queueLength: 2,
    stuckJobs: 0,
    failedJobs: 0,
    concurrentRequestsEstimate: 1,
    requestsLast5m: 120,
    apiRequestsLast5m: 40,
    responseTimeP95Ms: 180,
    dbConnectionsUsagePercent: 15,
    redisStatus: "operational",
    uploadStatus: "operational",
    healthScore: 96,
    downServices: 0,
    slowServices: 0
  };
}

describe("auto scaling intelligence", () => {
  it("scales out when queue and latency are high", () => {
    const decision = calculateScalingDecision({
      current: current(),
      policy: defaultScalingPolicy(),
      signals: { ...healthySignals(), queueLength: 90, responseTimeP95Ms: 1600, cpuUsagePercent: 74 }
    });
    expect(decision.direction).toBe("scale_out");
    expect(decision.desired.apiInstances).toBeGreaterThan(decision.current.apiInstances);
    expect(decision.desired.queueWorkers).toBeGreaterThan(decision.current.queueWorkers);
    expect(decision.actions.some((action) => action.type === "queue_workers")).toBe(true);
  });

  it("enters emergency mode under critical pressure", () => {
    const policy = defaultScalingPolicy();
    const decision = calculateScalingDecision({
      current: current(),
      policy,
      signals: { ...healthySignals(), cpuUsagePercent: 96, memoryUsagePercent: 94, queueLength: 350, responseTimeP95Ms: 4000 }
    });
    expect(decision.direction).toBe("emergency");
    expect(decision.emergencyMode).toBe(true);
    expect(decision.desired.apiInstances).toBe(policy.maxApiInstances);
    expect(decision.desired.loadBalancingMode).toBe("emergency");
  });

  it("scales in under consistently low load", () => {
    const decision = calculateScalingDecision({ current: { ...current(), apiInstances: 3, queueWorkers: 3, workerBatchLimit: 40 }, policy: defaultScalingPolicy(), signals: healthySignals() });
    expect(decision.direction).toBe("scale_in");
    expect(decision.desired.apiInstances).toBeLessThan(decision.current.apiInstances);
    expect(decision.desired.queueWorkers).toBeLessThan(decision.current.queueWorkers);
  });
});
