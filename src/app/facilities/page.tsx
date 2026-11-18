"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Factory, ArrowDownToLine, Plus, Trash2, MapPin, Clock } from "lucide-react";
import { Card, Button, Input, Label, Select, Badge, StatusBadge, DemoTag, fmtDate, cn } from "@/components/ui";
import { useStore } from "@/lib/store";
import { FacilityType } from "@/lib/types";

const FacilitiesMap = dynamic(() => import("@/components/FacilitiesMap"), { ssr: false });

export default function FacilitiesPage() {
  const { facilities, deliveries, trucks, addDelivery } = useStore();
  const [typeF, setTypeF] = useState<"all" | FacilityType>("all");
  const [truckId, setTruckId] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [weight, setWeight] = useState("2000");
  const [msg, setMsg] = useState("");

  const filtered = facilities.filter((f) => typeF === "all" || f.type === typeF);
  const byType = useMemo(() => ({
    TPS: facilities.filter((f) => f.type === "TPS"),
    TPST: facilities.filter((f) => f.type === "TPST"),
    TPA: facilities.filter((f) => f.type === "TPA"),
  }), [facilities]);

  const recentDeliveries = deliveries.slice(0, 15);

  const submitDelivery = () => {
    const w = +weight;
    if (!truckId || !facilityId || isNaN(w) || w <= 0) { setMsg("Select truck, facility and a valid weight."); return; }
    addDelivery({ truckId, facilityId, weightKg: w });
    const tr = trucks.find((t) => t.id === truckId);
    const f = facilities.find((x) => x.id === facilityId);
    setMsg(`Recorded ${(w / 1000).toFixed(1)} t delivery: ${tr?.plate} → ${f?.name}.`);
    setTruckId(""); setFacilityId(""); setWeight("2000");
  };


  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900">Waste Facilities</h2>
          <DemoTag />
        </div>
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {(["all", "TPS", "TPST", "TPA"] as const).map((t) => (
            <button key={t} onClick={() => setTypeF(t)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", typeF === t ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100")}>
              {t === "all" ? "All" : t}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(["TPS", "TPST", "TPA"] as FacilityType[]).map((t) => {
          const list = byType[t];
          return (
            <Card key={t} className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t} Facilities</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{list.length}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* Facility cards */}
        <div className="grid gap-3 sm:grid-cols-2 xl:col-span-3">
          {filtered.map((f) => {
            return (
              <Card key={f.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={cn("rounded-xl p-2", f.type === "TPA" ? "bg-blue-50 text-blue-600" : f.type === "TPST" ? "bg-violet-50 text-violet-600" : "bg-teal-50 text-teal-600")}>
                      <Factory className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{f.name}</p>
                      <p className="text-[11px] text-slate-400">{f.type} · {f.operator}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{f.address}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{f.openHours}</span>
                </div>
                <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setFacilityId(f.id); document.getElementById("delivery-form")?.scrollIntoView({ behavior: "smooth" }); }}>
                    <ArrowDownToLine className="h-3.5 w-3.5" /> Record delivery
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Right column: map + delivery form */}
        <div className="space-y-4 xl:col-span-2">
          <FacilitiesMap />
          <Card id="delivery-form" className="p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900"><Plus className="h-4 w-4 text-emerald-600" /> Record Waste Delivery</h3>
            <div className="space-y-2.5">
              <div>
                <Label>Truck</Label>
                <Select value={truckId} onChange={(e) => setTruckId(e.target.value)}>
                  <option value="">Select truck…</option>
                  {trucks.map((t) => <option key={t.id} value={t.id}>{t.plate} — {t.name} ({(t.loadKg / 1000).toFixed(1)}t load)</option>)}
                </Select>
              </div>
              <div>
                <Label>Destination facility</Label>
                <Select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
                  <option value="">Select facility…</option>
                  {facilities.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.type})</option>)}
                </Select>
              </div>
              <div>
                <Label>Weight (kg)</Label>
                <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
              </div>
              <Button onClick={submitDelivery} className="w-full"><Trash2 className="h-4 w-4" /> Log Delivery</Button>
              {msg && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700">{msg}</p>}
            </div>
          </Card>
        </div>
      </div>

      {/* Deliveries table */}
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-900">Recent Deliveries & Transportation Flow</h3>
          <p className="text-xs text-slate-400">Truck → facility waste movement records</p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
              <tr><th className="px-5 py-2.5">ID</th><th className="px-3 py-2.5">Truck</th><th className="px-3 py-2.5">Route</th><th className="px-3 py-2.5">Destination</th><th className="px-3 py-2.5">Weight</th><th className="px-3 py-2.5">Timestamp</th><th className="px-5 py-2.5">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentDeliveries.map((d) => {
                const t = trucks.find((x) => x.id === d.truckId);
                const f = facilities.find((x) => x.id === d.facilityId);
                return (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-2.5 font-mono font-semibold text-slate-600">{d.id}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-700">{t?.plate ?? d.truckId}</td>
                    <td className="max-w-[160px] px-3 py-2.5"><p className="truncate text-slate-500">{t?.routeName}</p></td>
                    <td className="px-3 py-2.5 text-slate-700">{f?.name ?? d.facilityId} <span className="text-[10px] text-slate-400">({f?.type})</span></td>
                    <td className="px-3 py-2.5 font-semibold text-slate-700">{(d.weightKg / 1000).toFixed(1)} t</td>
                    <td className="px-3 py-2.5 text-slate-500">{fmtDate(d.timestamp)}</td>
                    <td className="px-5 py-2.5"><StatusBadge status={d.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
