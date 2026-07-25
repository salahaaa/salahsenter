import { and, eq } from "drizzle-orm";
import { db, systemSettings } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { getRequestTenantContext } from "@/lib/tenancy/context";

export async function ThemeStyle() {
  if (!hasDatabase()) return null;
  try {
    const [[setting], tenantContext] = await Promise.all([
      db.select().from(systemSettings).where(and(eq(systemSettings.group, "theme"), eq(systemSettings.key, "global"))).limit(1),
      getRequestTenantContext()
    ]);
    const theme = { ...((setting?.value || {}) as Record<string, string>), ...((tenantContext?.theme?.config || {}) as Record<string, string>) };
    const css = buildSafeThemeCss(theme);
    return css ? <style id="enterprise-theme">{css}</style> : null;
  } catch {
    return null;
  }
}

export function buildSafeThemeCss(theme: Record<string, string>) {
  const rootVariables = [
    cssVariable("--primary", hexToHsl(theme.primaryColor)),
    cssVariable("--background", hexToHsl(theme.backgroundColor)),
    cssVariable("--foreground", hexToHsl(theme.textColor)),
    cssVariable("--card", hexToHsl(theme.cardColor)),
    cssVariable("--border", hexToHsl(theme.borderColor)),
    cssVariable("--secondary", hexToHsl(theme.secondaryColor)),
    cssVariable("--success", hexToHsl(theme.successColor)),
    cssVariable("--warning", hexToHsl(theme.warningColor)),
    cssVariable("--danger", hexToHsl(theme.dangerColor)),
    cssVariable("--radius", sanitizeRadius(theme.radius)),
    cssVariable("--experience-spacing", sanitizeSpacing(theme.spacing)),
    cssVariable("--experience-shadow", sanitizeShadow(theme.shadow))
  ].filter(Boolean).join("");

  const font = sanitizeFontFamily(theme.fontPrimary);
  const secondaryFont = sanitizeFontFamily(theme.fontSecondary);
  const bodyCss = `${font ? `body{font-family:${font}, system-ui, sans-serif;}` : ""}${secondaryFont ? `h1,h2,h3{font-family:${secondaryFont},${font || "system-ui"},sans-serif;}` : ""}`;
  return `${rootVariables ? `:root{${rootVariables}}` : ""}${bodyCss}`;
}

function cssVariable(name: string, value?: string | null) {
  return value ? `${name}:${value};` : "";
}

function sanitizeRadius(value?: string | null) {
  if (!value) return null;
  const clean = value.trim();
  return /^(\d+(\.\d+)?)(px|rem|em|%)$/.test(clean) ? clean : null;
}

function sanitizeSpacing(value?: string | null) {
  if (!value) return null;
  const clean = value.trim();
  return /^(\d+(\.\d+)?)(px|rem|em)$/.test(clean) ? clean : null;
}

function sanitizeShadow(value?: string | null) {
  if (!value) return null;
  const clean = value.trim();
  return /^[0-9a-zA-Z#(),.%\s-]{1,120}$/.test(clean) ? clean : null;
}

function sanitizeFontFamily(value?: string | null) {
  if (!value) return null;
  const clean = value.trim();
  if (!/^[\p{L}\p{N}\s,'-]{1,80}$/u.test(clean)) return null;
  return clean
    .split(",")
    .map((part) => part.trim().replace(/[";]/g, ""))
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => `'${part.replace(/'/g, "")}'`)
    .join(",");
}

function hexToHsl(hex?: string | null) {
  if (!hex) return null;
  const clean = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
