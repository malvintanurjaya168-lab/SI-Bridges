"use client";

import React, { useMemo, useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, MapPin, Clock, Cpu, ShieldCheck, Navigation, Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { SeverityBadge, StatusBadge, fmtDate, cn } from "@/components/ui";
import type { WasteDetection, Truck, Facility, FloodZone } from "@/lib/types";

const JAKARTA_CENTER: [number, number] = [-6.2, 106.82];

// Approximate Ciliwung river path (demo)
const CILIWUNG: [number, number][] = [
  [-6.36, 106.86], [-6.32, 106.87], [-6.29, 106.865], [-6.26, 106.855],
  [-6.23, 106.845], [-6.21, 106.84], [-6.19, 106.835], [-6.17, 106.84],
  [-6.15, 106.845], [-6.13, 106.85], [-6.11, 106.855],
];
const WEST_FLOOD_CANAL: [number, number][] = [
  [-6.2, 106.77], [-6.19, 106.775], [-6.18, 106.78], [-6.17, 106.785], [-6.16, 106.79],
];

function pinIcon(cls: string, extra?: string) {
  return L.divIcon({
    className: "",
    html: `<div class="wm-pin ${cls} ${extra ?? ""}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function truckIcon() {
  return L.divIcon({
    className: "",
    html: `<div class="relative"><div class="wm-pin truck pulse-dot"></div></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function clusterIcon(count: number) {
  return L.divIcon({
    className: "",
    html: `<div style="background:#0d9488;color:#fff;border:2px solid #fff;border-radius:9999px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;box-shadow:0 3px 8px rgba(0,0,0,.35)">${count}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  useEffect(() => onZoom(map.getZoom()), [map, onZoom]);
  return null;
}

interface Selection {
  kind: "detection" | "truck" | "facility" | "flood";
  id: string;
}

export default function JakartaMap({ search = "", severityFilter = "all" }: { search?: string; severityFilter?: string }) {
  const { detections, trucks, facilities, floodZones, layers } = useStore();
  const [zoom, setZoom] = useState(12);
  const [sel, setSel] = useState<Selection | null>(null);

  // Grid clustering for detections at low zoom
  const detPoints = useMemo(() => {
    let pts = detections.filter((d) => d.status !== "rejected");
    if (severityFilter !== "all") pts = pts.filter((d) => d.severity === severityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      pts = pts.filter((d) => d.location.toLowerCase().includes(q) || d.district.toLowerCase().includes(q));
    }
    return pts;
  }, [detections, severityFilter, search]);

  const clusters = useMemo(() => {
    if (zoom >= 14 || detPoints.length === 0) return [];
    const cell = zoom <= 11 ? 0.06 : 0.025;
    const map = new Map<string, WasteDetection[]>();
    detPoints.forEach((d) => {
      const key = `${Math.round(d.lat / cell)}:${Math.round(d.lng / cell)}`;
      const arr = map.get(key) ?? [];
      arr.push(d);
      map.set(key, arr);
    });
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      lat: items.reduce((a, d) => a + d.lat, 0) / items.length,
      lng: items.reduce((a, d) => a + d.lng, 0) / items.length,
      items,
      count: items.length,
    }));
  }, [detPoints, zoom]);

  const selectedDetection = sel?.kind === "detection" ? detPoints.find((d) => d.id === sel.id) : null;
  const selectedTruck = sel?.kind === "truck" ? trucks.find((t) => t.id === sel.id) : null;
  const selectedFacility = sel?.kind === "facility" ? facilities.find((f) => f.id === sel.id) : null;
  const selectedFlood = sel?.kind === "flood" ? floodZones.find((f) => f.id === sel.id) : null;

  const sevColor: Record<string, string> = { high: "#dc2626", moderate: "#f97316", low: "#16a34a" };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200">
      <MapContainer center={JAKARTA_CENTER} zoom={12} className="h-full w-full" zoomControl={true}>
        <ZoomTracker onZoom={setZoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Rivers */}
        {layers.rivers && (
          <>
            <Polyline positions={CILIWUNG} pathOptions={{ color: "#0284c7", weight: 5, opacity: 0.55 }} />
            <Polyline positions={WEST_FLOOD_CANAL} pathOptions={{ color: "#0284c7", weight: 3, opacity: 0.4, dashArray: "6 6" }} />
          </>
        )}

        {/* Flood zones */}
        {layers.flood &&
          floodZones.map((f) => {
            const color = f.risk === "high" ? "#dc2626" : f.risk === "moderate" ? "#f97316" : f.risk === "low" ? "#16a34a" : "#94a3b8";
            return (
              <Circle
                key={f.id}
                center={[f.lat, f.lng]}
                radius={450}
                pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.12, dashArray: "5 5" }}
                eventHandlers={{ click: () => setSel({ kind: "flood", id: f.id }) }}
              />
            );
          })}

        {/* Facilities */}
        {layers.tps && facilities.filter((f) => f.type === "TPS").map((f) => (
          <Marker key={f.id} position={[f.lat, f.lng]} icon={pinIcon("facility", "fac-tps")} eventHandlers={{ click: () => setSel({ kind: "facility", id: f.id }) }} />
        ))}
        {layers.tpst && facilities.filter((f) => f.type === "TPST").map((f) => (
          <Marker key={f.id} position={[f.lat, f.lng]} icon={pinIcon("facility", "fac-tpst")} eventHandlers={{ click: () => setSel({ kind: "facility", id: f.id }) }} />
        ))}
        {layers.tpa && facilities.filter((f) => f.type === "TPA").map((f) => (
          <Marker key={f.id} position={[f.lat, f.lng]} icon={pinIcon("facility", "fac-tpa")} eventHandlers={{ click: () => setSel({ kind: "facility", id: f.id }) }} />
        ))}

        {/* Routes */}
        {layers.routes &&
          trucks.map((t) => (
            <Polyline
              key={t.id}
              positions={t.waypoints.map((w) => [w.lat, w.lng] as [number, number])}
              pathOptions={{ color: "#0d9488", weight: 2, opacity: 0.35, dashArray: "4 6" }}
            />
          ))}

        {/* Trucks */}
        {layers.trucks &&
          trucks.map((t) => (
            <Marker
              key={t.id}
              position={[t.lat, t.lng]}
              icon={truckIcon()}
              eventHandlers={{ click: () => setSel({ kind: "truck", id: t.id }) }}
            />
          ))}

        {/* Detection clusters (low zoom) */}
        {layers.detections && zoom < 14 &&
          clusters.map((c) => (
            <Marker
              key={c.key}
              position={[c.lat, c.lng]}
              icon={clusterIcon(c.count)}
              eventHandlers={{ click: () => setSel({ kind: "detection", id: c.items[0].id }) }}
            />
          ))}

        {/* Detection markers (high zoom) */}
        {layers.detections && zoom >= 14 &&
          detPoints.map((d) => (
            <Marker
              key={d.id}
              position={[d.lat, d.lng]}
              icon={pinIcon(d.severity)}
              eventHandlers={{ click: () => setSel({ kind: "detection", id: d.id }) }}
            />
          ))}
      </MapContainer>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-[500] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Legend</p>
        <div className="space-y-1.5 text-[11px] text-slate-600">
          {[
            ["high", "High waste", "#dc2626"],
            ["moderate", "Moderate", "#f97316"],
            ["low", "Low", "#16a34a"],
          ].map(([k, label, color]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ background: color }} /> {label}
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="wm-pin truck" style={{ width: 12, height: 12 }} /> Truck
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-blue-700" /> Facility
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border-2 border-violet-600" /> Flood zone
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-4 rounded bg-sky-600" /> Waterway
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {sel && (selectedDetection || selectedTruck || selectedFacility || selectedFlood) && (
        <div className="absolute right-3 top-3 z-[500] w-[320px] max-w-[calc(100%-24px)] rounded-2xl border border-slate-200 bg-white shadow-2xl fade-up">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-900">
              {selectedDetection ? "Detection Detail" : selectedTruck ? "Truck Detail" : selectedFacility ? "Facility Detail" : "Flood Risk Area"}
            </p>
            <button onClick={() => setSel(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[420px] overflow-y-auto p-4">
            {selectedDetection && <DetectionPanel d={selectedDetection} />}
            {selectedTruck && <TruckPanel t={selectedTruck} />}
            {selectedFacility && <FacilityPanel f={selectedFacility} />}
            {selectedFlood && <FloodPanel f={selectedFlood} />}
          </div>
        </div>
      )}

      {/* Zoom hint */}
      {zoom < 14 && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[500] -translate-x-1/2 rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
          Zoom in to see individual detections ({detPoints.length} points)
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className="text-right text-xs font-medium text-slate-700">{value}</span>
    </div>
  );
}

function DetectionPanel({ d }: { d: WasteDetection }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <SeverityBadge severity={d.severity} />
        <StatusBadge status={d.status} />
      </div>
      <p className="text-sm font-bold text-slate-900">{d.location}</p>
      <p className="text-xs text-slate-500">{d.district}</p>
      <div className="mt-3 rounded-xl bg-slate-50 p-3">
        {/* fake image evidence */}
        <div className="flex h-28 items-center justify-center rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 text-slate-500">
          <div className="text-center">
            <MapPin className="mx-auto h-6 w-6" />
            <p className="mt-1 text-[10px] font-medium">{d.imageLabel ?? "street_capture.jpg"}</p>
          </div>
        </div>
      </div>
      <div className="mt-2 divide-y divide-slate-100">
        <Row label="Coordinates" value={<span className="font-mono text-[11px]">{d.lat.toFixed(5)}, {d.lng.toFixed(5)}</span>} />
        <Row label="Detected" value={fmtDate(d.detectedAt)} />
        <Row label="AI class" value={<span className="font-mono text-[11px]">{d.aiClass}</span>} />
        <Row label="Confidence" value={`${d.confidence}%`} />
        <Row label="Source" value={d.source.replace("_", " ")} />
      </div>
      <div className="mt-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Observations</p>
        <ul className="mt-1 space-y-1">
          {d.observations.map((o, i) => <li key={i} className="text-xs text-slate-600">• {o}</li>)}
        </ul>
      </div>
    </div>
  );
}

function TruckPanel({ t }: { t: Truck }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-slate-900">{t.plate}</p>
        <StatusBadge status={t.status} />
      </div>
      <p className="text-xs text-slate-500">{t.name} · {t.routeName}</p>
      <div className="mt-3 divide-y divide-slate-100">
        <Row label="Driver" value={t.driver} />
        <Row label="Team" value={t.team} />
        <Row label="Load" value={`${(t.loadKg / 1000).toFixed(1)} / ${(t.capacityKg / 1000).toFixed(1)} t`} />
        <Row label="Speed" value={`${t.speedKmh} km/h`} />
        <Row label="Last GPS" value={fmtDate(t.lastUpdate)} />
        <Row label="Coordinates" value={<span className="font-mono text-[11px]">{t.lat.toFixed(5)}, {t.lng.toFixed(5)}</span>} />
      </div>
      {t.status === "active" && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-teal-50 px-2.5 py-1.5 text-[11px] font-medium text-teal-700">
          <Navigation className="h-3 w-3" /> Live position (simulated GPS)
        </p>
      )}
    </div>
  );
}

function FacilityPanel({ f }: { f: Facility }) {
  const pct = Math.round((f.currentLoadTons / f.capacityTons) * 100);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-slate-900">{f.name}</p>
        <StatusBadge status={f.status} />
      </div>
      <p className="text-xs text-slate-500">{f.type} · {f.operator}</p>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[11px]">
          <span className="text-slate-400">Capacity</span>
          <span className="font-semibold text-slate-700">{f.currentLoadTons.toLocaleString()} / {f.capacityTons.toLocaleString()} t ({pct}%)</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={cn("h-full rounded-full", pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="mt-3 divide-y divide-slate-100">
        <Row label="Address" value={f.address} />
        <Row label="Hours" value={f.openHours} />
        <Row label="Coordinates" value={<span className="font-mono text-[11px]">{f.lat.toFixed(5)}, {f.lng.toFixed(5)}</span>} />
      </div>
    </div>
  );
}

function FloodPanel({ f }: { f: FloodZone }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-slate-900">{f.name}</p>
        <SeverityBadge severity={f.risk === "insufficient" ? "low" : f.risk} />
      </div>
      <p className="text-xs text-slate-500">{f.district} · Risk score {f.score}/100</p>
      <div className="mt-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Environmental factors</p>
        <div className="mt-1 space-y-1.5">
          {f.factors.map((fac, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
              <span className="text-slate-600">{fac.label}</span>
              <span className={cn("font-semibold", fac.impact === "negative" ? "text-red-600" : fac.impact === "positive" ? "text-emerald-600" : "text-slate-500")}>{fac.value}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 rounded-lg bg-violet-50 px-2.5 py-1.5 text-[10px] leading-relaxed text-violet-700">
        Decision-support indicator only — not an official flood prediction.
      </p>
    </div>
  );
}

// Exposed search helper used by page
export function MapSearchHint() {
  return (
    <div className="flex items-center gap-2 text-slate-400">
      <Search className="h-4 w-4" />
    </div>
  );
}
