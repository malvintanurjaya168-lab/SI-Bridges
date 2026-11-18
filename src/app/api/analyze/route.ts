import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are an AI waste-management analyst for Jakarta's smart city platform.
Analyze the uploaded street image and assess waste accumulation.
Respond with ONLY a JSON object (no markdown) matching this schema:
{
  "severity": "high" | "moderate" | "low",
  "confidence": <integer 0-100>,
  "observations": [<2-4 short factual observations about visible waste>],
  "wasteTypes": [{"label": <waste category>, "pct": <integer percentage>}],
  "recommendedAction": <one concrete operational recommendation>
}
Severity guide:
- high: dense/piled waste, blocked walkway or drain, overflowing bins, hazardous debris
- moderate: scattered bags/piles along curb, partial bin overflow
- low: minor litter, small scattered items
If the image contains no visible waste, still respond with severity "low" and explain in observations.
Waste types should sum to ~100 and only include categories actually visible (e.g. "Mixed household waste", "Plastics & packaging", "Organic waste", "Construction debris").`;

interface AnalysisResult {
  severity: string;
  confidence: number;
  observations: string[];
  wasteTypes: { label: string; pct: number }[];
  recommendedAction: string;
}

function normalize(parsed: any): AnalysisResult {
  const severity = ["high", "moderate", "low"].includes(parsed?.severity) ? parsed.severity : "low";
  return {
    severity,
    confidence: Math.max(0, Math.min(100, parseInt(parsed?.confidence) || 50)),
    observations: Array.isArray(parsed?.observations) ? parsed.observations.slice(0, 5).map(String) : [],
    wasteTypes: Array.isArray(parsed?.wasteTypes)
      ? parsed.wasteTypes.slice(0, 6).map((w: any) => ({ label: String(w?.label ?? "Other"), pct: Math.max(0, parseInt(w?.pct) || 0) }))
      : [],
    recommendedAction: String(parsed?.recommendedAction ?? ""),
  };
}

async function analyzeOpenAI(base64: string, mime: string, location: string, district: string): Promise<AnalysisResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Assess waste accumulation in this image.${location ? ` Location context: ${location}, ${district}, Jakarta.` : ""} Classify severity and describe what you see.`,
            },
            { type: "image_url", image_url: { url: `data:${mime};base64,${base64}`, detail: "low" } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return normalize(JSON.parse(json.choices?.[0]?.message?.content ?? "{}"));
}

const GEMINI_MODELS = [
  process.env.GEMINI_MODEL || "gemini-3.8-flash",
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
];

async function analyzeGemini(base64: string, mime: string, location: string, district: string): Promise<AnalysisResult> {
  const seen = new Set<string>();
  const models = GEMINI_MODELS.filter((m) => m && !seen.has(m) && seen.add(m));
  let lastErr = "no model available";
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Assess waste accumulation in this image.${location ? ` Location context: ${location}, ${district}, Jakarta.` : ""} Classify severity and describe what you see. Respond with the JSON object only.`,
                },
                { inline_data: { mime_type: mime, data: base64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "{}";
        return normalize(JSON.parse(text));
      }
      lastErr = `Gemini ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`;
      // 404/400 = bad model name, don't retry; 429/500/503 = transient, retry once
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      break;
    }
  }
  throw new Error(lastErr);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("image") as File | null;
  if (!file) return NextResponse.json({ error: "No image provided" }, { status: 400 });
  const location = (form.get("location") as string) ?? "";
  const district = (form.get("district") as string) ?? "";

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const mime = file.type || "image/jpeg";

  const providers: { name: string; key?: string; fn: () => Promise<AnalysisResult> }[] = [
    { name: "openai", key: process.env.OPENAI_API_KEY, fn: () => analyzeOpenAI(base64, mime, location, district) },
    { name: "gemini", key: process.env.GEMINI_API_KEY, fn: () => analyzeGemini(base64, mime, location, district) },
  ];

  const errors: string[] = [];
  for (const p of providers) {
    if (!p.key) continue;
    try {
      const result = await p.fn();
      return NextResponse.json({ ...result, engine: p.name });
    } catch (e) {
      errors.push(`${p.name}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  if (errors.length === 0) {
    return NextResponse.json({ error: "No vision API key configured (OPENAI_API_KEY or GEMINI_API_KEY)" }, { status: 501 });
  }
  return NextResponse.json({ error: errors.join(" | ") }, { status: 502 });
}
