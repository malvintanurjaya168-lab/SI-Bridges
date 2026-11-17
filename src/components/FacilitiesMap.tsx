"use client";

import React from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useStore } from "@/lib/store";

export default function FacilitiesMap() {
  const { facilities } = useStore();
  const color = (t: string) => (t === "TPS" ? "#0d9488" : t === "TPST" ? "#7c3aed" : "#1e40af");
  return (
    <div className="relative h-[300px] overflow-hidden rounded-2xl border border-slate-200">
      <MapContainer center={[-6.2, 106.82]} zoom={11} className="h-full w-full" zoomControl={false}>
        <TileLayer attribution="" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {facilities.map((f) => (
          <CircleMarker
            key={f.id}
            center={[f.lat, f.lng]}
            radius={9}
            pathOptions={{ color: "#fff", weight: 2, fillColor: color(f.type), fillOpacity: 0.95 }}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-bold">{f.name}</p>
                <p>{f.type} · {Math.round((f.currentLoadTons / f.capacityTons) * 100)}% capacity</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="pointer-events-none absolute bottom-2 left-2 z-[500] flex gap-2 rounded-lg bg-white/95 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 shadow">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-teal-600" />TPS</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-600" />TPST</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-700" />TPA</span>
      </div>
    </div>
  );
}
