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

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 501 });
  }

  try {
    const form = await req.formData();
    const file = form.get("image") as File | null;
    const location = (form.get("location") as string) ?? "";
    const district = (form.get("district") as string) ?? "";

    if (!file) return NextResponse.json({ error: "No image provided" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mime = file.type || "image/jpeg";

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
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

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: `OpenAI error ${res.status}: ${body.slice(0, 300)}` }, { status: 502 });
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    // Validate/normalize shape
    const severity = ["high", "moderate", "low"].includes(parsed.severity) ? parsed.severity : "low";
    return NextResponse.json({
      severity,
      confidence: Math.max(0, Math.min(100, parseInt(parsed.confidence) || 50)),
      observations: Array.isArray(parsed.observations) ? parsed.observations.slice(0, 5).map(String) : [],
      wasteTypes: Array.isArray(parsed.wasteTypes)
        ? parsed.wasteTypes.slice(0, 6).map((w: any) => ({ label: String(w.label ?? "Other"), pct: Math.max(0, parseInt(w.pct) || 0) }))
        : [],
      recommendedAction: String(parsed.recommendedAction ?? ""),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Analysis failed" }, { status: 500 });
  }
}
