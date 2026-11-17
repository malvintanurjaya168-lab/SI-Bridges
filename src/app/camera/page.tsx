"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin, ClipboardList, CheckCircle2, ArrowRight } from "lucide-react";
import { Card, Button, Input, Label, Select, DemoTag, Badge, SeverityBadge, cn } from "@/components/ui";
import { useStore } from "@/lib/store";
import { DISTRICTS } from "@/lib/geo";
import type { LiveResult } from "@/components/LiveCamera";

const LiveCamera = dynamic(() => import("@/components/LiveCamera"), { ssr: false });

export default function CameraPage() {
  const { addDetection, createTaskFromDetection, trucks } = useStore();
  const [location, setLocation] = useState("");
  const [district, setDistrict] = useState<string>(DISTRICTS[0]);
  const [lat, setLat] = useState("-6.2000");
  const [lng, setLng] = useState("106.8200");
  const [live, setLive] = useState<LiveResult | null>(null);
  const [registered, setRegistered] = useState<string | null>(null);
  const [taskTruck, setTaskTruck] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const register = () => {
    const e: Record<string, string> = {};
    if (!live) e.live = "Start the camera and wait for a detection frame.";
    if (!location.trim()) e.location = "Location is required.";
    if (isNaN(+lat) || Math.abs(+lat) > 90) e.lat = "Invalid latitude.";
    if (isNaN(+lng) || Math.abs(+lng) > 180) e.lng = "Invalid longitude.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const det = addDetection({
      location,
      district,
      lat: +lat,
      lng: +lng,
      severity: live!.severity,
      confidence: Math.max(50, live!.confidence),
      aiClass: "live_object_detection",
      source: "live_camera",
      observations: [
        `Live camera detected ${live!.wasteCount} waste-related object(s): ${live!.objects.map((o) => o.label).join(", ") || "none"}.`,
        `${live!.totalDetections} total objects in frame.`,
      ],
      recommendedAction: live!.severity === "high"
        ? "Dispatch collection crew — dense waste objects detected in live view."
        : live!.severity === "moderate"
          ? "Schedule collection within 48 hours."
          : "Monitor area; include in routine sweep.",
      imageLabel: `live_frame_${new Date().toISOString().slice(11, 19).replace(/:/g, "")}.jpg`,
    });
    setRegistered(det.id);
  };

  const createTask = () => {
    if (!registered) return;
    const t = createTaskFromDetection(registered, taskTruck || undefined);
    if (t) setRegistered(`${t.id} created — task ${t.id}`);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <div className="xl:col-span-3">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Real-Time Camera Detection</h3>
              <p className="text-xs text-slate-400">TensorFlow.js COCO-SSD — runs 100% in your browser</p>
            </div>
            <Badge tone="purple">On-device ML</Badge>
          </div>
          <LiveCamera onResult={setLive} />
        </Card>
      </div>

      <div className="space-y-4 xl:col-span-2">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-bold text-slate-900">Detection Location</h3>
          <div className="space-y-3">
            <div>
              <Label>Location description *</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Jl. Thamrin KM 0.5" />
              {errors.location && <p className="mt-1 text-xs text-red-500">{errors.location}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>District</Label>
                <Select value={district} onChange={(e) => setDistrict(e.target.value)}>
                  {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
                </Select>
              </div>
              <div />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Latitude</Label>
                <Input value={lat} onChange={(e) => setLat(e.target.value)} />
                {errors.lat && <p className="mt-1 text-xs text-red-500">{errors.lat}</p>}
              </div>
              <div>
                <Label>Longitude</Label>
                <Input value={lng} onChange={(e) => setLng(e.target.value)} />
                {errors.lng && <p className="mt-1 text-xs text-red-500">{errors.lng}</p>}
              </div>
            </div>
          </div>

          {/* Live readout */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current ML assessment</p>
            {live ? (
              <div className="mt-2 flex items-center justify-between">
                <SeverityBadge severity={live.severity} />
                <span className="text-xs font-semibold text-slate-600">{live.wasteCount} waste objects · {live.confidence}% conf.</span>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">Waiting for camera frames…</p>
            )}
            {errors.live && <p className="mt-1 text-xs text-red-500">{errors.live}</p>}
          </div>

          <Button onClick={register} className="mt-4 w-full" disabled={!live}>
            <MapPin className="h-4 w-4" /> Register Detection
          </Button>

          {registered && (
            <div className="fade-up mt-3 space-y-2 rounded-xl bg-emerald-50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{registered.startsWith("TSK") ? registered : `Detection ${registered} registered — visible on GIS map.`}</p>
              {!registered.startsWith("TSK") && (
                <div className="flex gap-2">
                  <Select value={taskTruck} onChange={(e) => setTaskTruck(e.target.value)} className="flex-1 !py-1.5 text-xs">
                    <option value="">Assign truck…</option>
                    {trucks.filter((t) => t.status === "active" || t.status === "idle").map((t) => (
                      <option key={t.id} value={t.id}>{t.plate} — {t.team}</option>
                    ))}
                  </Select>
                  <Button size="sm" onClick={createTask}><ClipboardList className="h-3.5 w-3.5" /> Task</Button>
                </div>
              )}
              <Link href="/map" className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline">
                View on map <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">How it works</h3>
          <ol className="space-y-1.5 text-xs text-slate-600">
            <li><span className="font-bold text-emerald-600">1.</span> Camera frames are analyzed locally by COCO-SSD (MobileNetV2).</li>
            <li><span className="font-bold text-emerald-600">2.</span> Waste-related objects (bottles, cups, bags, boxes) are counted per frame.</li>
            <li><span className="font-bold text-emerald-600">3.</span> Object density maps to High / Moderate / Low accumulation.</li>
            <li><span className="font-bold text-emerald-600">4.</span> Registering creates a detection → alert → cleaning task → fleet dispatch.</li>
          </ol>
          <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-700">
            For phone access outside localhost, serve over HTTPS (e.g. <code>next dev --experimental-https</code> or a tunnel). Model weights load once from CDN.
          </p>
        </Card>
      </div>
    </div>
  );
}
