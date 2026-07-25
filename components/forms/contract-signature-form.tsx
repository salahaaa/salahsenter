"use client";

import { useRef, useState, type FormEvent, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ContractSignatureForm({ applicationId, applicantName, contractVersion, token }: { applicationId: string; applicantName: string; contractVersion: string; token?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    setDrawing(true);
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasSignature(true);
  }

  function stop() {
    setDrawing(false);
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (!accepted) return setMessage("يجب الموافقة على العقد قبل الإرسال");
    if (!hasSignature) return setMessage("يرجى التوقيع داخل مربع التوقيع الإلكتروني");
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const signatureDataUrl = canvasRef.current!.toDataURL("image/png");
    setLoading(true);
    const response = await fetch(`/api/merchant-applications/${applicationId}/contract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepted: true, signerName: formData.get("signerName"), signatureDataUrl, contractVersion, token })
    });
    const json = await response.json();
    setLoading(false);
    setMessage(response.ok ? "✓ تم حفظ العقد والتوقيع. الطلب بانتظار الموافقة النهائية من الأدمن." : json.message || "تعذر حفظ التوقيع");
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border bg-white p-6 shadow-card">
      <div className="space-y-2">
        <Label htmlFor="signerName">اسم الموقّع</Label>
        <Input id="signerName" name="signerName" defaultValue={applicantName} required />
      </div>
      <div className="mt-5 space-y-2">
        <Label>مربع التوقيع الإلكتروني</Label>
        <canvas
          ref={canvasRef}
          width={760}
          height={240}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerLeave={stop}
          className="h-56 w-full touch-none rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50"
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={clear}>مسح التوقيع</Button>
        <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /> قرأت العقد وأوافق على جميع البنود
        </label>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <Button disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ العقد والتوقيع"}</Button>
        {message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}
      </div>
    </form>
  );
}
