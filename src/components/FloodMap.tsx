"use client";

import React, { useState } from "react";
import { MapContainer, TileLayer, Circle, Marker, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useStore } from "@/lib/store";

export default function FloodMap() {
  const { floodZones, detections } = useStore();
  const [selId, setSelId] = useState<string | null>(null);
  const color = (r: string) => (r === "high" ? "#dc2626" : r === "moderate" ? "#f97316" : r === "low" ? "#16a34a" : "#94a3b8");

  return (
    <div className="relative h-[480px] overflow-hidden rounded-2xl border border-slate-200">
      <MapContainer center={[-6.2, 106.82]} zoom={11} className="h-full w-full">
        <TileLayer attribution="" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {/* waste detections backdrop */}
        {detections.filter((d) => d.status !== "rejected").map((d) => (
          <CircleMarker
            key={d.id}
            center={[d.lat, d.lng]}
            radius={3}
            pathOptions={{ color: "#fff", weight: 1, fillColor: d.severity === "high" ? "#dc2626" : d.severity === "moderate" ? "#f97316" : "#16a34a", fillOpacity: 0.7 }}
          />
        ))}
        {floodZones.map((f) => (
          <Circle
            key={f.id}
            center={[f.lat, f.lng]}
            radius={500}
            pathOptions={{
              color: color(f.risk), weight: selId === f.id ? 3.5 : 2,
              fillColor: color(f.risk), fillOpacity: selId === f.id ? 0.22 : 0.1,
              dashArray: "5 5",
            }}
            eventHandlers={{ click: () => setSelId(selId === f.id ? null : f.id) }}
          />
        ))}
        {floodZones.map((f) => (
          <Marker
            key={`m-${f.id}`}
            position={[f.lat, f.lng]}
            icon={L.divIcon({ className: "", html: `<div style="width:14px;height:14px;border-radius:50%;background:${color(f.risk)};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`, iconSize: [14, 14], iconAnchor: [7, 7] })}
            eventHandlers={{ click: () => setSelId(selId === f.id ? null : f.id) }}
          />
        ))}
      </MapContainer>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Risk zones</p>
        <div className="mt-1 space-y-1 text-[11px] text-slate-600">
          {[["High", "#dc2626"], ["Moderate", "#f97316"], ["Low", "#16a34a"], ["Insufficient", "#94a3b8"]].map(([l, c]) => (
            <div key={l} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{l}</div>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute right-3 top-3 z-[500] rounded-lg bg-violet-600/90 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">
        DEMO ANALYSIS
      </div>
    </div>
  );
}
