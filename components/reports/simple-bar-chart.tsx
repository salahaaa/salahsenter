export function SimpleBarChart({ data, labelSuffix = "" }: { data: Array<{ label: string; value: number }>; labelSuffix?: string }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="rounded-3xl border bg-white p-6 shadow-card">
      <div className="flex h-72 items-end gap-3">
        {data.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="text-xs font-bold text-slate-500">{Intl.NumberFormat("ar").format(item.value)}{labelSuffix}</div>
            <div className="w-full rounded-t-2xl bg-gradient-to-t from-blue-600 to-cyan-400" style={{ height: `${Math.max(8, (item.value / max) * 220)}px` }} />
            <div className="w-full truncate text-center text-xs font-bold text-slate-500">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
