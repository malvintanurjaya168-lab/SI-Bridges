"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Search, Layers, LocateFixed } from "lucide-react";
import { Card, Input, Select, Badge, DemoTag, cn } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { LayerKey } from "@/lib/types";

const JakartaMap = dynamic(() => import("@/components/JakartaMap"), { ssr: false });

const LAYER_LABELS: { key: LayerKey; label: string }[] = [
  { key: "detections", label: "Waste Detections" },
  { key: "trucks", label: "Truck Positions" },
  { key: "routes", label: "Truck Routes" },
  { key: "tps", label: "TPS" },
  { key: "tpst", label: "TPST" },
  { key: "tpa", label: "TPA" },
  { key: "flood", label: "Flood-Prone Areas" },
  { key: "rivers", label: "Rivers & Waterways" },
];

export default function MapPage() {
  const { layers, toggleLayer } = useStore();
  const [search, setSearch] = useState("");
  const [sev, setSev] = useState("all");
  const [showLayers, setShowLayers] = useState(true);

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search location or district…" className="pl-9" />
        </div>
        <Select value={sev} onChange={(e) => setSev(e.target.value)} className="w-40">
          <option value="all">All severities</option>
          <option value="high">High</option>
          <option value="moderate">Moderate</option>
          <option value="low">Low</option>
        </Select>
        <button
          onClick={() => setShowLayers(!showLayers)}
          className={cn(
            "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition",
            showLayers ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-600"
          )}
        >
          <Layers className="h-4 w-4" /> Layers
        </button>
        <Badge tone="amber"><LocateFixed className="h-3 w-3" /> Jakarta, Indonesia</Badge>
        <DemoTag />
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        {/* Layer panel */}
        {showLayers && (
          <Card className="hidden w-56 shrink-0 flex-col p-4 md:flex">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Map Layers</p>
            <div className="space-y-1">
              {LAYER_LABELS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => toggleLayer(key)}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-slate-50"
                >
                  <span className={cn("font-medium", layers[key] ? "text-slate-800" : "text-slate-400")}>{label}</span>
                  <span className={cn("relative h-5 w-9 rounded-full transition", layers[key] ? "bg-emerald-500" : "bg-slate-200")}>
                    <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", layers[key] ? "left-[18px]" : "left-0.5")} />
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-auto border-t border-slate-100 pt-3">
              <p className="text-[10px] leading-relaxed text-slate-400">
                Basemap: OpenStreetMap. Positions & flood zones are synthetic demo data.
              </p>
            </div>
          </Card>
        )}

        {/* Map */}
        <div className="min-w-0 flex-1">
          <JakartaMap search={search} severityFilter={sev} />
        </div>
      </div>
    </div>
  );
}
