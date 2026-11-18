# SI BRIDGES — Smart Waste Management Platform

Jakarta Smart Waste Monitoring & Prediction System — Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + Leaflet/react-leaflet + Recharts + lucide-react.

## Run

```bash
npm install
npm run dev   # http://localhost:3000
npm run build # production build
```

## Architecture

- `src/lib/types.ts` — domain model (detections, trucks, tasks, facilities, deliveries, alerts, flood zones, users)
- `src/lib/demo-data.ts` — seeded synthetic Jakarta dataset + demo AI classifier
- `src/lib/store.tsx` — dual-mode React context store: demo (localStorage) or Supabase (auth + Postgres + Realtime); actions write through to DB when configured
- `src/lib/supabase.ts`, `src/lib/supabase-mappers.ts` — Supabase client + row mappers
- `src/lib/geo.ts` — district constants
- `src/components/` — AppShell (sidebar/topbar/login), JakartaMap, FleetMap, FacilitiesMap, FloodMap, LiveCamera, ui primitives
- `/camera` page — real-time webcam detection via YOLO26n ONNX (`public/models/yolo26n.onnx`, ~9.4MB bundled) + onnxruntime-web; ORT wasm/mjs assets served from `public/ort/`. COCO-80 classes; waste-relevant classes map to severity
- `src/app/` — routes: `/overview` `/map` `/detection` `/camera` `/fleet` `/operations` `/facilities` `/flood` `/analytics` `/alerts` `/settings`
- `supabase/schema.sql` — Postgres schema + RLS + realtime publication

## Demo mode

No external credentials needed. All data is synthetic and labeled "Demo Data". Login screen offers role switching (admin, monitoring operator, field supervisor, truck operator, analyst, viewer). State persists in `localStorage` (`si-bridges-state-v1`); reset via Settings → Reset demo data.

## Supabase mode

Set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` (never commit). Real email/password auth via `auth.users` + `profiles` (role column drives RLS via `is_staff()`/`is_admin()`). Realtime subscriptions refetch on any public-table change.

## Production integration points

Set env vars (see Settings → System): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `BMKG_API_TOKEN`, `SIPSN_API_KEY`. Planned feeds: Jakarta Satu, SIPSN, BMKG, BPBD, DSDA/DLH.

## Exporting a new detection model

`python -c "from ultralytics import YOLO; YOLO('yolo26n.pt').export(format='onnx', imgsz=640, opset=17)"` → place `.onnx` in `public/models/`; ORT assets already in `public/ort/`.
