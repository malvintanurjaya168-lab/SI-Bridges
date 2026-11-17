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
- `src/lib/store.tsx` — React context store: state, actions, localStorage persistence, simulated truck GPS (2.5s tick)
- `src/lib/geo.ts` — district constants
- `src/components/` — AppShell (sidebar/topbar/login), JakartaMap, FleetMap, FacilitiesMap, FloodMap, ui primitives
- `src/app/` — routes: `/overview` `/map` `/detection` `/fleet` `/operations` `/facilities` `/flood` `/analytics` `/alerts` `/settings`

## Demo mode

No external credentials needed. All data is synthetic and labeled "Demo Data". Login screen offers role switching (admin, monitoring operator, field supervisor, truck operator, analyst, viewer). State persists in `localStorage` (`si-bridges-state-v1`); reset via Settings → Reset demo data.

## Production integration points

Set env vars (see Settings → System): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `BMKG_API_TOKEN`, `SIPSN_API_KEY`. Planned feeds: Jakarta Satu, SIPSN, BMKG, BPBD, DSDA/DLH.
