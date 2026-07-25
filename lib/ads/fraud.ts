export type ClickFraudAssessmentInput = {
  userAgent?: string | null;
  sameVisitorRecentClicks: number;
  sameIpRecentClicks: number;
};

export type ClickFraudAssessment = {
  score: number;
  status: "clean" | "suspected" | "invalid";
  billable: boolean;
  reasons: string[];
};

/**
 * Conservative, explainable first-line bot/click-quality policy. It never
 * stores raw IPs or browser IDs: the caller only supplies aggregate counts and
 * a request user-agent. `suspected` is retained for review but not billed.
 */
export function assessAdClickFraud(input: ClickFraudAssessmentInput): ClickFraudAssessment {
  const reasons: string[] = [];
  const userAgent = (input.userAgent || "").toLowerCase();
  let score = 0;

  if (!userAgent.trim()) {
    score += 20;
    reasons.push("missing_user_agent");
  }
  if (/(bot|crawler|spider|headless|phantomjs|selenium|playwright|puppeteer|curl|wget)/i.test(userAgent)) {
    score += 100;
    reasons.push("automation_user_agent");
  }
  if (input.sameVisitorRecentClicks >= 3) {
    score += Math.min(45, 15 + (input.sameVisitorRecentClicks - 3) * 10);
    reasons.push("visitor_click_velocity");
  }
  if (input.sameIpRecentClicks >= 4) {
    score += Math.min(40, 15 + (input.sameIpRecentClicks - 4) * 8);
    reasons.push("network_click_velocity");
  }

  score = Math.min(100, score);
  const status = score >= 85 ? "invalid" : score >= 45 ? "suspected" : "clean";
  return { score, status, billable: status === "clean", reasons };
}

export function fraudAssessmentEvidence(input: ClickFraudAssessmentInput, assessment: ClickFraudAssessment) {
  return {
    score: assessment.score,
    status: assessment.status,
    reasons: assessment.reasons,
    sameVisitorRecentClicks: input.sameVisitorRecentClicks,
    sameIpRecentClicks: input.sameIpRecentClicks,
    userAgentPresent: Boolean(input.userAgent?.trim())
  };
}
