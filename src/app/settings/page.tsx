"use client";

import React, { useState } from "react";
import { Users, Database, Settings2, ShieldCheck, RotateCcw, CheckCircle2, Plug } from "lucide-react";
import { Card, Badge, Button, Select, Label, DemoTag, cn } from "@/components/ui";
import DataManager from "@/components/DataManager";
import { useStore } from "@/lib/store";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { ROLE_LABELS } from "@/lib/demo-data";
import type { UserRole } from "@/lib/types";

const TABS = [
  { key: "users", label: "Users & Roles", icon: Users },
  { key: "records", label: "Database Records", icon: Database },
  { key: "data", label: "Datasets & Integrations", icon: Database },
  { key: "system", label: "System Settings", icon: Settings2 },
];

const INTEGRATIONS = [
  { name: "OpenAI Vision (AI detection)", status: "demo", desc: "Street-image waste classification. Swap heuristic demo for GPT-4o vision endpoint." },
  { name: "Jakarta Satu API", status: "planned", desc: "Citizen reports & city service tickets." },
  { name: "SIPSN — Air Quality", status: "planned", desc: "PM2.5 / AQI feeds for environmental context." },
  { name: "BMKG Weather", status: "planned", desc: "Rainfall forecasts for flood-risk scoring." },
  { name: "BPBD DKI Jakarta", status: "planned", desc: "Official flood warnings & disaster data." },
  { name: "DSDA / DLH Operational Data", status: "planned", desc: "Authorized waste collection records." },
];

const DATASETS = [
  { name: "Waste detections", count: "44 records", source: "Demo generator + truck cameras", updated: "Live" },
  { name: "Fleet GPS tracks", count: "8 vehicles", source: "Simulated telemetry", updated: "Live" },
  { name: "Facilities registry", count: "9 sites", source: "Demo registry (TPS/TPST/TPA)", updated: "Static" },
  { name: "Flood risk zones", count: "10 zones", source: "Heuristic model", updated: "Daily" },
  { name: "Historical floods", count: "5 yrs", source: "BPBD public records (synthetic)", updated: "Monthly" },
];

export default function SettingsPage() {
  const { users, currentUser, setUser } = useStore();
  const [tab, setTab] = useState("users");
  const [roleDraft, setRoleDraft] = useState<Record<string, UserRole>>({});
  const [saved, setSaved] = useState(false);
  const isAdmin = currentUser?.role === "admin";

  const [roleError, setRoleError] = useState("");
  const saveRoles = async () => {
    setRoleError("");
    const sb = getSupabase();
    if (!sb || !isAdmin) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return;
    }
    // Real Supabase update — admin-only per RLS policy
    for (const [uid, role] of Object.entries(roleDraft)) {
      const { error } = await sb.from("profiles").update({ role }).eq("id", uid);
      if (error) { setRoleError(error.message); return; }
    }
    setRoleDraft({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const resetDemo = () => {
    if (confirm("Reset all demo data to the initial synthetic dataset? Your changes will be lost.")) {
      localStorage.removeItem("si-bridges-state-v1");
      location.reload();
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900">Data & User Management</h2>
          <DemoTag />
        </div>
        {!isAdmin && <Badge tone="amber"><ShieldCheck className="h-3 w-3" /> Read-only — requires Administrator role</Badge>}
      </div>

      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition", tab === key ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100")}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">System Users</h3>
              <p className="text-xs text-slate-400">Role-based access control (RBAC)</p>
            </div>
            {isAdmin && <Button size="sm" variant="outline" disabled>+ Invite user (Supabase auth)</Button>}
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
              <tr><th className="px-5 py-2.5">User</th><th className="px-3 py-2.5">Email</th><th className="px-3 py-2.5">Current role</th><th className="px-3 py-2.5">Assign role</th><th className="px-5 py-2.5 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-800">{u.name} {u.id === currentUser?.id && <Badge tone="green">you</Badge>}</p>
                    <p className="font-mono text-[10px] text-slate-400">{u.id}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-500">{u.email}</td>
                  <td className="px-3 py-3"><Badge tone="blue">{ROLE_LABELS[u.role]}</Badge></td>
                  <td className="px-3 py-3">
                    <Select
                      value={roleDraft[u.id] ?? u.role}
                      disabled={!isAdmin}
                      onChange={(e) => setRoleDraft({ ...roleDraft, [u.id]: e.target.value as UserRole })}
                      className="w-44 !py-1.5 text-[11px]"
                    >
                      {Object.entries(ROLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </Select>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setUser(u.id)}>View as</Button>
                      {isAdmin && <Button size="sm" variant="outline" disabled>Edit</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {isAdmin && Object.keys(roleDraft).length > 0 && (
            <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-3">
              <Button size="sm" onClick={saveRoles}>{saved ? "Saved ✓" : "Save role changes"}</Button>
              <p className="text-[11px] text-slate-400">
                {isSupabaseConfigured ? "Writes to Supabase profiles (admin only, enforced by RLS)." : "Demo mode: role edits are session-only."}
                {roleError && <span className="ml-2 font-medium text-red-600">{roleError}</span>}
              </p>
            </div>
          )}
        </Card>
      )}

      {tab === "records" && <DataManager />}

      {tab === "data" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-bold text-slate-900">Active Datasets</h3>
              <p className="text-xs text-slate-400">Synthetic demo datasets powering this deployment</p>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
                <tr><th className="px-5 py-2.5">Dataset</th><th className="px-3 py-2.5">Records</th><th className="px-3 py-2.5">Source</th><th className="px-5 py-2.5">Refresh</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {DATASETS.map((d) => (
                  <tr key={d.name} className="hover:bg-slate-50/70">
                    <td className="px-5 py-2.5 font-semibold text-slate-700">{d.name}</td>
                    <td className="px-3 py-2.5 text-slate-500">{d.count}</td>
                    <td className="px-3 py-2.5 text-slate-500">{d.source}</td>
                    <td className="px-5 py-2.5"><Badge tone={d.updated === "Live" ? "green" : "slate"}>{d.updated}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Plug className="h-4 w-4 text-emerald-600" /> Integration Points</h3>
              <p className="text-xs text-slate-400">Planned connections for production deployment</p>
            </div>
            <div className="divide-y divide-slate-100">
              {INTEGRATIONS.map((i) => (
                <div key={i.name} className="flex items-start gap-3 px-5 py-3">
                  <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", i.status === "demo" ? "text-emerald-500" : "text-slate-300")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-800">{i.name}</p>
                      <Badge tone={i.status === "demo" ? "green" : "slate"}>{i.status === "demo" ? "Demo" : "Planned"}</Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">{i.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "system" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-bold text-slate-900">System Configuration</h3>
            <div className="space-y-4">
              {[
                ["Deployment mode", "Demo Mode — all data synthetic", true],
                ["Map provider", "OpenStreetMap tiles (Leaflet)", true],
                ["AI engine", "Heuristic demo classifier", true],
                ["GPS telemetry", "Simulated waypoint movement", true],
                ["Persistence", "Browser localStorage", true],
                ["Realtime", "Supabase Realtime (when configured)", false],
              ].map(([label, value, on]) => (
                <div key={label as string} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{label}</p>
                    <p className="text-[11px] text-slate-400">{value}</p>
                  </div>
                  <span className={cn("relative h-5 w-9 rounded-full", on ? "bg-emerald-500" : "bg-slate-300")}>
                    <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", on ? "left-[18px]" : "left-0.5")} />
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="mb-2 text-sm font-bold text-slate-900">Environment</h3>
            <p className="mb-4 text-xs text-slate-400">Set these in <code className="rounded bg-slate-100 px-1">.env.local</code> to connect production services:</p>
            <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-[11px] leading-relaxed text-emerald-300">
{`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...          # vision model
BMKG_API_TOKEN=...          # weather
SIPSN_API_KEY=...           # air quality`}
            </pre>
            {isAdmin && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <Button variant="danger" size="sm" onClick={resetDemo}><RotateCcw className="h-4 w-4" /> Reset demo data</Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
