"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Database, Loader2, Pencil, Trash2, Plus, RefreshCw, X, AlertTriangle } from "lucide-react";
import { Badge, Button, Card, Select, cn } from "@/components/ui";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useStore } from "@/lib/store";

interface TableCfg {
  key: string;
  label: string;
  hint: string;
}

const TABLES: TableCfg[] = [
  { key: "detections", label: "Detections", hint: "id, location, district, lat, lng, severity(high|moderate|low), confidence, ai_class, status(new|verified|assigned|resolved|rejected), source, observations[], recommended_action, detected_at, reviewed_at, review_note, ai_severity, ai_confidence" },
  { key: "trucks", label: "Trucks", hint: "id, plate, name, status(active|idle|offline|maintenance), lat, lng, route_id, route_name, driver, team, capacity_kg, load_kg, waypoints[], wp_index, speed_kmh" },
  { key: "cleaning_tasks", label: "Cleaning Tasks", hint: "id, title, location, district, lat, lng, priority(critical|high|medium|low), status(pending|assigned|en_route|in_progress|completed|cancelled), detection_id, truck_id, team, notes, evidence_uploaded, verified" },
  { key: "facilities", label: "Facilities", hint: "id, name, type(TPS|TPST|TPA), lat, lng, address, capacity_tons, current_load_tons, operator, status(operational|near_capacity|full|maintenance), open_hours" },
  { key: "deliveries", label: "Deliveries", hint: "id, truck_id, facility_id, weight_kg, timestamp, status(completed|in_transit|scheduled), notes" },
  { key: "alerts", label: "Alerts", hint: "id, type, severity(critical|warning|info), title, message, related_id, status(open|acknowledged|resolved)" },
];

const PREVIEW_COLS = 5;

export default function DataManager() {
  const { currentUser } = useStore();
  const canWrite = currentUser?.role === "admin" || currentUser?.role === "truck_operator";
  const [table, setTable] = useState(TABLES[0].key);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [edit, setEdit] = useState<{ isNew: boolean; json: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const cfg = TABLES.find((t) => t.key === table)!;

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    setLoading(true);
    const { data, error } = await sb.from(table).select("*").order("id").limit(200);
    setLoading(false);
    if (error) setMsg(error.message);
    else { setRows(data ?? []); setMsg(""); }
  }, [table]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (row: any | null) => {
    setEdit({ isNew: !row, json: JSON.stringify(row ?? {}, null, 2) });
  };

  const save = async () => {
    const sb = getSupabase();
    if (!sb || !edit) return;
    let parsed: any;
    try { parsed = JSON.parse(edit.json); } catch { setMsg("Invalid JSON — fix syntax and try again."); return; }
    if (!parsed.id) { setMsg("Record must include an 'id' field (text primary key)."); return; }
    setBusy(true); setMsg("");
    const { error } = await sb.from(table).upsert(parsed);
    setBusy(false);
    if (error) setMsg(error.message);
    else { setEdit(null); setMsg(`Saved ${parsed.id}`); load(); }
  };

  const remove = async (row: any) => {
    const sb = getSupabase();
    if (!sb) return;
    if (!confirm(`Delete ${cfg.label} record "${row.id}"? This cannot be undone.`)) return;
    setBusy(true); setMsg("");
    const { error } = await sb.from(table).delete().eq("id", row.id);
    setBusy(false);
    if (error) setMsg(error.message);
    else { setMsg(`Deleted ${row.id}`); load(); }
  };

  if (!isSupabaseConfigured) {
    return (
      <Card className="p-6 text-center">
        <Database className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-2 text-sm font-semibold text-slate-600">Database manager requires Supabase mode</p>
        <p className="text-xs text-slate-400">Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to manage live records.</p>
      </Card>
    );
  }

  const cols = rows.length ? Object.keys(rows[0]).filter((k) => !["waypoints", "factors", "observations", "recommendations"].includes(k)) : [];
  const previewCols = cols.slice(0, PREVIEW_COLS);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Database className="h-4 w-4 text-emerald-600" /> Database Records
        </h3>
        <Select value={table} onChange={(e) => { setTable(e.target.value); setMsg(""); }} className="w-44 !py-1.5 text-[11px]">
          {TABLES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Badge tone="slate">{rows.length} rows</Badge>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /></Button>
          {canWrite && <Button size="sm" onClick={() => openEdit(null)}><Plus className="h-3.5 w-3.5" /> New</Button>}
        </div>
      </div>

      {!canWrite && (
        <p className="border-b border-slate-100 bg-amber-50 px-5 py-2 text-[11px] font-medium text-amber-700">
          Read-only — your role ({currentUser?.role}) cannot modify records. Admin and Truck Operator can.
        </p>
      )}
      {msg && <p className="border-b border-slate-100 bg-slate-50 px-5 py-2 text-[11px] font-medium text-slate-600">{msg}</p>}

      <div className="max-h-[420px] overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-400">No records in {cfg.label}.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                {previewCols.map((c) => <th key={c} className="px-4 py-2.5">{c}</th>)}
                {canWrite && <th className="px-4 py-2.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70">
                  {previewCols.map((c) => (
                    <td key={c} className="max-w-[160px] truncate px-4 py-2 text-slate-600">
                      {typeof r[c] === "object" ? JSON.stringify(r[c])?.slice(0, 60) : String(r[c] ?? "")}
                    </td>
                  ))}
                  {canWrite && (
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(r)} title="Edit JSON" className="rounded-lg p-1.5 text-teal-600 hover:bg-teal-50"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => remove(r)} title="Delete" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="border-t border-slate-100 px-5 py-2 text-[10px] text-slate-400">
        Columns: {cfg.hint}
      </p>

      {/* JSON editor modal */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEdit(null)}>
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h4 className="text-sm font-bold text-slate-900">{edit.isNew ? "New" : "Edit"} {cfg.label} record</h4>
              <button onClick={() => setEdit(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <textarea
              value={edit.json}
              onChange={(e) => setEdit({ ...edit, json: e.target.value })}
              spellCheck={false}
              className="min-h-[320px] flex-1 resize-none bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-emerald-200 focus:outline-none"
            />
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
              <p className="flex items-center gap-1 text-[10px] text-slate-400"><AlertTriangle className="h-3 w-3" /> Edits write directly to Supabase and sync live to all users.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
                <Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save record"}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

