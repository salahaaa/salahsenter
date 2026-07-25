"use client";

const STORAGE_KEY = "salah_center_product_comparison";
const MAX_PRODUCTS = 4;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function storage() {
  try { return window.sessionStorage; } catch { return null; }
}

export function readComparisonProducts() {
  try {
    const raw = storage()?.getItem(STORAGE_KEY) || "[]";
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === "string" && uuidPattern.test(id)))].slice(0, MAX_PRODUCTS) : [];
  } catch {
    return [];
  }
}

function persist(ids: string[]) {
  const normalized = [...new Set(ids.filter((id) => uuidPattern.test(id)))].slice(0, MAX_PRODUCTS);
  storage()?.setItem(STORAGE_KEY, JSON.stringify(normalized));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("salah-center-comparison-updated", { detail: normalized }));
  return normalized;
}

export function addComparisonProducts(...ids: string[]) {
  return persist([...readComparisonProducts(), ...ids]);
}

export function removeComparisonProduct(id: string) {
  return persist(readComparisonProducts().filter((current) => current !== id));
}

export function clearComparisonProducts() {
  return persist([]);
}
