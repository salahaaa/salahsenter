export type AiProviderName = "rules" | "openai" | "gemini";
export type AiGatewayResult = { text: string; provider: AiProviderName; model: string | null; external: boolean; safetyMode: "approval_required" };

/** Provider-neutral gateway. Secrets remain only in environment variables. */
export async function generateAiText(input: { system: string; prompt: string; fallback: string; maxOutputChars?: number }): Promise<AiGatewayResult> {
  const provider = (process.env.AI_PROVIDER || "rules").toLowerCase() as AiProviderName;
  const max = Math.max(300, Math.min(input.maxOutputChars || 2_000, 8_000));
  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    try {
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model, temperature: 0.2, max_tokens: Math.ceil(max / 3), messages: [{ role: "system", content: input.system }, { role: "user", content: input.prompt }] }) });
      const payload = await response.json(); const text = payload?.choices?.[0]?.message?.content;
      if (response.ok && typeof text === "string" && text.trim()) return { text: text.slice(0, max), provider: "openai", model, external: true, safetyMode: "approval_required" };
    } catch { /* fall through to deterministic mode */ }
  }
  if (provider === "gemini" && process.env.GEMINI_API_KEY) {
    try {
      const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: `${input.system}\n\n${input.prompt}` }] }], generationConfig: { temperature: 0.2, maxOutputTokens: Math.ceil(max / 3) } }) });
      const payload = await response.json(); const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (response.ok && typeof text === "string" && text.trim()) return { text: text.slice(0, max), provider: "gemini", model, external: true, safetyMode: "approval_required" };
    } catch { /* fall through */ }
  }
  return { text: input.fallback.slice(0, max), provider: "rules", model: null, external: false, safetyMode: "approval_required" };
}

export function aiProviderHealth() { const requested=(process.env.AI_PROVIDER||"rules").toLowerCase(); return { requested, active: requested === "openai" && Boolean(process.env.OPENAI_API_KEY) ? "openai" : requested === "gemini" && Boolean(process.env.GEMINI_API_KEY) ? "gemini" : "rules", approvalRequired: true }; }
