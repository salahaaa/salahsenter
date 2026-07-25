"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StoreLinkActions({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const href = `/store/${slug}`;

  async function copyLink() {
    const url = `${window.location.origin}${href}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button asChild variant="secondary"><Link href={href}><ExternalLink className="h-4 w-4" /> فتح رابط المتجر</Link></Button>
      <Button type="button" variant="outline" className="border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={copyLink}>
        <Copy className="h-4 w-4" /> {copied ? "تم نسخ الرابط" : "نسخ رابط المتجر"}
      </Button>
    </div>
  );
}
