"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2, Trash2, Package, Box } from "lucide-react";
import { Button, SeverityBadge, cn } from "@/components/ui";
import type { Severity } from "@/lib/types";

// COCO-80 classes mapped to waste-relevant objects
const WASTE_CLASSES = new Set([
  "bottle", "cup", "backpack", "handbag", "suitcase", "sports ball", "kite", "book",
]);

const COCO_CLASSES = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
  "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
  "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack",
  "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball",
  "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
  "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
  "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake",
  "chair", "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop",
  "mouse", "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
  "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier",
  "toothbrush",
];

const INPUT_SIZE = 640;
const NUM_DETS = 8400;
const NUM_CLASSES = 80;

export interface LiveResult {
  severity: Severity;
  wasteCount: number;
  totalDetections: number;
  confidence: number;
  objects: { label: string; score: number }[];
  allObjects: string[];
  timestamp: number;
}

interface Props {
  onResult?: (r: LiveResult) => void;
}

type Phase = "idle" | "loading_model" | "requesting_camera" | "running" | "error";

interface RawDet { x1: number; y1: number; x2: number; y2: number; score: number; cls: number }

function iou(a: RawDet, b: RawDet) {
  const ix1 = Math.max(a.x1, b.x1), iy1 = Math.max(a.y1, b.y1);
  const ix2 = Math.min(a.x2, b.x2), iy2 = Math.min(a.y2, b.y2);
  const iw = Math.max(0, ix2 - ix1), ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
  return inter / (areaA + areaB - inter);
}

function nms(dets: RawDet[], iouThresh = 0.45) {
  const sorted = [...dets].sort((a, b) => b.score - a.score);
  const keep: RawDet[] = [];
  for (const d of sorted) {
    if (keep.every((k) => iou(d, k) < iouThresh)) keep.push(d);
  }
  return keep;
}

export default function LiveCamera({ onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<import("onnxruntime-web").InferenceSession | null>(null);
  const rafRef = useRef<number>(0);
  const busyRef = useRef(false);
  const letterboxRef = useRef<HTMLCanvasElement | null>(null);
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
      const ort = await import("onnxruntime-web");
      ort.env.wasm.wasmPaths = "/ort/";
      let session;
      try {
        session = await ort.InferenceSession.create("/models/yolo26n.onnx", {
          executionProviders: ["webgpu", "wasm"],
        });
      } catch {
        session = await ort.InferenceSession.create("/models/yolo26n.onnx", {
          executionProviders: ["wasm"],
        });
      }
      sessionRef.current = session;

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

      // letterbox canvas
      const lb = document.createElement("canvas");
      lb.width = INPUT_SIZE;
      lb.height = INPUT_SIZE;
      letterboxRef.current = lb;
      const lbCtx = lb.getContext("2d", { willReadFrequently: true })!;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d") ?? null;
      let lastFps = Date.now();
      let frames = 0;

      const detectLoop = async () => {
        const session = sessionRef.current;
        const video = videoRef.current;
        if (!session || !video || video.paused || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(detectLoop);
          return;
        }
        if (!busyRef.current) {
          busyRef.current = true;
          try {
            // ---- preprocess: letterbox to 640x640 ----
            const vw = video.videoWidth, vh = video.videoHeight;
            const scale = Math.min(INPUT_SIZE / vw, INPUT_SIZE / vh);
            const rw = Math.round(vw * scale), rh = Math.round(vh * scale);
            const dx = Math.floor((INPUT_SIZE - rw) / 2), dy = Math.floor((INPUT_SIZE - rh) / 2);
            lbCtx.fillStyle = "#727272";
            lbCtx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
            lbCtx.drawImage(video, dx, dy, rw, rh);

            const img = lbCtx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
            const chw = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
            for (let p = 0, j = 0; p < img.length; p += 4, j++) {
              chw[j] = img[p] / 255;
              chw[j + INPUT_SIZE * INPUT_SIZE] = img[p + 1] / 255;
              chw[j + 2 * INPUT_SIZE * INPUT_SIZE] = img[p + 2] / 255;
            }
            const tensor = new ort.Tensor("float32", chw, [1, 3, INPUT_SIZE, INPUT_SIZE]);
            const out = await session.run({ images: tensor });
            tensor.dispose();
            const data = (out.output0 ?? Object.values(out)[0]).data as Float32Array;

            // ---- decode [1,84,8400] ----
            const dets: RawDet[] = [];
            for (let i = 0; i < NUM_DETS; i++) {
              let best = -1, bestScore = 0.35;
              for (let c = 0; c < NUM_CLASSES; c++) {
                const s = data[(4 + c) * NUM_DETS + i];
                if (s > bestScore) { bestScore = s; best = c; }
              }
              if (best < 0) continue;
              const cx = data[0 * NUM_DETS + i], cy = data[1 * NUM_DETS + i];
              const w = data[2 * NUM_DETS + i], h = data[3 * NUM_DETS + i];
              // model-space coords -> letterboxed input coords
              const bx1 = (cx - w / 2 - dx) / scale;
              const by1 = (cy - h / 2 - dy) / scale;
              const bx2 = (cx + w / 2 - dx) / scale;
              const by2 = (cy + h / 2 - dy) / scale;
              dets.push({ x1: bx1, y1: by1, x2: bx2, y2: by2, score: bestScore, cls: best });
            }
            const kept = nms(dets, 0.45).slice(0, 30);

            // ---- draw ----
            const c = canvasRef.current;
            if (c && ctx) {
              const scaleX = c.width / vw;
              const scaleY = c.height / vh;
              ctx.clearRect(0, 0, c.width, c.height);
              const wasteObjs: { label: string; score: number }[] = [];
              const allObjs: string[] = [];
              for (const d of kept) {
                const label = COCO_CLASSES[d.cls] ?? `cls${d.cls}`;
                const isWaste = WASTE_CLASSES.has(label);
                const bx = d.x1 * scaleX, by = d.y1 * scaleY, bw = (d.x2 - d.x1) * scaleX, bh = (d.y2 - d.y1) * scaleY;
                ctx.strokeStyle = isWaste ? "#f97316" : "rgba(148,163,184,0.5)";
                ctx.lineWidth = isWaste ? 2.5 : 1.2;
                ctx.strokeRect(bx, by, bw, bh);
                ctx.fillStyle = isWaste ? "rgba(249,115,22,0.95)" : "rgba(100,116,139,0.8)";
                ctx.font = "600 11px sans-serif";
                ctx.fillText(`${label} ${(d.score * 100).toFixed(0)}%`, bx, Math.max(12, by - 4));
                allObjs.push(label);
                if (isWaste) wasteObjs.push({ label, score: d.score });
              }
              const count = wasteObjs.length;
              const avgScore = wasteObjs.length ? wasteObjs.reduce((a, o) => a + o.score, 0) / wasteObjs.length : 0;
              const sev: Severity = count >= 7 ? "high" : count >= 3 ? "moderate" : "low";
              const res: LiveResult = {
                severity: sev,
                wasteCount: count,
                totalDetections: kept.length,
                confidence: Math.round(avgScore * 100),
                objects: wasteObjs.slice(0, 8),
                allObjects: [...new Set(allObjs)].slice(0, 10),
                timestamp: Date.now(),
              };
              setLive(res);
              onResultRef.current?.(res);
            }
          } catch (e) {
            console.error("inference error", e);
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

  useEffect(() => stop, [stop]);

  const switchCamera = () => setFacing((f) => (f === "environment" ? "user" : "environment"));

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
                  {phase === "loading_model" ? "Loading YOLO26n model…" : "Requesting camera…"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {phase === "loading_model" ? "Compiling ONNX model (first run may take a moment)" : "Allow camera access when prompted"}
                </p>
              </>
            ) : (
              <>
                <div className="rounded-2xl bg-white/10 p-4"><Camera className="h-8 w-8 text-slate-300" /></div>
                <p className="mt-3 text-sm font-semibold text-white">{phase === "error" ? "Camera/ML unavailable" : "Live Waste Detection"}</p>
                <p className="mt-1 max-w-xs text-xs text-slate-400">
                  {error || "Point the camera at streets, drains or bins. YOLO26n runs object detection locally via ONNX Runtime."}
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
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
              <div className="rounded-xl bg-black/60 px-3 py-1.5 text-[11px] text-white backdrop-blur">
                Waste objects: <span className="font-bold text-orange-400">{live?.wasteCount ?? 0}</span>
                {live && live.allObjects.length > 0 && (
                  <span className="ml-2 text-slate-300">seen: {live.allObjects.join(", ")}</span>
                )}
                {live && live.allObjects.length === 0 && (
                  <span className="ml-2 text-slate-400">no objects in frame — try better lighting or move closer</span>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
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
            <Camera className="h-4 w-4" />
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
        <strong>YOLO26n</strong> (Ultralytics, ONNX Runtime Web) detects 80 COCO object classes locally in your browser.
        Waste-relevant classes (bottles, cups, bags, boxes) map to accumulation severity. Results are indicative only —
        verify before dispatching crews. Model file: <code>public/models/yolo26n.onnx</code>.
      </p>
    </div>
  );
}
