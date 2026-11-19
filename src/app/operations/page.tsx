"use client";

import React, { useMemo, useState } from "react";
import { MapPin, Search, ClipboardList, Users, UserCheck, CheckCircle2 } from "lucide-react";
import { Card, Input, Badge, StatusBadge, SeverityBadge, DemoTag, fmtDate, cn, EmptyState } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { CleaningTask } from "@/lib/types";

// Admin Operations = read-only route board.
//   Daily Routes      — routine/scheduled cleaning tasks (not from citizen reports)
//   Additional Routes — extra routes created from citizen waste reports
// Execution happens on the driver's /requests page; results publish to /cleaned.

function RouteRow({ t, truck, detImg, citizen }: { t: CleaningTask; truck?: { plate: string; driver?: string; team?: string }; detImg?: string; citizen?: boolean }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-slate-500">{t.id}</span>
          <StatusBadge status={t.status} />
          <SeverityBadge severity={t.priority} />
          {t.verified && <Badge tone="green">Verified</Badge>}
          {citizen && <Badge tone="amber">Citizen request</Badge>}
        </div>
        <p className="mt-1 text-sm font-semibold text-slate-800">{t.title}</p>
        <p className="text-xs text-slate-400">
          <MapPin className="mr-0.5 inline h-3 w-3" />{t.location} · {t.district} · created {fmtDate(t.createdAt)}
          {t.detectionId && <span className="ml-1 font-mono">· {t.detectionId}</span>}
        </p>
        {t.notes && <p className="mt-0.5 text-[11px] italic text-slate-400">Note: {t.notes}</p>}
        {detImg && (
          <a href={detImg} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={detImg} alt="reported area" className="mt-2 h-14 w-20 rounded-lg border border-slate-200 object-cover" />
          </a>
        )}
        {t.evidenceUrl && (
          <a href={t.evidenceUrl} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.evidenceUrl} alt="completion proof" className="mt-2 h-14 w-20 rounded-lg border border-emerald-200 object-cover" />
          </a>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {truck ? (
          <Badge tone="teal"><UserCheck className="mr-1 inline h-3 w-3" />{truck.plate} · {truck.driver ?? truck.team}</Badge>
        ) : (
          <Badge tone="slate"><Users className="mr-1 inline h-3 w-3" />Unassigned</Badge>
        )}
        {t.status === "completed" && t.evidenceUploaded && (
          <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> proof attached</span>
        )}
      </div>
    </div>
  );
}

export default function OperationsPage() {
  const { tasks, detections, trucks, currentUser } = useStore();
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");

  const detById = useMemo(() => new Map(detections.map((d) => [d.id, d])), [detections]);

  const isCitizenRoute = (t: CleaningTask) => {
    const det = t.detectionId ? detById.get(t.detectionId) : undefined;
    return det?.source === "citizen_report";
  };

  const filtered = useMemo(() => tasks.filter((t) => {
    const okQ = !q || t.title.toLowerCase().includes(q.toLowerCase()) || t.location.toLowerCase().includes(q.toLowerCase()) || t.id.toLowerCase().includes(q.toLowerCase());
    const okS = statusF === "all" || t.status === statusF;
    return okQ && okS;
  }), [tasks, q, statusF]);

  const dailyRoutes = filtered.filter((t) => !isCitizenRoute(t) && t.status !== "cancelled");
  const extraRoutes = filtered.filter((t) => isCitizenRoute(t) && t.status !== "cancelled");
  const completedToday = filtered.filter((t) => t.status === "completed" || t.verified);

  const truckOf = (t: CleaningTask) => trucks.find((x) => x.id === t.truckId);
  const detImgOf = (t: CleaningTask) => (t.detectionId ? detById.get(t.detectionId)?.imageUrl : undefined);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    tasks.forEach((t) => (c[t.status] = (c[t.status] ?? 0) + 1));
    return c;
  }, [tasks]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900">Collection Routes</h2>
          <DemoTag />
        </div>
        <p className="text-xs text-slate-400">Read-only board — drivers execute jobs from Cleaning Requests.</p>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {(["pending", "assigned", "en_route", "in_progress", "completed", "cancelled"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusF(statusF === s ? "all" : s)}
            className={cn(
              "rounded-xl border bg-white p-3 text-center transition",
              statusF === s ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-200 hover:border-slate-300"
            )}
          >
            <p className="text-xl font-bold text-slate-900">{counts[s] ?? 0}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s.replace("_", " ")}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search routes…" className="w-56 pl-9" />
        </div>
        <span className="text-xs text-slate-400">{filtered.length} routes</span>
      </div>

      {/* Additional Routes — citizen requests */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600">
          <UserCheck className="h-3.5 w-3.5" /> Additional Routes — Citizen Requests ({extraRoutes.length})
        </h3>
        <Card className="overflow-hidden">
          {extraRoutes.length === 0 ? (
            <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No citizen-request routes" sub="Approved citizen reports dispatched by admin appear here." />
          ) : (
            <div className="divide-y divide-slate-100">
              {extraRoutes.map((t) => (
                <RouteRow key={t.id} t={t} truck={truckOf(t)} detImg={detImgOf(t)} citizen />
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* Daily Routes — routine routes */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Users className="h-3.5 w-3.5" /> Daily Routes — Scheduled Routes ({dailyRoutes.length})
        </h3>
        <Card className="overflow-hidden">
          {dailyRoutes.length === 0 ? (
            <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No scheduled routes" sub="Routine cleaning tasks appear here." />
          ) : (
            <div className="divide-y divide-slate-100">
              {dailyRoutes.map((t) => (
                <RouteRow key={t.id} t={t} truck={truckOf(t)} detImg={detImgOf(t)} />
              ))}
            </div>
          )}
        </Card>
      </section>

      {completedToday.length > 0 && (
        <p className="text-[11px] text-slate-400">
          {completedToday.length} route{completedToday.length > 1 ? "s" : ""} completed — results publish to Cleaned Areas automatically.
        </p>
      )}
      <p className="text-[11px] text-slate-400">Signed in as {currentUser?.name} ({currentUser?.role}).</p>
    </div>
  );
}
