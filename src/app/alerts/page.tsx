"use client";

import React, { useMemo, useState } from "react";
import { Bell, Check, CheckCheck, UserPlus } from "lucide-react";
import { Card, Badge, SeverityBadge, StatusBadge, Select, Input, DemoTag, fmtDate, timeAgo, cn, EmptyState } from "@/components/ui";
import { useStore } from "@/lib/store";
import { AlertSeverity } from "@/lib/types";

const SEV_TONE: Record<AlertSeverity, string> = {
  critical: "border-l-red-500",
  warning: "border-l-amber-500",
  info: "border-l-blue-500",
};

export default function AlertsPage() {
  const { alerts, acknowledgeAlert, resolveAlert, currentUser, tasks } = useStore();
  const [statusF, setStatusF] = useState("open");
  const [sevF, setSevF] = useState("all");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");

  const filtered = useMemo(() => alerts.filter((a) => {
    const okS = statusF === "all" || (statusF === "open" ? a.status !== "resolved" : a.status === statusF);
    const okV = sevF === "all" || a.severity === sevF;
    const okQ = !q || a.title.toLowerCase().includes(q.toLowerCase()) || a.message.toLowerCase().includes(q.toLowerCase());
    return okS && okV && okQ;
  }), [alerts, statusF, sevF, q]);

  const counts = useMemo(() => ({
    open: alerts.filter((a) => a.status === "open").length,
    ack: alerts.filter((a) => a.status === "acknowledged").length,
    resolved: alerts.filter((a) => a.status === "resolved").length,
  }), [alerts]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900">Alerts & Notifications</h2>
          <DemoTag />
        </div>
        <div className="flex gap-2">
          {[["open", "Open"], ["acknowledged", "Acknowledged"], ["resolved", "Resolved"]].map(([v, l]) => (
            <button key={v} onClick={() => setStatusF(v)} className={cn("rounded-full border px-3.5 py-1.5 text-xs font-semibold transition", statusF === v ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}>
              {l} ({counts[v as keyof typeof counts]})
            </button>
          ))}
          <button onClick={() => setStatusF("all")} className={cn("rounded-full border px-3.5 py-1.5 text-xs font-semibold", statusF === "all" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600")}>All</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search alerts…" className="w-64" />
        <Select value={sevF} onChange={(e) => setSevF(e.target.value)} className="w-40">
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </Select>
      </div>

      {msg && <p className="rounded-xl bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700">{msg}</p>}

      <div className="space-y-2.5">
        {filtered.length === 0 && <Card><EmptyState icon={<Bell className="h-6 w-6" />} title="No alerts" sub="You're all caught up." /></Card>}
        {filtered.map((a) => (
          <Card key={a.id} className={cn("border-l-4 p-4", SEV_TONE[a.severity], a.status === "resolved" && "opacity-60")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={a.severity === "critical" ? "high" : a.severity === "warning" ? "moderate" : "low"} />
                  <Badge tone="slate">{a.type.replace("_", " ")}</Badge>
                  <StatusBadge status={a.status} />
                </div>
                <p className="mt-1.5 text-sm font-bold text-slate-900">{a.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{a.message}</p>
                <p className="mt-1.5 text-[10px] text-slate-400">{fmtDate(a.createdAt)} · {timeAgo(a.createdAt)}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {a.status === "open" && (
                  <button onClick={() => { acknowledgeAlert(a.id); setMsg(`${a.id} acknowledged by ${currentUser?.name}.`); }} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
                    <Check className="h-3.5 w-3.5" /> Ack
                  </button>
                )}
                {a.status !== "resolved" && (
                  <>
                    {a.relatedId?.startsWith("TSK") && tasks.some((t) => t.id === a.relatedId && t.status === "pending") && (
                      <span className="hidden items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1.5 text-[11px] font-semibold text-teal-700 sm:flex"><UserPlus className="h-3.5 w-3.5" /> assign in Operations</span>
                    )}
                    <button onClick={() => { resolveAlert(a.id); setMsg(`${a.id} resolved.`); }} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700">
                      <CheckCheck className="h-3.5 w-3.5" /> Resolve
                    </button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
