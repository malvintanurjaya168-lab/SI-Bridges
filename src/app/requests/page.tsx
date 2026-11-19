"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { ClipboardList, PlayCircle, CheckCircle2, Camera, MapPin, UserCheck } from "lucide-react";
import { Card, Button, Badge, StatusBadge, DemoTag, fmtDate, EmptyState, cn } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { CleaningTask } from "@/lib/types";

// Driver actions — simple two-step execution:
//   assigned/en_route --[Start Cleaning]--> in_progress --[Complete]--> completed (+evidence)
const DRIVER_NEXT: Record<string, { label: string; to: CleaningTask["status"]; icon: React.ReactNode; cls?: string } | undefined> = {
  assigned: { label: "Start Cleaning", to: "in_progress", icon: <PlayCircle className="h-4 w-4" /> },
  en_route: { label: "Start Cleaning", to: "in_progress", icon: <PlayCircle className="h-4 w-4" /> },
  in_progress: { label: "Complete", to: "completed", icon: <CheckCircle2 className="h-4 w-4" />, cls: "bg-emerald-600 hover:bg-emerald-700" },
};

function TaskCard({
  t, truck, detImg, evImg, action,
}: {
  t: CleaningTask;
  truck?: { plate: string; driver?: string; team?: string };
  detImg?: string;
  evImg?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="p-4">
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
          {detImg && (
            <div className="mt-2">
              <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Citizen photo</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={detImg} alt="citizen report" className="h-28 w-40 rounded-lg border border-slate-200 object-cover" />
            </div>
          )}
          {evImg && (
            <div className="mt-2">
              <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600">Completion proof</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={evImg} alt="completion proof" className="h-28 w-40 rounded-lg border border-emerald-200 object-cover" />
            </div>
          )}
        </div>
        {action}
      </div>
      <div className={cn("mt-3 grid grid-cols-2 gap-2 rounded-xl p-3 text-[11px] sm:grid-cols-4", t.status === "in_progress" ? "bg-emerald-50" : "bg-slate-50")}>
        <div><p className="text-slate-400">Truck</p><p className="font-semibold text-slate-700">{truck?.plate ?? t.truckId ?? "—"}</p></div>
        <div><p className="text-slate-400">Driver</p><p className="font-semibold text-slate-700">{truck?.driver ?? "—"}</p></div>
        <div><p className="text-slate-400">Assigned</p><p className="font-semibold text-slate-700">{fmtDate(t.createdAt)}</p></div>
        <div><p className="text-slate-400">Updated</p><p className="font-semibold text-slate-700">{fmtDate(t.updatedAt)}</p></div>
      </div>
      {t.evidenceUploaded && (
        <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-600"><Camera className="h-3 w-3" /> Completion photo attached — awaiting admin verification.</p>
      )}
    </Card>
  );
}

export default function RequestsPage() {
  const { tasks, trucks, detections, updateTaskStatus, uploadTaskEvidence, assignTask, completeAssignment, currentUser } = useStore();
  const isAdmin = currentUser?.role === "admin";
  const isDriver = currentUser?.role === "truck_operator";
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingComplete, setPendingComplete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const open = tasks.filter((t) => !["completed", "cancelled"].includes(t.status));
  // Admin dispatch board: unassigned first, then in-flight jobs (read-only)
  const adminQueue = open
    .filter((t) => !t.truckId || t.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const adminActive = open
    .filter((t) => t.truckId && t.status !== "pending")
    .sort((a, b) => {
      const order = { in_progress: 0, en_route: 1, assigned: 2 } as Record<string, number>;
      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    });
  // Driver: only jobs dispatched to a truck
  const myJobs = open.filter((t) => t.truckId);

  const truckOf = (t: CleaningTask) => trucks.find((x) => x.id === t.truckId);
  const detOf = (t: CleaningTask) => (t.detectionId ? detections.find((d) => d.id === t.detectionId) : undefined);
  const pendingReports = isAdmin
    ? detections.filter((d) => d.source === "citizen_report" && d.status === "new")
    : [];

  const advance = (t: CleaningTask) => {
    const n = DRIVER_NEXT[t.status];
    if (!n) return;
    setBusy(t.id);
    if (n.to === "completed") {
      // Driver must attach photo proof — opens camera/gallery picker
      setPendingComplete(t.id);
      fileRef.current?.click();
    } else {
      updateTaskStatus(t.id, n.to);
    }
    setTimeout(() => setBusy(null), 400);
  };

  const onEvidenceFile = async (f: File | null) => {
    if (!f || !pendingComplete) return;
    const id = pendingComplete;
    setPendingComplete(null);
    setBusy(id);
    await completeAssignment(id, f);
    setBusy(null);
  };

  const assignSelect = (t: CleaningTask) => (
    <select
      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700"
      value={t.truckId ?? ""}
      onChange={(e) => {
        const tr = trucks.find((x) => x.id === e.target.value);
        if (tr) assignTask(t.id, tr.id, tr.team);
      }}
    >
      <option value="">Assign truck…</option>
      {trucks.filter((x) => x.status === "active" || x.status === "idle").map((x) => (
        <option key={x.id} value={x.id}>{x.plate} — {x.team}</option>
      ))}
    </select>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <ClipboardList className="h-5 w-5 text-teal-600" />
            {isAdmin ? "Dispatch Board" : "My Cleaning Jobs"}
          </h1>
          <p className="text-sm text-slate-500">
            {isAdmin
              ? "Citizen reports verified by staff land here — assign a truck to send a driver."
              : "Jobs assigned by admin — start cleaning when you arrive, complete when done."}
          </p>
        </div>
        <DemoTag />
      </div>

      {/* Admin: citizen reports awaiting review */}
      {pendingReports.length > 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50/50 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-700">Citizen reports awaiting review ({pendingReports.length})</p>
          <div className="space-y-1.5">
            {pendingReports.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs">
                <div className="min-w-0">
                  <span className="font-mono font-semibold text-slate-600">{d.id}</span>
                  <span className="ml-2 text-slate-500">{d.location} · {d.district}</span>
                </div>
                <Link href="/detection" className="shrink-0 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700">Review →</Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ADMIN VIEW */}
      {isAdmin && (
        <>
          <h2 className="mb-2 mt-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <UserCheck className="h-3.5 w-3.5" /> Needs assignment ({adminQueue.length})
          </h2>
          {adminQueue.length === 0 ? (
            <Card><EmptyState icon={<ClipboardList className="h-6 w-6" />} title="Queue clear" sub="Verified reports awaiting a truck will appear here." /></Card>
          ) : (
            <div className="mb-5 space-y-3">
              {adminQueue.map((t) => (
                <TaskCard key={t.id} t={t} truck={truckOf(t)} detImg={detOf(t)?.imageUrl} evImg={t.evidenceUrl} action={assignSelect(t)} />
              ))}
            </div>
          )}

          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">In progress ({adminActive.length})</h2>
          {adminActive.length === 0 ? (
            <Card><EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No active dispatches" sub="Assigned jobs will show live status here." /></Card>
          ) : (
            <div className="space-y-3">
              {adminActive.map((t) => (
                <TaskCard key={t.id} t={t} truck={truckOf(t)} detImg={detOf(t)?.imageUrl} evImg={t.evidenceUrl} />
              ))}
            </div>
          )}
        </>
      )}

      {/* DRIVER VIEW */}
      {isDriver && (
        myJobs.length === 0 ? (
          <Card>
            <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No jobs assigned" sub="When admin assigns a verified waste report to your truck, it appears here." />
          </Card>
        ) : (
          <div className="space-y-3">
            {myJobs.map((t) => {
              const next = DRIVER_NEXT[t.status];
              return (
                <TaskCard
                  key={t.id}
                  t={t}
                  truck={truckOf(t)}
                  detImg={detOf(t)?.imageUrl}
                  evImg={t.evidenceUrl}
                  action={next && (
                    <Button size="sm" onClick={() => advance(t)} disabled={busy === t.id} className={next.cls}>
                      {next.icon}{next.label}
                    </Button>
                  )}
                />
              );
            })}
          </div>
        )
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onEvidenceFile(e.target.files?.[0] ?? null)}
      />
      {isDriver && (
        <p className="mt-4 text-center text-[10px] text-slate-400">
          Press <span className="font-semibold text-slate-500">Complete</span> to open your camera — attach a photo proving the area is clean.
        </p>
      )}

      <p className="mt-4 text-center text-[10px] text-slate-400">
        Signed in as {currentUser?.name} ({currentUser?.role})
      </p>
    </div>
  );
}
