"use client";

const VISITOR_KEY = "salah_center_funnel_visitor";

function visitorId() {
  if (typeof window === "undefined") return null;
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || `visitor_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export function trackFunnelEvent(input: { eventType: "product_view" | "add_to_cart" | "checkout_started" | "product_recommendation_click"; storeId?: string | null; productId?: string | null; metadata?: Record<string, unknown> }) {
  if (typeof window === "undefined") return;
  void fetch("/api/analytics/funnel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, visitorId: visitorId() }),
    keepalive: true
  }).catch(() => undefined);
}
