"use client";

import React from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useStore } from "@/lib/store";
import { StatusBadge } from "@/components/ui";

const truckIcon = (status: string) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${status === "active" ? "#0d9488" : status === "idle" ? "#f59e0b" : status === "maintenance" ? "#64748b" : "#dc2626"};width:20px;height:20px;border-radius:6px;border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.35)"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

export default function FleetMap() {
  const { trucks } = useStore();
  const active = trucks.filter((t) => t.status === "active");
  return (
    <div className="relative h-[560px] overflow-hidden rounded-2xl border border-slate-200">
      <MapContainer center={[-6.2, 106.82]} zoom={12} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {trucks.map((t) => (
          <React.Fragment key={t.id}>
            {t.status === "active" && t.waypoints.length > 1 && (
              <Polyline positions={t.waypoints.map((w) => [w.lat, w.lng] as [number, number])} pathOptions={{ color: "#0d9488", weight: 1.5, opacity: 0.3, dashArray: "4 6" }} />
            )}
            <Marker position={[t.lat, t.lng]} icon={truckIcon(t.status)}>
              <Popup>
                <div className="text-xs">
                  <p className="font-bold">{t.plate} — {t.name}</p>
                  <p>{t.driver} · {t.team}</p>
                  <p className="mt-1">{t.routeName}</p>
                  <div className="mt-1"><StatusBadge status={t.status} /></div>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        ))}
      </MapContainer>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-[11px] text-slate-600 shadow">
        <p className="font-bold text-slate-800">{active.length} trucks moving</p>
        <p className="text-slate-400">Simulated GPS · {new Date().toLocaleTimeString("en-GB")}</p>
      </div>
    </div>
  );
}
