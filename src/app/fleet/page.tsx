"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Truck, Activity, WifiOff, Wrench, Gauge, User } from "lucide-react";
import { Card, StatCard, Badge, StatusBadge, Select, Input, DemoTag, timeAgo, fmtDate, cn } from "@/components/ui";
import LiveGpsPanel from "@/components/LiveGpsPanel";
import { useStore } from "@/lib/store";
import type { TruckStatus } from "@/lib/types";

const FleetMap = dynamic(() => import("@/components/FleetMap"), { ssr: false });

export default function FleetPage() {
  const { trucks, setTruckStatus, deliveries, facilities, currentUser } = useStore();
  const canEditFleet = currentUser?.role === "admin";
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");

  const filtered = useMemo(() => {
    return trucks.filter((t) => {
      const okQ = !q || t.plate.toLowerCase().includes(q.toLowerCase()) || t.driver.toLowerCase().includes(q.toLowerCase()) || t.routeName.toLowerCase().includes(q.toLowerCase());
      const okS = statusF === "all" || t.status === statusF;
      return okQ && okS;
    });
  }, [trucks, q, statusF]);

  const stats = useMemo(() => ({
    total: trucks.length,
    active: trucks.filter((t) => t.status === "active").length,
    idle: trucks.filter((t) => t.status === "idle").length,
    offline: trucks.filter((t) => t.status === "offline" || t.status === "maintenance").length,
  }), [trucks]);

  const deliveriesByTruck = useMemo(() => {
    const m: Record<string, number> = {};
    deliveries.forEach((d) => { m[d.truckId] = (m[d.truckId] ?? 0) + 1; });
    return m;
  }, [deliveries]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900">Fleet Monitoring</h2>
          <DemoTag />
        </div>
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-2 w-2 rounded-full bg-emerald-500 pulse-dot" /> Simulated GPS — or live via the tracking panel
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<Truck className="h-5 w-5" />} label="Registered" value={stats.total} tone="blue" />
        <StatCard icon={<Activity className="h-5 w-5" />} label="Active" value={stats.active} tone="emerald" />
        <StatCard icon={<Gauge className="h-5 w-5" />} label="Idle" value={stats.idle} tone="amber" />
        <StatCard icon={<WifiOff className="h-5 w-5" />} label="Offline / Maint." value={stats.offline} tone="red" />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* Table */}
        <Card className="overflow-hidden xl:col-span-3">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search plate, driver, route…" className="w-56" />
            <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="w-40">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="idle">Idle</option>
              <option value="offline">Offline</option>
              <option value="maintenance">Maintenance</option>
            </Select>
          </div>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-2.5">Truck</th><th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Route</th><th className="px-3 py-2.5">Driver / Team</th>
                  <th className="px-3 py-2.5">Deliveries</th>
                  <th className="px-3 py-2.5">Last GPS</th><th className="px-4 py-2.5 text-right">Set status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-slate-800">{t.plate}</p>
                      <p className="text-[10px] text-slate-400">{t.name} · {t.id}</p>
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={t.status} /></td>
                    <td className="max-w-[140px] px-3 py-2.5">
                      <p className="truncate text-slate-600">{t.routeName}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="flex items-center gap-1 text-slate-700"><User className="h-3 w-3 text-slate-400" />{t.driver}</p>
                      <p className="text-[10px] text-slate-400">{t.team}</p>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-600">{deliveriesByTruck[t.id] ?? 0}</td>
                    <td className="px-3 py-2.5 text-slate-500">{timeAgo(t.lastUpdate)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end">
                        {canEditFleet ? (
                          <Select
                            value={t.status}
                            onChange={(e) => setTruckStatus(t.id, e.target.value as TruckStatus)}
                            className="w-32 !py-1 text-[11px]"
                          >
                            <option value="active">Active</option>
                            <option value="idle">Idle</option>
                            <option value="offline">Offline</option>
                            <option value="maintenance">Maintenance</option>
                          </Select>
                        ) : (
                          <StatusBadge status={t.status} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Map + GPS */}
        <div className="space-y-4 xl:col-span-2">
          <LiveGpsPanel />
          <FleetMap />
        </div>
      </div>
    </div>
  );
}
