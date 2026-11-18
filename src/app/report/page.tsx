"use client";

import React, { useRef, useState } from "react";
import { Flag, Upload, Loader2, MapPin, Sparkles, CheckCircle2, LocateFixed } from "lucide-react";
import { Card, Button, Input, Label, Select, Badge, SeverityBadge, DemoTag, cn } from "@/components/ui";
import { useStore } from "@/lib/store";
import GpsButton from "@/components/GpsButton";
import { getSupabase } from "@/lib/supabase";
import { AIAnalysis, Severity } from "@/lib/types";
import { DISTRICTS } from "@/lib/geo";

export default function ReportPage() {
  const { addDetection, currentUser } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [district, setDistrict] = useState<string>(DISTRICTS[0]);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [ai, setAi] = useState<(AIAnalysis & { engine: string }) | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);

  const onFile = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setAi(null);
  };

  const analyzePhoto = async () => {
    if (!file || !preview) return;
    setAnalyzing(true);
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
      const form = new FormData();
      form.append("image", blob ?? file, "report.jpg");
      form.append("location", location || "Citizen report");
      form.append("district", district);
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      if (res.ok) {
        const a = await res.json();
        setAi({
          severity: a.severity,
          confidence: a.confidence,
          observations: a.observations ?? [],
          recommendedActions: a.recommendedAction ? [a.recommendedAction] : [],
          wasteTypes: a.wasteTypes ?? [],
          engine: a.engine ?? "unknown",
        });
      }
    } catch {
      // AI suggestion is optional — report still works without it
    }
    setAnalyzing(false);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!location.trim()) e.location = "Location description is required.";
    if (!lat || isNaN(+lat) || Math.abs(+lat) > 90) e.lat = "Invalid latitude — use 'Use my location' or enter manually.";
    if (!lng || isNaN(+lng) || Math.abs(+lng) > 180) e.lng = "Invalid longitude.";
    if (!notes.trim() && !file) e.notes = "Describe the waste pile or attach a photo.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    // Upload citizen photo to Supabase Storage so staff can see the evidence
    let imageUrl: string | undefined;
    const sb = getSupabase();
    if (file && sb) {
      try {
        const path = `reports/${crypto.randomUUID()}.jpg`;
        const { error } = await sb.storage.from("detection-images").upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
        if (!error) imageUrl = sb.storage.from("detection-images").getPublicUrl(path).data.publicUrl;
      } catch { /* storage optional — report still submits */ }
    }
    if (!imageUrl && preview) imageUrl = preview; // demo mode: local object URL
    const det = addDetection({
      location: location.trim(),
      district,
      lat: +lat,
      lng: +lng,
      // Citizen reports default to moderate/low-confidence; AI photo analysis may raise it.
      // A staff member must still review before any truck is dispatched.
      severity: ai?.severity ?? "moderate",
      confidence: ai ? Math.min(ai.confidence, 70) : 40,
      aiClass: ai ? `citizen_report_${ai.engine}` : "citizen_report",
      source: "citizen_report",
      observations: [
        `Reported by ${currentUser?.name ?? "citizen"}`,
        ...(notes.trim() ? [notes.trim()] : []),
        ...(ai?.observations ?? []),
      ],
      recommendedAction: ai?.recommendedActions[0] ?? "Review report and dispatch collection crew if confirmed.",
      imageLabel: file?.name,
      imageUrl,
    });
    setSubmitted(det.id);
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="fade-up p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h2 className="mt-3 text-lg font-bold text-slate-900">Report submitted</h2>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-mono font-semibold">{submitted}</span> is now in the review queue.
            An admin or operator will verify it before a truck is assigned.
          </p>
          <Button variant="secondary" className="mt-4" onClick={() => { setSubmitted(null); setFile(null); setPreview(null); setAi(null); setLocation(""); setNotes(""); setLat(""); setLng(""); }}>
            Submit another report
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Flag className="h-5 w-5 text-amber-500" /> Report Waste Pile</h1>
          <p className="text-sm text-slate-500">Spot a garbage pile? Report it — staff will review and dispatch a truck.</p>
        </div>
        <DemoTag />
      </div>

      <Card className="p-5">
        <div className="space-y-4">
          {/* Photo (optional) */}
          <div>
            <Label>Photo evidence (optional)</Label>
            <div
              onClick={() => fileRef.current?.click()}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 transition",
                preview ? "border-emerald-400 bg-emerald-50/40" : "border-slate-300 bg-slate-50/60 hover:border-emerald-400"
              )}
            >
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="report" className="h-14 w-14 rounded-lg object-cover" />
              ) : (
                <div className="rounded-lg bg-white p-2 text-slate-400 shadow-sm"><Upload className="h-4 w-4" /></div>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-700">{file ? file.name : "Add a photo of the pile"}</p>
                <p className="text-xs text-slate-400">Optional — AI can estimate severity from the photo</p>
              </div>
              {file && !ai && (
                <Button type="button" size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); analyzePhoto(); }} disabled={analyzing} className="ml-auto">
                  {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {analyzing ? "Analyzing…" : "AI estimate"}
                </Button>
              )}
            </div>
            {ai && (
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-slate-600">AI suggests</span>
                <SeverityBadge severity={ai.severity} />
                <span className="text-slate-500">{ai.confidence}% · {ai.engine}</span>
                <Badge tone="slate">staff will confirm</Badge>
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <Label>Location description *</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Jl. Sudirman near Plaza Indonesia, under the bridge" />
            {errors.location && <p className="mt-1 text-xs text-red-500">{errors.location}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>District</Label>
              <Select value={district} onChange={(e) => setDistrict(e.target.value)}>
                {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
              </Select>
            </div>
            <div className="flex items-end">
              <GpsButton onFix={(la, ln) => { setLat(la.toFixed(5)); setLng(ln.toFixed(5)); setErrors((e) => ({ ...e, lat: "", lng: "" })); }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Latitude *</Label>
              <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-6.2000" />
              {errors.lat && <p className="mt-1 text-xs text-red-500">{errors.lat}</p>}
            </div>
            <div>
              <Label>Longitude *</Label>
              <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="106.8200" />
              {errors.lng && <p className="mt-1 text-xs text-red-500">{errors.lng}</p>}
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>Description *</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="How big is the pile? How long has it been there? Any hazards (blocked drain, sharp objects)?"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            {errors.notes && <p className="mt-1 text-xs text-red-500">{errors.notes}</p>}
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] text-slate-500">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            Your report goes to the staff review queue — it appears on the GIS map immediately but no truck is dispatched until an admin or operator verifies it.
          </div>

          <Button onClick={submit} className="w-full">
            <Flag className="h-4 w-4" /> Submit Report
          </Button>
        </div>
      </Card>
    </div>
  );
}
