"use client";

import React, { useEffect, useRef, useState } from "react";
import { Crosshair, Navigation, Square, AlertTriangle } from "lucide-react";
import { Badge, Button, Card, Select } from "@/components/ui";
import { useStore } from "@/lib/store";

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export default function LiveGpsPanel() {
  const { trucks, setTruckGpsLive, reportTruckPosition } = useStore();
  const [truckId, setTruckId] = useState(trucks[0]?.id ?? "");
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState("");
  const [telemetry, setTelemetry] = useState<{ lat: number; lng: number; acc: number; speed: number; at: string } | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastFix = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const lastSent = useRef(0);

  // keep selection valid if trucks reload
  useEffect(() => {
    if (!trucks.some((t) => t.id === truckId)) setTruckId(trucks[0]?.id ?? "");
  }, [trucks, truckId]);

  const stop = () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    if (truckId) setTruckGpsLive(truckId, false);
    setTracking(false);
    lastFix.current = null;
  };

  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    setError("");
    if (!truckId) return;
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }
    setTruckGpsLive(truckId, true);
    setTracking(true);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        const { latitude: lat, longitude: lng, accuracy, speed } = pos.coords;
        // throttle DB writes to ~1 per 3s
        if (now - lastSent.current > 3000) {
          lastSent.current = now;
          let speedKmh: number | undefined;
          if (typeof speed === "number" && !Number.isNaN(speed)) {
            speedKmh = Math.round(speed * 3.6);
          } else if (lastFix.current) {
            const dt = (now - lastFix.current.t) / 1000;
            if (dt > 0.5) speedKmh = Math.round((haversineM(lastFix.current.lat, lastFix.current.lng, lat, lng) / dt) * 3.6);
          }
          reportTruckPosition(truckId, lat, lng, speedKmh);
        }
        lastFix.current = { lat, lng, t: now };
        setTelemetry({ lat, lng, acc: Math.round(accuracy), speed: typeof speed === "number" ? Math.round(speed * 3.6) : 0, at: new Date().toISOString() });
      },
      (err) => {
        const msgs: Record<number, string> = {
          1: "Location permission denied — allow location access for this site.",
          2: "Position unavailable — check GPS/location services are on.",
          3: "Location request timed out — try again in an open area.",
        };
        setError(msgs[err.code] ?? err.message);
        stop();
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
  };

  const selected = trucks.find((t) => t.id === truckId);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Crosshair className="h-4 w-4 text-teal-600" /> Live GPS Tracking
        </h3>
        {tracking && <Badge tone="green">LIVE</Badge>}
      </div>

      <div className="space-y-3">
        <Select
          value={truckId}
          onChange={(e) => {
            if (tracking) stop();
            setTruckId(e.target.value);
          }}
          disabled={tracking}
          className="w-full"
        >
          {trucks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.plate} — {t.driver || t.name}
            </option>
          ))}
        </Select>

        {tracking ? (
          <Button variant="danger" size="sm" onClick={stop} className="w-full">
            <Square className="mr-1.5 h-3.5 w-3.5" /> Stop Tracking
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={start} disabled={!truckId} className="w-full">
            <Navigation className="mr-1.5 h-3.5 w-3.5" /> Start GPS Tracking
          </Button>
        )}

        {telemetry && (
          <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600">
            <p className="font-mono">
              {telemetry.lat.toFixed(5)}, {telemetry.lng.toFixed(5)}
            </p>
            <p>
              Accuracy ±{telemetry.acc}m · Speed {telemetry.speed} km/h
            </p>
          </div>
        )}

        {error && (
          <p className="flex items-start gap-1.5 rounded-lg bg-red-50 p-2 text-[11px] text-red-600">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
          </p>
        )}

        <p className="text-[10px] leading-relaxed text-slate-400">
          Uses your device&apos;s real GPS. While tracking, simulated movement is paused for{" "}
          {selected?.plate ?? "this truck"} and its live position syncs to all users. Requires HTTPS or
          localhost — on a phone use the network URL shown by <code>npm run dev</code> or a tunnel (e.g.
          cloudflared).
        </p>
      </div>
    </Card>
  );
}
