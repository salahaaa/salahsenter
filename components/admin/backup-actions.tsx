"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Download, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

function restoreInputs(fileName: string) {
  const confirmation = window.prompt(`هذه العملية تستبدل البيانات الحالية. اكتب بالضبط:\nRESTORE ${fileName}`);
  if (confirmation !== `RESTORE ${fileName}`) return null;
  const approvalToken = window.prompt("أدخل رمز اعتماد الاستعادة إن كانت بيئة الإنتاج في maintenance mode (اتركه فارغاً خارج الإنتاج):") || "";
  return { confirmation, approvalToken };
}

export function CreateBackupButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function create() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/backups", { method: "POST" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) return alert(json.message || "تعذر إنشاء النسخة");
      const backup = json.data?.backup;
      alert(`✓ تم إنشاء نسخة احتياطية آمنة: ${backup?.fileName || ""}. استخدم زر التنزيل عند الحاجة.`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }
  return <Button onClick={create} disabled={loading}><Download className="h-4 w-4" /> {loading ? "جارٍ الإنشاء..." : "إنشاء نسخة"}</Button>;
}

export function RestoreBackupButton({ file }: { file: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function restore() {
    const input = restoreInputs(file);
    if (!input) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/backups/${file}/restore`, {
        method: "POST",
        headers: { "x-backup-restore-confirmation": input.confirmation, "x-backup-restore-approval": input.approvalToken }
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) return alert(json.message || "تعذر الاستعادة");
      alert("✓ تم إنشاء نسخة أمان ثم استعادة النسخة الاحتياطية.");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }
  return <Button size="sm" variant="outline" onClick={restore} disabled={loading}>{loading ? "..." : "استعادة"}</Button>;
}

export function RestoreBackupUploadButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function restoreFromFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const input = restoreInputs(file.name);
    if (!input) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("confirmation", input.confirmation);
      form.append("approvalToken", input.approvalToken);
      const response = await fetch("/api/admin/backups/restore", { method: "POST", body: form });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) return alert(json.message || "تعذر الاستعادة من الملف");
      alert(`✓ تم إنشاء نسخة أمان ثم الاستعادة. الجداول: ${json.data?.tables || 0}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" className="relative overflow-hidden" disabled={loading}>
      <UploadCloud className="h-4 w-4" /> {loading ? "جارٍ الاستعادة..." : "استعادة من ملف"}
      <input type="file" accept="application/json,.json" onChange={restoreFromFile} className="absolute inset-0 cursor-pointer opacity-0" disabled={loading} />
    </Button>
  );
}
