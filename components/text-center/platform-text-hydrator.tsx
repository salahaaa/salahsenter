"use client";

import { useEffect } from "react";
import { PLATFORM_TEXT_CATALOG } from "@/lib/text-center/catalog";

const ignoredTags = new Set(["SCRIPT", "STYLE", "TEXTAREA", "OPTION"]);

function normalized(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Applies published catalog copy to legacy/static client markup. New features
 * should use server-side bindings or resolvePlatformText directly; this bridge
 * keeps existing visible UI centrally editable during the controlled migration.
 */
export function PlatformTextHydrator({ values }: { values: Record<string, string> }) {
  useEffect(() => {
    const replacements = new Map<string, string>();
    for (const entry of PLATFORM_TEXT_CATALOG) {
      const value = values[entry.key];
      if (value != null && value !== entry.defaultValue) replacements.set(normalized(entry.defaultValue), value);
    }
    if (!replacements.size) return;

    const replaceNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement;
        if (!parent || ignoredTags.has(parent.tagName)) return;
        const next = replacements.get(normalized(node.textContent || ""));
        if (next != null) node.textContent = next;
        return;
      }
      if (!(node instanceof Element)) return;
      for (const attribute of ["placeholder", "aria-label", "title", "alt"]) {
        const current = node.getAttribute(attribute);
        const next = current ? replacements.get(normalized(current)) : undefined;
        if (next != null) node.setAttribute(attribute, next);
      }
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      const textNodes: Node[] = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      textNodes.forEach(replaceNode);
    };

    replaceNode(document.body);
    const observer = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach(replaceNode)));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [values]);

  return null;
}
