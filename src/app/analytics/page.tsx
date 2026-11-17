"use client";

import React, { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Download, FileText } from "lucide-react";
import { Card, Button, Select, Label, Badge, DemoTag, cn } from "@/components/ui";
import { useStore } from "@/lib/store";
import { DISTRICTS } from "@/lib/geo";

const PIE_COLORS = ["#dc2626", "#f97316", "#16a34a", "#0d9488", "#7c3aed", "#64748b"];

export default function AnalyticsPage() {
  const { detections, tasks, deliveries, facilities, trucks, alerts } = useStore();
  const [days, setDays] = useState(14);
  const [district, setDistrict] = useState("all");

  const since = useMemo(() => Date.now() - days * 86400_000, [days]);
  const det = useMemo(() => detections.filter((d) => +new Date(d.detectedAt) > since && (district === "all" || d.district === district)), [detections, since, district]);
  const tsk = useMemo(() => tasks.filter((t) => +new Date(t.createdAt) > since && (district === "all" || t.district === district)), [tasks, since, district]);
  const dlv = useMemo(() => deliveries.filter((d) => +new Date(d.timestamp) > since), [deliveries, since]);

  // 1. Waste by district
  const byDistrict = useMemo(() => {
    const m: Record<string, { high: number; moderate: number; low: number }> = {};
    det.forEach((d) => {
      m[d.district] = m[d.district] ?? { high: 0, moderate: 0, low: 0 };
      m[d.district][d.severity]++;
    });
    return Object.entries(m).map(([name, v]) => ({ name, ...v }));
  }, [det]);

  // 2. Daily detections line
  const daily = useMemo(() => {
    const arr: { label: string; detections: number; tasks: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000);
      const key = d.toISOString().slice(0, 10);
      arr.push({
        label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        detections: detections.filter((x) => x.detectedAt.slice(0, 10) === key).length,
        tasks: tasks.filter((x) => x.createdAt.slice(0, 10) === key).length,
      });
    }
    return arr;
  }, [days, detections, tasks]);

  // 3. Task status
  const taskStatus = useMemo(() => {
    const m: Record<string, number> = {};
    tsk.forEach((t) => (m[t.status] = (m[t.status] ?? 0) + 1));
    return Object.entries(m).map(([name, value]) => ({ name: name.replace("_", " "), value }));
  }, [tsk]);

  // 4. Truck performance: deliveries + weight
  const truckPerf = useMemo(() => {
    const m: Record<string, { deliveries: number; kg: number }> = {};
    dlv.forEach((d) => {
      m[d.truckId] = m[d.truckId] ?? { deliveries: 0, kg: 0 };
      m[d.truckId].deliveries++;
      m[d.truckId].kg += d.weightKg;
    });
    return trucks.map((t) => ({
      name: t.plate,
      deliveries: m[t.id]?.deliveries ?? 0,
      tons: Math.round((m[t.id]?.kg ?? 0) / 100) / 10,
      status: t.status,
    }));
  }, [dlv, trucks]);

  // 5. Facility utilization
  const facUtil = facilities.map((f) => ({
    name: f.name.replace("TPS ", "").replace("TPST ", "").replace("TPA ", ""),
    type: f.type,
    pct: Math.round((f.currentLoadTons / f.capacityTons) * 100),
  }));

  // 6. Alerts by type
  const alertTypes = useMemo(() => {
    const m: Record<string, number> = {};
    alerts.forEach((a) => (m[a.type.replace("_", " ")] = (m[a.type.replace("_", " ")] ?? 0) + 1));
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [alerts]);

  const exportCSV = () => {
    const rows = [
      ["type", "id", "location", "district", "severity/status", "timestamp", "detail"],
      ...det.map((d) => ["detection", d.id, d.location, d.district, d.severity, d.detectedAt, `conf ${d.confidence}%`]),
      ...tsk.map((t) => ["task", t.id, t.location, t.district, t.status, t.createdAt, t.priority]),
      ...dlv.map((d) => {
        const t = trucks.find((x) => x.id === d.truckId); const f = facilities.find((x) => x.id === d.facilityId);
        return ["delivery", d.id, t?.plate ?? "", "", d.status, d.timestamp, `${f?.name} ${(d.weightKg / 1000).toFixed(1)}t`];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `si-bridges-report-${days}d.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900">Analytics & Reports</h2>
          <DemoTag />
        </div>
        <div className="flex items-end gap-3">
          <div>
            <Label>Period</Label>
            <Select value={days} onChange={(e) => setDays(+e.target.value)} className="w-32">
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </Select>
          </div>
          <div>
            <Label>District</Label>
            <Select value={district} onChange={(e) => setDistrict(e.target.value)} className="w-40">
              <option value="all">All districts</option>
              {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
            </Select>
          </div>
          <Button variant="secondary" onClick={exportCSV}><Download className="h-4 w-4" /> Export CSV</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Detections", det.length], ["Cleaning tasks", tsk.length],
          ["Deliveries", dlv.length], ["Waste moved", `${(dlv.reduce((a, d) => a + d.weightKg, 0) / 1000).toFixed(1)} t`],
        ].map(([l, v]) => (
          <Card key={l as string} className="p-4"><p className="text-[11px] font-bold uppercase text-slate-400">{l}</p><p className="mt-1 text-xl font-bold text-slate-900">{v}</p></Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-1 text-sm font-bold text-slate-900">Detections by District</h3>
          <p className="mb-3 text-xs text-slate-400">Severity breakdown</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDistrict} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="high" stackId="a" fill="#dc2626" name="High" radius={[0, 0, 0, 0]} />
                <Bar dataKey="moderate" stackId="a" fill="#f97316" name="Moderate" />
                <Bar dataKey="low" stackId="a" fill="#16a34a" name="Low" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-1 text-sm font-bold text-slate-900">Detections vs Tasks Created</h3>
          <p className="mb-3 text-xs text-slate-400">Daily volume — last {days} days</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={30} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="detections" stroke="#dc2626" strokeWidth={2} dot={false} name="Detections" />
                <Line type="monotone" dataKey="tasks" stroke="#0d9488" strokeWidth={2} dot={false} name="Tasks created" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-1 text-sm font-bold text-slate-900">Task Status Distribution</h3>
          <p className="mb-3 text-xs text-slate-400">Cleaning operations pipeline</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={taskStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                  {taskStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-1 text-sm font-bold text-slate-900">Truck Performance</h3>
          <p className="mb-3 text-xs text-slate-400">Deliveries & tonnage — last {days} days</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={truckPerf} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={70} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="deliveries" fill="#0d9488" radius={[0, 6, 6, 0]} name="Deliveries" />
                <Bar dataKey="tons" fill="#7c3aed" radius={[0, 6, 6, 0]} name="Tons" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-1 text-sm font-bold text-slate-900">Facility Utilization</h3>
          <p className="mb-3 text-xs text-slate-400">Current load vs capacity (%)</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={facUtil} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} unit="%" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} width={90} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} cursor={{ fill: "#f1f5f9" }} formatter={(v) => [`${v}%`, "Utilization"]} />
                <Bar dataKey="pct" radius={[0, 6, 6, 0]} name="Utilization">
                  {facUtil.map((f, i) => <Cell key={i} fill={f.pct > 90 ? "#dc2626" : f.pct > 70 ? "#f97316" : "#16a34a"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-1 text-sm font-bold text-slate-900">Environmental Signals</h3>
          <p className="mb-3 text-xs text-slate-400">Alert volume by category</p>
          <div className="h-64">
            {alertTypes.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={alertTypes} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} cursor={{ fill: "#f1f5f9" }} />
                  <Bar dataKey="value" fill="#7c3aed" radius={[6, 6, 0, 0]} name="Alerts" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">No alert data for this period</div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500">
            <FileText className="h-4 w-4 text-slate-400" />
            CSV export includes detections, tasks and deliveries for the selected period & district. Demo dataset — not official DLH statistics.
          </div>
        </Card>
      </div>
    </div>
  );
}
