"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function isSameOriginNavigableAnchor(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
  if (!anchor) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return null;
  return url;
}

export function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  function start() {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    setActive(true);
    timeoutRef.current = window.setTimeout(() => setActive(false), 9000);
  }

  function finish() {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setActive(false), 180);
  }

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (isModifiedClick(event)) return;
      const url = isSameOriginNavigableAnchor(event.target);
      if (!url) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    }

    function onSubmit(event: SubmitEvent) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const method = (form.method || "get").toLowerCase();
      if (method === "get" || form.dataset.progress === "true") start();
    }

    function onPopState() {
      start();
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
  }, []);

  return (
    <div aria-hidden="true" className={`fixed inset-x-0 top-0 z-[9999] h-1 overflow-hidden transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0"}`}>
      <div className="navigation-progress-bar h-full w-1/2 rounded-l-full bg-gradient-to-l from-blue-600 via-cyan-400 to-amber-300 shadow-[0_0_18px_rgba(59,130,246,.65)]" />
    </div>
  );
}
