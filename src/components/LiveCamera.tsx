"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2, Trash2, Package, Box } from "lucide-react";
import { Button, Badge, SeverityBadge, cn } from "@/components/ui";
import type { Severity } from "@/lib/types";

// COCO-SSD classes mapped to waste-relevant objects
const WASTE_CLASSES = new Set([
  "bottle", "cup", "backpack", "handbag", "suitcase", "sports ball", "kite", "book",
]);

export interface LiveResult {
  severity: Severity;
  wasteCount: number;
  totalDetections: number;
  confidence: number;
  objects: { label: string; score: number }[];
  timestamp: number;
}

interface Props {
  onResult?: (r: LiveResult) => void;
}

type Phase = "idle" | "loading_model" | "requesting_camera" | "running" | "error";

export default function LiveCamera({ onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<unknown>(null);
  const rafRef = useRef<number>(0);
  const busyRef = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [live, setLive] = useState<LiveResult | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [fps, setFps] = useState(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
    setPhase("idle");
    setLive(null);
  }, []);

  const start = useCallback(async () => {
    setError("");
    setPhase("loading_model");
    try {
      // Lazy-load TF.js + model (client only)
      const cocoSsd = await import("@tensorflow-models/coco-ssd");
      const tf = await import("@tensorflow/tfjs");
      await tf.ready();
      const model = await cocoSsd.load({ base: "lite_mobilenet_v2" });
      modelRef.current = model;

      setPhase("requesting_camera");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("video element missing");
      video.srcObject = stream;
      await video.play();
      setPhase("running");

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d") ?? null;
      let lastFps = Date.now();
      let frames = 0;

      const detectLoop = async () => {
        if (!modelRef.current || !videoRef.current || videoRef.current.paused) return;
        if (!busyRef.current) {
          busyRef.current = true;
          try {
            const preds = await (modelRef.current as { detect: (v: HTMLVideoElement, o?: object) => Promise<{ bbox: number[]; class: string; score: number }[]> }).detect(videoRef.current, { maxNumBoxes: 30 });
            const v = videoRef.current;
            const c = canvasRef.current;
            if (v && c) {
              const scaleX = c.width / v.videoWidth;
              const scaleY = c.height / v.videoHeight;
              if (ctx) {
                ctx.clearRect(0, 0, c.width, c.height);
                const wasteObjs: { label: string; score: number; bbox: number[] }[] = [];
                preds.forEach((p) => {
                  const isWaste = WASTE_CLASSES.has(p.class);
                  const [y, x, h, w] = p.bbox;
                  const bx = x * scaleX, by = y * scaleY, bw = w * scaleX, bh = h * scaleY;
                  ctx.strokeStyle = isWaste ? "#f97316" : "rgba(148,163,184,0.4)";
                  ctx.lineWidth = isWaste ? 2.5 : 1;
                  ctx.strokeRect(bx, by, bw, bh);
                  if (isWaste) {
                    ctx.fillStyle = "rgba(249,115,22,0.9)";
                    ctx.font = "600 11px sans-serif";
                    ctx.fillText(`${p.class} ${(p.score * 100).toFixed(0)}%`, bx, Math.max(12, by - 4));
                    wasteObjs.push({ label: p.class, score: p.score, bbox: p.bbox });
                  }
                });
                // Sliding-window severity: EMA of waste counts
                const count = wasteObjs.length;
                const avgScore = wasteObjs.length ? wasteObjs.reduce((a, o) => a + o.score, 0) / wasteObjs.length : 0;
                const sev: Severity = count >= 7 ? "high" : count >= 3 ? "moderate" : count >= 1 ? "low" : "low";
                const res: LiveResult = {
                  severity: sev,
                  wasteCount: count,
                  totalDetections: preds.length,
                  confidence: Math.round(avgScore * 100),
                  objects: wasteObjs.map((o) => ({ label: o.label, score: o.score })).slice(0, 8),
                  timestamp: Date.now(),
                };
                setLive(res);
                onResultRef.current?.(res);
              }
            }
          } catch (e) {
            console.error("detection error", e);
          } finally {
            busyRef.current = false;
          }
        }
        frames++;
        if (Date.now() - lastFps > 1000) {
          setFps(Math.round((frames * 1000) / (Date.now() - lastFps)));
          frames = 0;
          lastFps = Date.now();
        }
        rafRef.current = requestAnimationFrame(detectLoop);
      };
      rafRef.current = requestAnimationFrame(detectLoop);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to start camera/ML");
      setPhase("error");
      stop();
    }
  }, [facing, stop]);

  // cleanup
  useEffect(() => stop, [stop]);

  const switchCamera = () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
  };

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
        <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />
        <canvas ref={canvasRef} width={640} height={360} className="pointer-events-none absolute inset-0 h-full w-full" />

        {phase !== "running" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 p-6 text-center">
            {phase === "loading_model" || phase === "requesting_camera" ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                <p className="mt-3 text-sm font-semibold text-white">
                  {phase === "loading_model" ? "Loading ML model…" : "Requesting camera…"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {phase === "loading_model" ? "Downloading COCO-SSD weights (first run only)" : "Allow camera access when prompted"}
                </p>
              </>
            ) : (
              <>
                <div className="rounded-2xl bg-white/10 p-4"><Camera className="h-8 w-8 text-slate-300" /></div>
                <p className="mt-3 text-sm font-semibold text-white">{phase === "error" ? "Camera unavailable" : "Live Waste Detection"}</p>
                <p className="mt-1 max-w-xs text-xs text-slate-400">
                  {error || "Point the camera at streets, drains or bins. TensorFlow.js runs object detection locally in your browser."}
                </p>
              </>
            )}
          </div>
        )}

        {phase === "running" && (
          <>
            <div className="absolute left-3 top-3 flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-bold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white pulse-dot" /> LIVE · {fps} FPS
              </span>
              {live && <SeverityBadge severity={live.severity} />}
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <div className="rounded-xl bg-black/60 px-3 py-1.5 text-[11px] text-white backdrop-blur">
                Waste objects: <span className="font-bold text-orange-400">{live?.wasteCount ?? 0}</span>
                {live && live.objects.length > 0 && (
                  <span className="ml-2 text-slate-300">({live.objects.map((o) => o.label).join(", ")})</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={switchCamera} className="!bg-white/90 !text-slate-800">
                  <CameraOff className="h-3.5 w-3.5" /> Flip
                </Button>
                <Button size="sm" variant="danger" onClick={stop}>Stop</Button>
              </div>
            </div>
          </>
        )}
      </div>

      {phase !== "running" && phase !== "loading_model" && phase !== "requesting_camera" && (
        <div className="flex justify-center gap-2">
          <Button onClick={start}>
            {phase === "error" ? <Camera className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            {phase === "error" ? "Retry" : "Start Camera Detection"}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { icon: <Trash2 className="h-4 w-4" />, label: "Waste objects", value: live?.wasteCount ?? "—", cls: "text-orange-600" },
          { icon: <Package className="h-4 w-4" />, label: "All objects", value: live?.totalDetections ?? "—", cls: "text-slate-600" },
          { icon: <Box className="h-4 w-4" />, label: "Confidence", value: live ? `${live.confidence}%` : "—", cls: "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className={cn("mx-auto w-fit", s.cls)}>{s.icon}</div>
            <p className={cn("mt-1 text-lg font-bold", s.cls)}>{s.value}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px] leading-relaxed text-slate-400">
        COCO-SSD detects general objects; waste-relevant classes (bottles, cups, bags, boxes) are mapped to accumulation severity.
        Results are indicative only — verify before dispatching crews. Requires camera permission; works on localhost or HTTPS (e.g. phone via tunnel).
      </p>
    </div>
  );
}
