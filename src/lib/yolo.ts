// Shared YOLO26n ONNX inference for still images (client-side only).

export const COCO_CLASSES = [
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

export const WASTE_CLASSES = new Set([
  "bottle", "cup", "backpack", "handbag", "suitcase", "sports ball", "kite", "book",
]);

export interface YoloDet {
  label: string;
  score: number;
  /** coords in original image pixels */
  x1: number; y1: number; x2: number; y2: number;
}

const INPUT_SIZE = 640;
const NUM_DETS = 8400;
const NUM_CLASSES = 80;
const MODEL_URL = "/models/yolo26n.onnx";

type Session = import("onnxruntime-web").InferenceSession;
let sessionPromise: Promise<Session> | null = null;

export function getYoloSession(): Promise<Session> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await import("onnxruntime-web");
      ort.env.wasm.wasmPaths = "/ort/";
      try {
        return await ort.InferenceSession.create(MODEL_URL, { executionProviders: ["webgpu", "wasm"] });
      } catch {
        return await ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"] });
      }
    })();
  }
  return sessionPromise;
}

function iou(a: { x1: number; y1: number; x2: number; y2: number }, b: { x1: number; y1: number; x2: number; y2: number }) {
  const ix1 = Math.max(a.x1, b.x1), iy1 = Math.max(a.y1, b.y1);
  const ix2 = Math.min(a.x2, b.x2), iy2 = Math.min(a.y2, b.y2);
  const iw = Math.max(0, ix2 - ix1), ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
  return inter / (areaA + areaB - inter);
}

function nms<T extends { x1: number; y1: number; x2: number; y2: number; score: number }>(dets: T[], thresh = 0.45): T[] {
  const sorted = [...dets].sort((a, b) => b.score - a.score);
  const keep: T[] = [];
  for (const d of sorted) {
    if (keep.every((k) => iou(d, k) < thresh)) keep.push(d);
  }
  return keep;
}

/** Run YOLO26n on an image element; returns detections in original-image coords. */
export async function detectImage(img: HTMLImageElement): Promise<YoloDet[]> {
  const ort = await import("onnxruntime-web");
  const session = await getYoloSession();

  const vw = img.naturalWidth, vh = img.naturalHeight;
  const scale = Math.min(INPUT_SIZE / vw, INPUT_SIZE / vh);
  const rw = Math.round(vw * scale), rh = Math.round(vh * scale);
  const dx = Math.floor((INPUT_SIZE - rw) / 2), dy = Math.floor((INPUT_SIZE - rh) / 2);

  const lb = document.createElement("canvas");
  lb.width = INPUT_SIZE;
  lb.height = INPUT_SIZE;
  const lbCtx = lb.getContext("2d", { willReadFrequently: true })!;
  lbCtx.fillStyle = "#727272";
  lbCtx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  lbCtx.drawImage(img, dx, dy, rw, rh);

  const pixels = lbCtx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
  const chw = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
  for (let p = 0, j = 0; p < pixels.length; p += 4, j++) {
    chw[j] = pixels[p] / 255;
    chw[j + INPUT_SIZE * INPUT_SIZE] = pixels[p + 1] / 255;
    chw[j + 2 * INPUT_SIZE * INPUT_SIZE] = pixels[p + 2] / 255;
  }

  const tensor = new ort.Tensor("float32", chw, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  const out = await session.run({ images: tensor });
  tensor.dispose();
  const data = (out.output0 ?? Object.values(out)[0]).data as Float32Array;

  const raw: ({ cls: number; score: number; x1: number; y1: number; x2: number; y2: number })[] = [];
  for (let i = 0; i < NUM_DETS; i++) {
    let best = -1, bestScore = 0.35;
    for (let c = 0; c < NUM_CLASSES; c++) {
      const s = data[(4 + c) * NUM_DETS + i];
      if (s > bestScore) { bestScore = s; best = c; }
    }
    if (best < 0) continue;
    const cx = data[i], cy = data[NUM_DETS + i], w = data[2 * NUM_DETS + i], h = data[3 * NUM_DETS + i];
    raw.push({
      cls: best,
      score: bestScore,
      x1: (cx - w / 2 - dx) / scale,
      y1: (cy - h / 2 - dy) / scale,
      x2: (cx + w / 2 - dx) / scale,
      y2: (cy + h / 2 - dy) / scale,
    });
  }
  return nms(raw, 0.45).slice(0, 40).map(({ cls, ...d }) => ({ ...d, label: COCO_CLASSES[cls] ?? `cls${cls}` }));
}

/** Summarize detections into the app's analysis shape inputs. */
export function summarizeDetections(dets: YoloDet[]) {
  const waste = dets.filter((d) => WASTE_CLASSES.has(d.label));
  const counts: Record<string, number> = {};
  waste.forEach((d) => (counts[d.label] = (counts[d.label] ?? 0) + 1));
  const total = waste.length;
  const severity = total >= 7 ? "high" : total >= 3 ? "moderate" : "low";
  const confidence = waste.length
    ? Math.round((waste.reduce((a, d) => a + d.score, 0) / waste.length) * 100)
    : Math.round((dets.reduce((a, d) => a + d.score, 0) / Math.max(dets.length, 1)) * 100);
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const wasteTypes = sorted.map(([label, n]) => ({ label, pct: Math.round((n / Math.max(total, 1)) * 100) }));
  return { severity: severity as "high" | "moderate" | "low", wasteCount: total, totalDetections: dets.length, confidence, counts, wasteTypes, dets };
}
