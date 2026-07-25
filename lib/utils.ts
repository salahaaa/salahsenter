import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number | string | null | undefined) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("ar", { maximumFractionDigits: 1 }).format(num);
}

export function formatCurrency(value: number | string | null | undefined, currency = "YER") {
  const num = Number(value || 0);
  return new Intl.NumberFormat("ar", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(num);
}

export function getInitials(name?: string | null) {
  if (!name) return "م";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
