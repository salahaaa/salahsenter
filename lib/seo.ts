export function publicOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://salahsentar22.vercel.app").replace(/\/$/, "");
}

export function absolutePublicUrl(path: string) {
  return `${publicOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function cleanDescription(value: string | null | undefined, fallback: string) {
  const text = String(value || fallback).replace(/\s+/g, " ").trim();
  return text.slice(0, 160) || fallback;
}
