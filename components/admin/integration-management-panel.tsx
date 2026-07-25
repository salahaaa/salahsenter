"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type StoreOption = { id: string; name: string; slug: string };
type IntegrationData = {
  clients: Array<{ id: string; clientKey: string; name: string; provider: string; status: string; storeIds: string[]; scopes: string[]; metadata: Record<string, unknown>; lastSeenAt: string | null; createdAt: string }>;
  devices: Array<{ id: string; clientKey: string; deviceId: string; deviceName: string | null; storeId: string | null; status: string; connectorType: string | null; lastSeenAt: string | null; lastHeartbeat: Record<string, unknown> }>;
  mappings: Array<{ id: string; clientKey: string; name: string; systemType: string; resource: string; direction: string; version: number; isActive: boolean; mapping: Record<string, unknown>; sourceOfTruth: Record<string, unknown>; conflictPolicy: Record<string, unknown> }>;
  events: Array<{ id: string; eventType: string; entityType: string; storeId: string | null; status: string; direction: string; createdAt: string }>;
  syncRuns: Array<{ id: string; clientKey: string; deviceId: string | null; resource: string; direction: string; status: string; counters: Record<string, number>; startedAt: string; finishedAt: string | null }>;
  entityLinkCount: number;
  stores: StoreOption[];
};

const scopeOptions = ["products:read", "products:write", "inventory:read", "inventory:write", "orders:read", "orders:write", "invoices:read", "invoices:write", "events:read", "events:write", "sales_reports:write"];
const resources = ["products", "inventory", "orders", "invoices", "returns", "events"];
const systems = ["sql_server", "access", "odbc", "csv_excel", "pos", "desktop_erp", "generic"];

export function IntegrationManagementPanel({ initial }: { initial: IntegrationData }) {
  const router = useRouter();
  const [data] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ clientKey: string; apiKey: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function createClient(formData: FormData) {
    setLoading(true);
    setSecret(null);
    const storeIds = formData.getAll("storeIds").map(String).filter(Boolean);
    const scopes = formData.getAll("scopes").map(String).filter(Boolean);
    const response = await fetch("/api/admin/integrations/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientKey: formData.get("clientKey"),
        name: formData.get("name"),
        systemType: formData.get("systemType"),
        storeIds,
        scopes,
        metadata: { note: formData.get("note") || undefined }
      })
    });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    if (response.ok) {
      setSecret({ clientKey: json.data.client.clientKey, apiKey: json.data.apiKey });
      setMessage("✓ تم إنشاء عميل التكامل. انسخ المفتاح الآن لأنه يظهر مرة واحدة فقط.");
      router.refresh();
    } else setMessage(json.message || "تعذر إنشاء عميل التكامل");
  }

  async function createMapping(formData: FormData) {
    setLoading(true);
    const response = await fetch("/api/admin/integrations/mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientKey: formData.get("clientKey"),
        storeId: formData.get("storeId") || undefined,
        name: formData.get("name"),
        systemType: formData.get("systemType"),
        resource: formData.get("resource"),
        direction: formData.get("direction"),
        mapping: JSON.parse(String(formData.get("mapping") || "{}")),
        sourceOfTruth: JSON.parse(String(formData.get("sourceOfTruth") || "{}")),
        conflictPolicy: JSON.parse(String(formData.get("conflictPolicy") || "{}"))
      })
    });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? "✓ تم إنشاء Mapping Profile" : json.message || "تعذر إنشاء Mapping Profile");
    if (response.ok) router.refresh();
  }

  async function rotateKey(id: string, clientKey: string) {
    if (!window.confirm("سيتم إبطال المفتاح القديم وإظهار مفتاح جديد مرة واحدة. هل تريد المتابعة؟")) return;
    setLoading(true);
    const response = await fetch(`/api/admin/integrations/clients/${id}/rotate-key`, { method: "POST" });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    if (response.ok) {
      setSecret({ clientKey, apiKey: json.data.apiKey });
      setMessage("✓ تم تدوير المفتاح. انسخه الآن.");
    } else setMessage(json.message || "تعذر تدوير المفتاح");
  }

  const defaultMapping = JSON.stringify({
    identity: { externalId: "ItemCode", externalCode: "ItemCode", barcode: "Barcode", sku: "ItemCode" },
    fields: { name: "ItemName", basePrice: "SalePrice", stockQuantity: "Quantity", updatedAt: "LastModified" },
    matching: { strategy: "external_id_first", allowNameFallback: false }
  }, null, 2);

  return (
    <div className="space-y-8">
      {message ? <div className="rounded-2xl border bg-white p-4 text-sm font-bold text-slate-700 shadow-card">{message}</div> : null}
      {secret ? <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 shadow-card"><h2 className="text-xl font-black text-amber-900">مفتاح API يظهر مرة واحدة فقط</h2><p className="mt-2 text-sm font-bold text-amber-800">Client Key: {secret.clientKey}</p><pre className="mt-3 overflow-auto rounded-2xl bg-white p-4 text-left text-sm text-slate-900">{secret.apiKey}</pre></section> : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={(event) => { event.preventDefault(); void createClient(new FormData(event.currentTarget)); }} className="rounded-[2rem] border bg-white p-6 shadow-card">
          <h2 className="mb-4 text-xl font-black text-slate-950">إنشاء Integration Client لمتجر/تاجر</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Client Key" name="clientKey" placeholder="store-abc-sql-agent" required />
            <Field label="الاسم" name="name" placeholder="Store ABC SQL Agent" required />
            <Select label="نوع ERP/POS" name="systemType" options={systems} />
            <Field label="ملاحظة" name="note" />
            <MultiSelect label="المتاجر المسموحة" name="storeIds" options={data.stores.map((store) => ({ value: store.id, label: store.name }))} />
            <MultiSelect label="الصلاحيات" name="scopes" options={scopeOptions.map((scope) => ({ value: scope, label: scope }))} />
          </div>
          <Button className="mt-5" disabled={loading}>إنشاء العميل وإصدار API Key</Button>
        </form>

        <form onSubmit={(event) => { event.preventDefault(); void createMapping(new FormData(event.currentTarget)); }} className="rounded-[2rem] border bg-white p-6 shadow-card">
          <h2 className="mb-4 text-xl font-black text-slate-950">إنشاء Mapping Profile</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Select label="Client" name="clientKey" options={data.clients.map((client) => ({ value: client.clientKey, label: client.clientKey }))} />
            <Field label="اسم Mapping" name="name" defaultValue="Products Mapping v1" required />
            <Select label="Store" name="storeId" options={[{ value: "", label: "كل المتاجر المسموحة" }, ...data.stores.map((store) => ({ value: store.id, label: store.name }))]} />
            <Select label="System" name="systemType" options={systems} />
            <Select label="Resource" name="resource" options={resources} />
            <Select label="Direction" name="direction" options={["local_to_platform", "platform_to_local", "bidirectional"]} />
            <JsonArea label="Mapping JSON" name="mapping" defaultValue={defaultMapping} />
            <JsonArea label="Source of Truth" name="sourceOfTruth" defaultValue={JSON.stringify({ inventory: "erp", invoice: "erp", accountingRevenuePosting: "erp", settlements: "platform", price: "merchant", productData: "platform", bankAccounts: "platform", customers: "platform" }, null, 2)} />
            <JsonArea label="Conflict Policy" name="conflictPolicy" defaultValue={JSON.stringify({ inventory: "erp_snapshot_wins", invoice: "erp_invoice_wins", price: "merchant_platform_wins", productData: "platform_wins", allowNameFallback: false }, null, 2)} />
          </div>
          <Button className="mt-5" disabled={loading}>حفظ Mapping Profile</Button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Stat title="Clients" value={data.clients.length} />
        <Stat title="Agents" value={data.devices.length} />
        <Stat title="Mappings" value={data.mappings.length} />
        <Stat title="Entity Links" value={data.entityLinkCount} />
      </section>

      <TablePanel title="Integration Clients">
        {data.clients.map((client) => <tr key={client.id} className="border-t"><td className="p-3 font-black">{client.clientKey}</td><td className="p-3">{client.name}</td><td className="p-3"><Badge variant={client.status === "active" ? "success" : "warning"}>{client.status}</Badge></td><td className="p-3 text-xs">{client.storeIds.length ? client.storeIds.length : "all"}</td><td className="p-3"><Button size="sm" variant="outline" onClick={() => rotateKey(client.id, client.clientKey)}>تدوير المفتاح</Button></td></tr>)}
      </TablePanel>

      <TablePanel title="Agent Devices">
        {data.devices.map((device) => <tr key={device.id} className="border-t"><td className="p-3 font-black">{device.clientKey}</td><td className="p-3">{device.deviceName || device.deviceId}</td><td className="p-3"><Badge variant={device.status === "online" ? "success" : device.status === "degraded" ? "warning" : "outline"}>{device.status}</Badge></td><td className="p-3">{device.connectorType || "-"}</td><td className="p-3 text-xs">{device.lastSeenAt || "never"}</td></tr>)}
      </TablePanel>

      <TablePanel title="Mapping Profiles">
        {data.mappings.map((profile) => <tr key={profile.id} className="border-t"><td className="p-3 font-black">{profile.clientKey}</td><td className="p-3">{profile.name}</td><td className="p-3">{profile.resource}</td><td className="p-3">v{profile.version}</td><td className="p-3"><Badge variant={profile.isActive ? "success" : "outline"}>{profile.systemType}</Badge></td></tr>)}
      </TablePanel>

      <TablePanel title="Recent Integration Events">
        {data.events.map((event) => <tr key={event.id} className="border-t"><td className="p-3 font-black">{event.eventType}</td><td className="p-3">{event.entityType}</td><td className="p-3"><Badge variant={event.status === "processed" ? "success" : event.status === "failed" ? "danger" : "warning"}>{event.status}</Badge></td><td className="p-3">{event.direction}</td><td className="p-3 text-xs">{event.createdAt}</td></tr>)}
      </TablePanel>
    </div>
  );
}

function Field({ label, name, required, placeholder, defaultValue }: { label: string; name: string; required?: boolean; placeholder?: string; defaultValue?: string }) {
  return <label className="space-y-2"><Label>{label}</Label><Input name={name} required={required} placeholder={placeholder} defaultValue={defaultValue} /></label>;
}

function Select({ label, name, options }: { label: string; name: string; options: Array<string | { value: string; label: string }> }) {
  return <label className="space-y-2"><Label>{label}</Label><select name={name} className="h-11 w-full rounded-xl border bg-white px-4 text-sm">{options.map((option) => typeof option === "string" ? <option key={option} value={option}>{option}</option> : <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function MultiSelect({ label, name, options }: { label: string; name: string; options: Array<{ value: string; label: string }> }) {
  return <label className="space-y-2 md:col-span-2"><Label>{label}</Label><select name={name} multiple className="min-h-32 w-full rounded-xl border bg-white px-4 py-3 text-sm">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function JsonArea({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return <label className="space-y-2 md:col-span-2"><Label>{label}</Label><Textarea name={name} defaultValue={defaultValue} className="min-h-36 font-mono text-xs" /></label>;
}

function Stat({ title, value }: { title: string; value: number }) {
  return <div className="rounded-3xl border bg-white p-5 shadow-card"><p className="text-sm font-bold text-slate-500">{title}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>;
}

function TablePanel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-[2rem] border bg-white p-6 shadow-card"><h2 className="mb-4 text-xl font-black text-slate-950">{title}</h2><div className="overflow-auto rounded-2xl border"><table className="w-full text-sm"><tbody>{children}</tbody></table></div></section>;
}
