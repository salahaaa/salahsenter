"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

type StoreChoice = { id: string; name: string; slug: string; storeNumber: string; status: string; isActive: boolean };

export function MerchantStoreSwitcher({ stores, selectedStoreId }: { stores: StoreChoice[]; selectedStoreId: string }) {
  const router = useRouter(); const [loading, setLoading] = useState(false); const [message, setMessage] = useState<string | null>(null);
  async function select(storeId: string) { if (storeId === selectedStoreId) return; setLoading(true); setMessage(null); try { const response = await fetch("/api/merchant/active-store", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId }) }); const json = await response.json().catch(() => ({})); if (!response.ok) throw new Error(json.message || "تعذر تغيير المتجر"); setMessage("تم تغيير المتجر النشط."); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر تغيير المتجر"); } finally { setLoading(false); } }
  if (!stores.length) return null;
  return <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur"><div className="flex flex-wrap items-center gap-2"><Store className="h-4 w-4 text-amber-300"/><span className="text-xs font-black text-white/70">المتجر النشط</span><select value={selectedStoreId} disabled={loading} onChange={(event) => void select(event.target.value)} className="min-w-52 rounded-xl border border-white/15 bg-slate-950/60 px-3 py-2 text-sm font-black text-white outline-none"><>{stores.map((store) => <option key={store.id} value={store.id}>{store.name} — {store.storeNumber}</option>)}</></select>{stores.length > 1 ? <Button asChild size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white"><Link href="/merchant/branches">المحلات والفروع <ChevronDown className="h-4 w-4"/></Link></Button> : null}</div>{message ? <p className="mt-2 text-xs font-bold text-emerald-200">{message}</p> : null}</div>;
}
