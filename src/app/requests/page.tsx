"use client";

import React, { useState } from "react";
import { ClipboardList, Navigation, PlayCircle, CheckCircle2, Camera, MapPin } from "lucide-react";
import { Card, Button, Badge, StatusBadge, DemoTag, fmtDate, EmptyState, cn } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { CleaningTask } from "@/lib/types";

const NEXT: Record<string, { label: string; to: CleaningTask["status"]; icon: React.ReactNode } | undefined> = {
  assigned: { label: "Start trip", to: "en_route", icon: <Navigation className="h-4 w-4" /> },
  en_route: { label: "Arrived — start cleaning", to: "in_progress", icon: <PlayCircle className="h-4 w-4" /> },
  in_progress: { label: "Mark completed", to: "completed", icon: <CheckCircle2 className="h-4 w-4" /> },
};

export default function RequestsPage() {
  const { tasks, trucks, updateTaskStatus, uploadTaskEvidence, currentUser } = useStore();
  const [busy, setBusy] = useState<string | null>(null);

  // Requests = tasks dispatched by admin/operator and assigned to a truck.
  // Originates from citizen reports -> staff review -> task -> truck assignment.
  const requests = tasks
    .filter((t) => t.truckId && !["completed", "cancelled"].includes(t.status))
    .sort((a, b) => {
      const order = { in_progress: 0, en_route: 1, assigned: 2, pending: 3 } as Record<string, number>;
      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    });

  const truckOf = (t: CleaningTask) => trucks.find((x) => x.id === t.truckId);

  const advance = (t: CleaningTask) => {
    const n = NEXT[t.status];
    if (!n) return;
    setBusy(t.id);
    updateTaskStatus(t.id, n.to);
    if (n.to === "completed") uploadTaskEvidence(t.id);
    setTimeout(() => setBusy(null), 400);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><ClipboardList className="h-5 w-5 text-teal-600" /> Cleaning Requests</h1>
          <p className="text-sm text-slate-500">Dispatches assigned to your truck — review the pile, drive there, clean, done.</p>
        </div>
        <DemoTag />
      </div>

      {requests.length === 0 ? (
        <Card>
          <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No active requests" sub="When an admin assigns a verified waste report to your truck, it appears here." />
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((t) => {
            const truck = truckOf(t);
            const next = NEXT[t.status];
            return (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-[11px] font-semibold text-slate-400">{t.id}</p>
                      <StatusBadge status={t.status} />
                      <Badge tone={t.priority === "critical" ? "red" : t.priority === "high" ? "amber" : "slate"}>{t.priority}</Badge>
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-900">{t.title}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3 w-3" />{t.location} · {t.district}</p>
                    {t.notes && <p className="mt-1 text-xs text-slate-400">📝 {t.notes}</p>}
                  </div>
                  {next && (
                    <Button size="sm" onClick={() => advance(t)} disabled={busy === t.id} className={cn(t.status === "in_progress" && "bg-emerald-600 hover:bg-emerald-700")}>
                      {next.icon}{next.label}
                    </Button>
                  )}
                </div>
                <div className={cn("mt-3 grid grid-cols-2 gap-2 rounded-xl p-3 text-[11px] sm:grid-cols-4", t.status === "in_progress" ? "bg-emerald-50" : "bg-slate-50")}>
                  <div><p className="text-slate-400">Truck</p><p className="font-semibold text-slate-700">{truck?.plate ?? t.truckId}</p></div>
                  <div><p className="text-slate-400">Driver</p><p className="font-semibold text-slate-700">{truck?.driver ?? "—"}</p></div>
                  <div><p className="text-slate-400">Assigned</p><p className="font-semibold text-slate-700">{fmtDate(t.createdAt)}</p></div>
                  <div><p className="text-slate-400">Updated</p><p className="font-semibold text-slate-700">{fmtDate(t.updatedAt)}</p></div>
                </div>
                {t.evidenceUploaded && (
                  <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-600"><Camera className="h-3 w-3" /> Completion photo attached — awaiting admin verification.</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-center text-[10px] text-slate-400">
        Signed in as {currentUser?.name} — requests are dispatched by admin after citizen reports are verified.
      </p>
    </div>
  );
}
