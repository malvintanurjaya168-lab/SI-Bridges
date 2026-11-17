"use client";

import React, { useMemo, useState } from "react";
import { Plus, ArrowRight, Upload, ShieldCheck, Search, ClipboardList } from "lucide-react";
import { Card, Button, Input, Label, Select, Badge, StatusBadge, SeverityBadge, DemoTag, fmtDate, timeAgo, cn, EmptyState } from "@/components/ui";
import { useStore } from "@/lib/store";
import { TaskStatus, CleaningTask } from "@/lib/types";

const FLOW: TaskStatus[] = ["pending", "assigned", "en_route", "in_progress", "completed"];
const NEXT_LABEL: Record<TaskStatus, string> = {
  pending: "Assign",
  assigned: "En Route",
  en_route: "Start Work",
  in_progress: "Complete",
  completed: "",
  cancelled: "",
};

export default function OperationsPage() {
  const { tasks, detections, trucks, createTaskFromDetection, updateTaskStatus, assignTask, uploadTaskEvidence, verifyTask, currentUser } = useStore();
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [priF, setPriF] = useState("all");
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [selDet, setSelDet] = useState("");
  const [selTruck, setSelTruck] = useState("");
  const [msg, setMsg] = useState("");

  const filtered = useMemo(() => tasks.filter((t) => {
    const okQ = !q || t.title.toLowerCase().includes(q.toLowerCase()) || t.location.toLowerCase().includes(q.toLowerCase()) || t.id.toLowerCase().includes(q.toLowerCase());
    const okS = statusF === "all" || t.status === statusF;
    const okP = priF === "all" || t.priority === priF;
    return okQ && okS && okP;
  }), [tasks, q, statusF, priF]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    tasks.forEach((t) => (c[t.status] = (c[t.status] ?? 0) + 1));
    return c;
  }, [tasks]);

  const eligibleDetections = detections.filter((d) => ["verified", "new"].includes(d.status));

  const advance = (t: CleaningTask) => {
    const i = FLOW.indexOf(t.status);
    if (i >= 0 && i < FLOW.length - 1) {
      updateTaskStatus(t.id, FLOW[i + 1]);
      setMsg(`${t.id} → ${FLOW[i + 1].replace("_", " ")}`);
    }
  };

  const cancelTask = (t: CleaningTask) => {
    updateTaskStatus(t.id, "cancelled", "Cancelled by operator");
    setMsg(`${t.id} cancelled.`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900">Collection Operations</h2>
          <DemoTag />
        </div>
        <Button onClick={() => setNewTaskOpen(!newTaskOpen)}><Plus className="h-4 w-4" /> New Cleaning Task</Button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {FLOW.concat(["cancelled"] as TaskStatus[]).map((s) => (
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

      {/* New task form */}
      {newTaskOpen && (
        <Card className="fade-up p-5">
          <h3 className="mb-3 text-sm font-bold text-slate-900">Create Cleaning Task</h3>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label>From waste detection</Label>
              <Select value={selDet} onChange={(e) => setSelDet(e.target.value)}>
                <option value="">— Select detection —</option>
                {eligibleDetections.map((d) => (
                  <option key={d.id} value={d.id}>{d.id} · {d.severity} · {d.location}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Assign truck (optional)</Label>
              <Select value={selTruck} onChange={(e) => setSelTruck(e.target.value)}>
                <option value="">Unassigned</option>
                {trucks.filter((t) => t.status === "active" || t.status === "idle").map((t) => (
                  <option key={t.id} value={t.id}>{t.plate} — {t.team}</option>
                ))}
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                className="flex-1"
                disabled={!selDet}
                onClick={() => {
                  const t = createTaskFromDetection(selDet, selTruck || undefined);
                  if (t) { setMsg(`Task ${t.id} created.`); setNewTaskOpen(false); setSelDet(""); setSelTruck(""); }
                }}
              >Create</Button>
              <Button variant="ghost" onClick={() => setNewTaskOpen(false)}>Cancel</Button>
            </div>
          </div>
          {!selDet && <p className="mt-2 text-[11px] text-slate-400">Select a verified/new detection to generate a location-linked task.</p>}
        </Card>
      )}

      {msg && <p className="rounded-xl bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700">{msg}</p>}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" className="w-56 pl-9" />
        </div>
        <Select value={priF} onChange={(e) => setPriF(e.target.value)} className="w-36">
          <option value="all">All priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
        <span className="text-xs text-slate-400">{filtered.length} tasks</span>
      </div>

      {/* Task list */}
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No tasks match filters" />
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((t) => {
              const truck = trucks.find((x) => x.id === t.truckId);
              const next = NEXT_LABEL[t.status];
              return (
                <div key={t.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-500">{t.id}</span>
                      <SeverityBadge severity={t.priority} />
                      <StatusBadge status={t.status} />
                      {t.verified && <Badge tone="green">Verified</Badge>}
                      {t.evidenceUploaded && <Badge tone="blue">Evidence</Badge>}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{t.title}</p>
                    <p className="text-xs text-slate-400">
                      {t.location} · {t.district} · created {fmtDate(t.createdAt)} by {t.createdBy}
                      {t.detectionId && <span className="ml-1 font-mono">· {t.detectionId}</span>}
                    </p>
                    {t.notes && <p className="mt-0.5 text-[11px] italic text-slate-400">Note: {t.notes}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* assign */}
                    {t.status === "pending" && (
                      <Select
                        className="w-40 !py-1.5 text-xs"
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
                      </Select>
                    )}
                    {truck && <Badge tone="teal">{truck.plate} · {t.team}</Badge>}
                    {/* advance */}
                    {next && <Button size="sm" variant="outline" onClick={() => advance(t)}>{next}<ArrowRight className="h-3.5 w-3.5" /></Button>}
                    {/* evidence */}
                    {t.status === "in_progress" && !t.evidenceUploaded && (
                      <Button size="sm" variant="ghost" onClick={() => { uploadTaskEvidence(t.id); setMsg(`${t.id} evidence uploaded (demo).`); }}>
                        <Upload className="h-3.5 w-3.5" /> Evidence
                      </Button>
                    )}
                    {/* verify */}
                    {t.status === "completed" && !t.verified && (
                      <Button size="sm" variant="secondary" onClick={() => { verifyTask(t.id); setMsg(`${t.id} verified — detection marked resolved.`); }}>
                        <ShieldCheck className="h-3.5 w-3.5" /> Verify
                      </Button>
                    )}
                    {!["completed", "cancelled"].includes(t.status) && (
                      <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => cancelTask(t)}>Cancel</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <p className="text-[11px] text-slate-400">Logged in as {currentUser?.name} ({currentUser?.role}). Status changes update linked detections and dashboard stats.</p>
    </div>
  );
}
