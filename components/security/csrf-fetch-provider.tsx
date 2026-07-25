"use client";

import { useEffect } from "react";

const CSRF_COOKIE_NAME = "mall_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : null;
}

function isSameOrigin(input: RequestInfo | URL) {
  if (typeof window === "undefined") return false;
  const url = typeof input === "string" || input instanceof URL ? new URL(input, window.location.origin) : new URL(input.url, window.location.origin);
  return url.origin === window.location.origin;
}

export function CsrfFetchProvider() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    if ((window.fetch as typeof window.fetch & { __csrfPatched?: boolean }).__csrfPatched) return;

    const patchedFetch: typeof window.fetch & { __csrfPatched?: boolean } = async (input, init = {}) => {
      const method = (init.method || (input instanceof Request ? input.method : "GET") || "GET").toUpperCase();
      if (!MUTATING_METHODS.has(method) || !isSameOrigin(input)) return originalFetch(input, init);

      const token = readCookie(CSRF_COOKIE_NAME);
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
      if (token && !headers.has(CSRF_HEADER_NAME)) headers.set(CSRF_HEADER_NAME, token);
      if (!headers.has("x-requested-with")) headers.set("x-requested-with", "XMLHttpRequest");
      return originalFetch(input, { ...init, headers });
    };

    patchedFetch.__csrfPatched = true;
    window.fetch = patchedFetch;
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
