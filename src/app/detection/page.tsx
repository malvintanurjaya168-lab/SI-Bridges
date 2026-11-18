"use client";

import React, { useRef, useState } from "react";
import { Upload, Image as ImageIcon, Loader2, CheckCircle2, XCircle, ClipboardList, Sparkles, AlertTriangle } from "lucide-react";
import { Card, Button, Input, Label, Select, Badge, SeverityBadge, StatusBadge, DemoTag, fmtDate, cn, EmptyState } from "@/components/ui";
import { useStore } from "@/lib/store";
import { AIAnalysis, WasteDetection } from "@/lib/types";
import { DISTRICTS } from "@/lib/geo";

export default function DetectionPage() {
  const { addDetection, verifyDetection, rejectDetection, createTaskFromDetection, detections, trucks, simulateAI } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [district, setDistrict] = useState<string>(DISTRICTS[0]);
  const [lat, setLat] = useState("-6.2000");
  const [lng, setLng] = useState("106.8200");
  const [analyzing, setAnalyzing] = useState(false);
  const [engine, setEngine] = useState<"openai" | "gemini" | "demo">("openai");
  const [result, setResult] = useState<(AIAnalysis & { detection?: WasteDetection }) | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [taskTruck, setTaskTruck] = useState("");
  const [taskMsg, setTaskMsg] = useState("");

  const onFile = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setResult(null);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!file) e.file = "Please upload a street image.";
    if (!location.trim()) e.location = "Location description is required.";
    if (!lat || isNaN(+lat) || Math.abs(+lat) > 90) e.lat = "Invalid latitude.";
    if (!lng || isNaN(+lng) || Math.abs(+lng) > 180) e.lng = "Invalid longitude.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const runAnalysis = async () => {
    if (!validate() || !preview) return;
    setAnalyzing(true);
    setTaskMsg("");
    try {
      // 1) Try OpenAI vision API (server route keeps key secret)
      const form = new FormData();
      form.append("image", file!);
      form.append("location", location);
      form.append("district", district);
      const apiRes = await fetch("/api/analyze", { method: "POST", body: form });
      if (apiRes.ok) {
        const a = await apiRes.json();
        const engineName = a.engine === "gemini" ? "gemini" : "openai";
        const analysis: AIAnalysis = {
          severity: a.severity,
          confidence: a.confidence,
          observations: a.observations?.length ? a.observations : ["Scene analyzed by vision model."],
          recommendedActions: a.recommendedAction ? [a.recommendedAction] : [
            a.severity === "high" ? "Dispatch collection crew within 24 hours." :
            a.severity === "moderate" ? "Schedule routine collection within 48 hours." :
            "Include in next scheduled sweep.",
          ],
          wasteTypes: a.wasteTypes?.length ? a.wasteTypes : [{ label: "Mixed waste", pct: 100 }],
        };
        setEngine(engineName);
        setResult(analysis);
        setAnalyzing(false);
        return;
      }
    } catch (e) {
      console.warn("Vision API unavailable, using demo analysis", e);
    }

    // Fallback: demo heuristic (only when no vision API key is configured/reachable)
    const a = simulateAI(location, district, file?.name);
    setEngine("demo");
    setResult(a);
    setAnalyzing(false);
  };

  const confirmDetection = () => {
    if (!result) return;
    const det = addDetection({
      location,
      district,
      lat: +lat,
      lng: +lng,
      severity: result.severity,
      confidence: result.confidence,
      aiClass: engine === "openai" ? "gpt4o_vision_analysis" : engine === "gemini" ? "gemini_vision_analysis" : result.severity === "high" ? "severe_accumulation" : result.severity === "moderate" ? "moderate_accumulation" : "minor_litter",
      source: "manual",
      observations: result.observations,
      recommendedAction: result.recommendedActions[0],
      imageLabel: file?.name,
    });
    setResult({ ...result, detection: det });
    setTaskMsg(`Detection ${det.id} recorded on the map.`);
  };

  const makeTask = () => {
    if (!result?.detection) return;
    const task = createTaskFromDetection(result.detection.id, taskTruck || undefined);
    setTaskMsg(task ? `Cleaning task ${task.id} created${task.truckId ? ` and assigned to ${task.truckId}` : " (pending assignment)"}.` : "Failed to create task.");
  };

  const recent = detections.filter((d) => d.status !== "rejected").slice(0, 12);

  return (
    <div className="grid gap-5 xl:grid-cols-5">
      {/* Upload + form */}
      <div className="space-y-5 xl:col-span-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">New Street Analysis</h3>
              <p className="text-xs text-slate-400">Upload a photo and location for AI classification</p>
            </div>
            <DemoTag />
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0] ?? null); }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition",
              preview ? "border-emerald-400 bg-emerald-50/40" : "border-slate-300 bg-slate-50/60 hover:border-emerald-400 hover:bg-emerald-50/30"
            )}
          >
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="preview" className="mb-2 max-h-44 rounded-xl object-cover shadow" />
            ) : (
              <div className="rounded-2xl bg-white p-3 text-slate-400 shadow-sm"><Upload className="h-6 w-6" /></div>
            )}
            <p className="mt-2 text-sm font-semibold text-slate-700">{file ? file.name : "Drop image or click to upload"}</p>
            <p className="text-xs text-slate-400">JPG/PNG — street-level capture preferred</p>
            {errors.file && <p className="mt-1 text-xs text-red-500">{errors.file}</p>}
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <Label>Location description *</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Jl. Thamrin KM 0.5, near Bundaran HI" />
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
                <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-6.2000" />
                {errors.lat && <p className="mt-1 text-xs text-red-500">{errors.lat}</p>}
              </div>
              <div>
                <Label>Longitude</Label>
                <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="106.8200" />
                {errors.lng && <p className="mt-1 text-xs text-red-500">{errors.lng}</p>}
              </div>
            </div>
          </div>

          <Button onClick={runAnalysis} disabled={analyzing} className="mt-4 w-full">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {analyzing ? "Analyzing image…" : "Run AI Analysis"}
          </Button>
          <p className="mt-2 text-center text-[10px] text-slate-400">
            {engine === "openai" ? "GPT-4o vision (OpenAI)." : engine === "gemini" ? "Gemini vision (Google, free tier)." : "Demo heuristic fallback."}
          </p>
        </Card>

        {/* Result */}
        {result && (
          <Card className="fade-up p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Sparkles className="h-4 w-4 text-emerald-600" /> AI Analysis Result
              </h3>
              <div className="flex items-center gap-2">
                <Badge tone={engine === "openai" || engine === "gemini" ? "green" : "amber"}>
                  {engine === "openai" ? "GPT-4o" : engine === "gemini" ? "Gemini" : "Demo AI"}
                </Badge>
                <SeverityBadge severity={result.severity} />
              </div>
            </div>
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="analyzed" className="mb-3 max-h-56 w-full rounded-xl object-cover" />
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-[10px] font-bold uppercase text-slate-400">Confidence</p>
                <p className="text-xl font-bold text-slate-900">{result.confidence}%</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-[10px] font-bold uppercase text-slate-400">Classification</p>
                <p className="text-sm font-bold capitalize text-slate-900">{result.severity} accumulation</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Waste composition (est.)</p>
              <div className="mt-2 space-y-1.5">
                {result.wasteTypes.map((w) => (
                  <div key={w.label}>
                    <div className="mb-0.5 flex justify-between text-[11px]">
                      <span className="text-slate-600">{w.label}</span><span className="font-semibold text-slate-500">{w.pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${w.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Observations</p>
              <ul className="mt-1 space-y-1">
                {result.observations.map((o, i) => (
                  <li key={i} className="flex gap-1.5 text-xs text-slate-600"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />{o}</li>
                ))}
              </ul>
            </div>
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recommended actions</p>
              <ul className="mt-1 space-y-1">
                {result.recommendedActions.map((a, i) => <li key={i} className="text-xs text-slate-600">• {a}</li>)}
              </ul>
            </div>

            {!result.detection ? (
              <Button onClick={confirmDetection} className="mt-4 w-full" variant="secondary">
                <CheckCircle2 className="h-4 w-4" /> Confirm & Register Detection
              </Button>
            ) : (
              <div className="mt-4 space-y-2">
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">✓ {result.detection.id} is now on the GIS map.</p>
                <div className="flex gap-2">
                  <Select value={taskTruck} onChange={(e) => setTaskTruck(e.target.value)} className="flex-1">
                    <option value="">Assign truck…</option>
                    {trucks.filter((t) => t.status === "active" || t.status === "idle").map((t) => (
                      <option key={t.id} value={t.id}>{t.plate} — {t.name}</option>
                    ))}
                  </Select>
                  <Button onClick={makeTask} variant="primary"><ClipboardList className="h-4 w-4" /> Create Task</Button>
                </div>
              </div>
            )}
            {taskMsg && <p className="mt-2 text-xs font-medium text-slate-600">{taskMsg}</p>}
          </Card>
        )}
      </div>

      {/* Recent detections */}
      <Card className="xl:col-span-3">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Detection Records</h3>
            <p className="text-xs text-slate-400">Review, verify, or create tasks from AI detections</p>
          </div>
          <Badge tone="slate">{recent.length} shown</Badge>
        </div>
        <div className="max-h-[560px] overflow-y-auto">
          {recent.length === 0 ? (
            <EmptyState icon={<ImageIcon className="h-6 w-6" />} title="No detections yet" sub="Run an analysis or wait for truck camera feeds." />
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-2.5">ID</th><th className="px-3 py-2.5">Location</th>
                  <th className="px-3 py-2.5">Severity</th><th className="px-3 py-2.5">Conf.</th>
                  <th className="px-3 py-2.5">Source</th><th className="px-3 py-2.5">Detected</th>
                  <th className="px-3 py-2.5">Status</th><th className="px-5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-2.5 font-mono font-semibold text-slate-700">{d.id}</td>
                    <td className="max-w-[200px] px-3 py-2.5">
                      <p className="truncate font-medium text-slate-700">{d.location}</p>
                      <p className="text-[10px] text-slate-400">{d.district}</p>
                    </td>
                    <td className="px-3 py-2.5"><SeverityBadge severity={d.severity} /></td>
                    <td className="px-3 py-2.5 font-semibold text-slate-600">{d.confidence}%</td>
                    <td className="px-3 py-2.5 capitalize text-slate-500">{d.source.replace("_", " ")}</td>
                    <td className="px-3 py-2.5 text-slate-500">{fmtDate(d.detectedAt)}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={d.status} /></td>
                    <td className="px-5 py-2.5">
                      <div className="flex justify-end gap-1">
                        {d.status === "new" && (
                          <>
                            <button onClick={() => verifyDetection(d.id)} title="Verify" className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"><CheckCircle2 className="h-4 w-4" /></button>
                            <button onClick={() => rejectDetection(d.id)} title="Reject" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><XCircle className="h-4 w-4" /></button>
                          </>
                        )}
                        {["verified", "new"].includes(d.status) && (
                          <button
                            onClick={() => { const t = createTaskFromDetection(d.id); setTaskMsg(t ? `Task ${t.id} created.` : ""); }}
                            title="Create task"
                            className="rounded-lg p-1.5 text-teal-600 hover:bg-teal-50"
                          ><ClipboardList className="h-4 w-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
