"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Waves, AlertTriangle, ShieldAlert, Info } from "lucide-react";
import { Card, Badge, SeverityBadge, DemoTag, cn, Select } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { FloodZone } from "@/lib/types";

const FloodMap = dynamic(() => import("@/components/FloodMap"), { ssr: false });

export default function FloodPage() {
  const { floodZones, detections } = useStore();
  const [riskF, setRiskF] = useState("all");
  const [sel, setSel] = useState<FloodZone | null>(floodZones[0]);

  const filtered = floodZones.filter((f) => riskF === "all" || f.risk === riskF);
  const counts = floodZones.reduce<Record<string, number>>((a, f) => ((a[f.risk] = (a[f.risk] ?? 0) + 1), a), {});
  const wasteNear = (f: FloodZone) => detections.filter((d) => Math.hypot(d.lat - f.lat, d.lng - f.lng) < 0.03).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900">Flood Risk Analysis</h2>
          <DemoTag />
        </div>
        <Select value={riskF} onChange={(e) => setRiskF(e.target.value)} className="w-44">
          <option value="all">All risk levels</option>
          <option value="high">High</option>
          <option value="moderate">Moderate</option>
          <option value="low">Low</option>
          <option value="insufficient">Insufficient Data</option>
        </Select>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
        <div className="text-xs leading-relaxed text-violet-800">
          <p className="font-bold">Decision-support analysis — not an official flood prediction.</p>
          <p className="mt-0.5">
            Risk indicators combine synthetic waste-accumulation data, drainage proximity, rainfall proxies, and historical flood points.
            For authoritative warnings consult <strong>BPBD DKI Jakarta</strong> and official BMKG bulletins. Integration points prepared for SIPSN, BMKG, and BPBD feeds.
          </p>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {(["high", "moderate", "low", "insufficient"] as const).map((r) => (
          <button key={r} onClick={() => setRiskF(riskF === r ? "all" : r)} className={cn("rounded-full border px-3.5 py-1.5 text-xs font-semibold transition", riskF === r ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}>
            {r === "insufficient" ? "Insufficient Data" : r[0].toUpperCase() + r.slice(1)}: {counts[r] ?? 0}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <FloodMap />
        </div>
        <div className="space-y-3 xl:col-span-2">
          {filtered.map((f) => (
            <Card
              key={f.id}
              onClick={() => setSel(f)}
              className={cn("cursor-pointer p-4 transition hover:shadow-md", sel?.id === f.id && "ring-2 ring-emerald-500")}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">{f.name}</p>
                  <p className="text-[11px] text-slate-400">{f.district}</p>
                </div>
                <SeverityBadge severity={f.risk === "insufficient" ? "low" : f.risk} />
              </div>
              <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1"><Waves className="h-3 w-3" /> Score {f.score}/100</span>
                <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-orange-500" /> {wasteNear(f)} nearby detections</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Selected zone detail */}
      {sel && (
        <Card className="fade-up p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{sel.name}</h3>
              <p className="text-xs text-slate-400">{sel.district} · Coordinates {sel.lat.toFixed(4)}, {sel.lng.toFixed(4)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="purple">Risk score {sel.score}/100</Badge>
              <SeverityBadge severity={sel.risk === "insufficient" ? "low" : sel.risk} />
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400"><Info className="h-3.5 w-3.5" /> Environmental factors</p>
              <div className="space-y-1.5">
                {sel.factors.map((f, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <span className="text-slate-600">{f.label}</span>
                    <span className={cn("font-semibold", f.impact === "negative" ? "text-red-600" : f.impact === "positive" ? "text-emerald-600" : "text-slate-500")}>{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Recommended preventive actions</p>
              <ul className="space-y-1.5">
                {sel.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2 rounded-lg bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800">
                    <span className="font-bold">{i + 1}.</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
