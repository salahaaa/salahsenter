export type ImpressionQualityInput = {
  userAgent?: string | null;
  viewableMs?: number | null;
  viewportRatio?: number | null;
  sameVisitorRecentImpressions: number;
  sameIpRecentImpressions: number;
};

export type ImpressionQualityAssessment = {
  score: number;
  status: "clean" | "suspected" | "invalid";
  billable: boolean;
  reasons: string[];
};

/** Conservative CPM quality guard. It stores only aggregate velocity and
 * hashed-network evidence supplied by the caller, never raw browser IDs/IPs. */
export function assessAdImpressionQuality(input: ImpressionQualityInput): ImpressionQualityAssessment {
  const reasons: string[] = [];
  const userAgent = (input.userAgent || "").toLowerCase();
  let score = 0;
  if (!userAgent.trim()) { score += 20; reasons.push("missing_user_agent"); }
  if (/(bot|crawler|spider|headless|phantomjs|selenium|playwright|puppeteer|curl|wget)/i.test(userAgent)) { score += 100; reasons.push("automation_user_agent"); }
  if (Number(input.viewableMs || 0) < 900) { score += 45; reasons.push("insufficient_viewable_duration"); }
  if (Number(input.viewportRatio || 0) < 0.5) { score += 35; reasons.push("insufficient_viewport_ratio"); }
  if (input.sameVisitorRecentImpressions >= 8) { score += Math.min(35, 12 + (input.sameVisitorRecentImpressions - 8) * 4); reasons.push("visitor_impression_velocity"); }
  if (input.sameIpRecentImpressions >= 15) { score += Math.min(30, 10 + (input.sameIpRecentImpressions - 15) * 2); reasons.push("network_impression_velocity"); }
  score = Math.min(100, score);
  const status = score >= 85 ? "invalid" : score >= 45 ? "suspected" : "clean";
  return { score, status, billable: status === "clean", reasons };
}

export function impressionQualityEvidence(input: ImpressionQualityInput, assessment: ImpressionQualityAssessment) {
  return {
    score: assessment.score,
    status: assessment.status,
    reasons: assessment.reasons,
    viewableMs: Number(input.viewableMs || 0),
    viewportRatio: Number(input.viewportRatio || 0),
    sameVisitorRecentImpressions: input.sameVisitorRecentImpressions,
    sameIpRecentImpressions: input.sameIpRecentImpressions,
    userAgentPresent: Boolean(input.userAgent?.trim())
  };
}
