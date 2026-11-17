"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Trash2, AlertTriangle, Truck, CheckCircle2, Bell, ArrowRight, Activity, MapPin, Clock,
} from "lucide-react";
import { Card, StatCard, Badge, SeverityBadge, StatusBadge, DemoTag, fmtDate, timeAgo, cn } from "@/components/ui";
import { useStore } from "@/lib/store";

type Range = "24h" | "7d" | "30d";

export default function OverviewPage() {
  const { detections, trucks, tasks, alerts, deliveries, facilities } = useStore();
  const [range, setRange] = useState<Range>("7d");

  const stats = useMemo(() => {
    const high = detections.filter((d) => d.severity === "high").length;
    const mod = detections.filter((d) => d.severity === "moderate").length;
    const low = detections.filter((d) => d.severity === "low").length;
    const activeTrucks = trucks.filter((t) => t.status === "active").length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const pending = tasks.filter((t) => ["pending", "assigned", "en_route", "in_progress"].includes(t.status)).length;
    const openAlerts = alerts.filter((a) => a.status !== "resolved").length;
    return { high, mod, low, activeTrucks, completed, pending, openAlerts, total: detections.length };
  }, [detections, trucks, tasks, alerts]);

  // Trend data: bucket detections by day for last 14 days
  const trend = useMemo(() => {
    const days: { label: string; high: number; moderate: number; low: number; total: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000);
      const key = d.toISOString().slice(0, 10);
      const dayDets = detections.filter((x) => x.detectedAt.slice(0, 10) === key);
      days.push({
        label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        high: dayDets.filter((x) => x.severity === "high").length,
        moderate: dayDets.filter((x) => x.severity === "moderate").length,
        low: dayDets.filter((x) => x.severity === "low").length,
        total: dayDets.length,
      });
    }
    return days;
  }, [detections]);

  const sevPie = [
    { name: "High", value: stats.high, color: "#dc2626" },
    { name: "Moderate", value: stats.mod, color: "#f97316" },
    { name: "Low", value: stats.low, color: "#16a34a" },
  ];

  const taskStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach((t) => (counts[t.status] = (counts[t.status] ?? 0) + 1));
    return Object.entries(counts).map(([name, value]) => ({ name: name.replace("_", " "), value }));
  }, [tasks]);

  const opsPerf = useMemo(() => {
    // deliveries per truck last 7 days (demo)
    const byTruck: Record<string, number> = {};
    deliveries.forEach((d) => {
      const recent = Date.now() - +new Date(d.timestamp) < 7 * 86400_000;
      if (recent) byTruck[d.truckId] = (byTruck[d.truckId] ?? 0) + 1;
    });
    return trucks.map((t) => ({ name: t.plate, collections: byTruck[t.id] ?? 0, status: t.status }));
  }, [deliveries, trucks]);

  const recent = useMemo(() => {
    const items: { icon: React.ReactNode; text: string; time: string; tone: string }[] = [];
    detections.slice(0, 4).forEach((d) =>
      items.push({ icon: <MapPin className="h-3.5 w-3.5" />, text: `AI detection (${d.severity}) at ${d.location}`, time: d.detectedAt, tone: "text-red-500" })
    );
    tasks.slice(0, 3).forEach((t) =>
      items.push({ icon: <Truck className="h-3.5 w-3.5" />, text: `Task ${t.id} → ${t.status.replace("_", " ")}`, time: t.updatedAt, tone: "text-teal-600" })
    );
    deliveries.slice(0, 3).forEach((d) => {
      const f = facilities.find((x) => x.id === d.facilityId);
      items.push({ icon: <Trash2 className="h-3.5 w-3.5" />, text: `Delivery ${d.weightKg}kg → ${f?.name ?? "facility"}`, time: d.timestamp, tone: "text-emerald-600" });
    });
    return items.sort((a, b) => +new Date(b.time) - +new Date(a.time)).slice(0, 9);
  }, [detections, tasks, deliveries, facilities]);

  const topAlerts = alerts.filter((a) => a.status !== "resolved").slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Command Overview</h2>
            <DemoTag />
          </div>
          <p className="text-xs text-slate-500">Real-time waste monitoring summary across Jakarta</p>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          {(["24h", "7d", "30d"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", range === r ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-100")}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={<Trash2 className="h-5 w-5" />} label="Detections" value={stats.total} sub="All time" tone="emerald" />
        <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="High Severity" value={stats.high} sub="Requires attention" tone="red" />
        <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="Moderate" value={stats.mod} tone="amber" />
        <StatCard icon={<Truck className="h-5 w-5" />} label="Active Trucks" value={`${stats.activeTrucks}/${trucks.length}`} sub="GPS online" tone="teal" />
        <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Tasks Done" value={stats.completed} sub={`${stats.pending} pending`} tone="blue" />
        <StatCard icon={<Bell className="h-5 w-5" />} label="Open Alerts" value={stats.openAlerts} sub="Unresolved" tone="purple" />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Waste Accumulation Trend</h3>
              <p className="text-xs text-slate-400">Detections per day — last 14 days</p>
            </div>
            <Link href="/analytics" className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline">
              Full report <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: -18, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="gHigh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#dc2626" stopOpacity={0.35} /><stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gMod" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} /><stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gLow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.25} /><stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Area type="monotone" dataKey="high" stackId="1" stroke="#dc2626" fill="url(#gHigh)" name="High" />
                <Area type="monotone" dataKey="moderate" stackId="1" stroke="#f97316" fill="url(#gMod)" name="Moderate" />
                <Area type="monotone" dataKey="low" stackId="1" stroke="#16a34a" fill="url(#gLow)" name="Low" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-bold text-slate-900">Severity Distribution</h3>
          <p className="text-xs text-slate-400">Current detections</p>
          <div className="mt-2 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sevPie} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={3} strokeWidth={0}>
                  {sevPie.map((s) => <Cell key={s.name} fill={s.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Operations */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Operations Performance</h3>
            <Badge tone="green">{stats.completed} completed</Badge>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={opsPerf} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={70} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="collections" fill="#0d9488" radius={[0, 6, 6, 0]} name="Collections (7d)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {taskStatusData.map((s) => (
              <Badge key={s.name} tone="slate">{s.name}: {s.value}</Badge>
            ))}
          </div>
        </Card>

        {/* Recent activity */}
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            <Activity className="h-4 w-4 text-emerald-600" /> Recent Activity
          </h3>
          <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
            {recent.map((r, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className={cn("mt-0.5 rounded-lg bg-slate-100 p-1.5", r.tone)}>{r.icon}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-slate-700">{r.text}</p>
                  <p className="flex items-center gap-1 text-[10px] text-slate-400"><Clock className="h-2.5 w-2.5" />{timeAgo(r.time)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Alerts */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Priority Alerts</h3>
            <Link href="/alerts" className="text-xs font-semibold text-emerald-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-2.5">
            {topAlerts.length === 0 && <p className="text-xs text-slate-400">No open alerts.</p>}
            {topAlerts.map((a) => (
              <div key={a.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-800">{a.title}</p>
                  <SeverityBadge severity={a.severity === "critical" ? "high" : a.severity === "warning" ? "moderate" : "low"} />
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{a.message}</p>
                <p className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400"><Clock className="h-2.5 w-2.5" />{fmtDate(a.createdAt)} · {a.status}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
