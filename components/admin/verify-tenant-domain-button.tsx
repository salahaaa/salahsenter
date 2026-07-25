"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function VerifyTenantDomainButton({ domainId }: { domainId: string }) {
  const router = useRouter(); const [loading, setLoading] = useState(false);
  async function verify() {
    setLoading(true);
    const response = await fetch(`/api/admin/tenants/domains/${domainId}/verify`, { method: "POST" });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) return alert(json.message || "لم يكتمل التحقق");
    alert("تم التحقق من الدومين وتفعيله"); router.refresh();
  }
  return <Button type="button" size="sm" variant="outline" disabled={loading} onClick={verify}>{loading ? "يتحقق..." : "تحقق من DNS"}</Button>;
}
