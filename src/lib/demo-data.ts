import {
  AIAnalysis,
  Alert,
  AppUser,
  CleaningTask,
  Delivery,
  Facility,
  Severity,
  Truck,
  WasteDetection,
} from "./types";

// Seeded PRNG for stable demo data
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261117);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const ri = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

const DISTRICTS = [
  { name: "Central Jakarta", lat: -6.175, lng: 106.827 },
  { name: "North Jakarta", lat: -6.12, lng: 106.87 },
  { name: "West Jakarta", lat: -6.2, lng: 106.78 },
  { name: "South Jakarta", lat: -6.26, lng: 106.81 },
  { name: "East Jakarta", lat: -6.22, lng: 106.9 },
];

const LOCATIONS = [
  "Jl. Thamrin KM 0.5",
  "Jl. Sudirman near Bundaran HI",
  "Jl. Gatot Subroto KM 3",
  "Jl. Jenderal Sudirman Cipulir",
  "Jl. Raya Bekasi KM 19",
  "Jl. Cempaka Putih Timur",
  "Jl. Taman Sari",
  "Jl. Mangga Dua Raya",
  "Jl. Pangeran Jayakarta",
  "Jl. Kalimalang KM 4",
  "Jl. Raya Bogor KM 28",
  "Jl. Bekasi Timur Raya",
  "Jl. Muara Baru Utara",
  "Jl. Pluit Karang",
  "Jl. Kemang Raya",
  "Jl. Senopati KM 1",
  "Jl. Teuku Umar",
  "Jl. Pasar Minggu Raya",
  "Jl. Rawamangun Timur",
  "Jl. Tebet Barat Dalam",
  "Jl. Raya Pondok Gede KM 6",
  "Jl. Matraman Raya",
  "Jl. Kuningan Barat",
  "Jl. Salemba Raya",
];

function jitter(lat: number, lng: number, amt = 0.03) {
  return {
    lat: lat + (rand() - 0.5) * amt,
    lng: lng + (rand() - 0.5) * amt,
  };
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}
function daysAgo(d: number) {
  return new Date(Date.now() - d * 86400_000).toISOString();
}

const OBSERVATIONS: Record<Severity, string[]> = {
  high: [
    "Dense accumulation of mixed waste along curb",
    "Overflowing trash bins and scattered plastic",
    "Blocked drainage channel with debris",
    "Large organic waste pile near market area",
  ],
  moderate: [
    "Moderate pile of household waste bags",
    "Scattered packaging materials and bottles",
    "Partial bin overflow at roadside",
    "Construction debris mixed with household waste",
  ],
  low: [
    "Minor scattered litter",
    "Small pile of recyclables",
    "Single overflowing bin",
    "Light organic waste near drains",
  ],
};

const SEV_ACTIONS: Record<Severity, string> = {
  high: "Dispatch collection crew within 24 hours; consider secondary collection route.",
  moderate: "Schedule routine collection within 48 hours.",
  low: "Include in next scheduled sweep; monitor for recurrence.",
};

export function generateDetections(): WasteDetection[] {
  const out: WasteDetection[] = [];
  const sevDist: Severity[] = ["high", "high", "high", "moderate", "moderate", "moderate", "moderate", "low", "low", "low"];
  for (let i = 0; i < 44; i++) {
    const district = pick(DISTRICTS);
    const p = jitter(district.lat, district.lng);
    const severity = sevDist[i % sevDist.length];
    const conf = severity === "high" ? ri(78, 97) : severity === "moderate" ? ri(65, 90) : ri(55, 85);
    out.push({
      id: `DET-${String(i + 1).padStart(4, "0")}`,
      location: pick(LOCATIONS),
      district: district.name,
      lat: p.lat,
      lng: p.lng,
      severity,
      confidence: conf,
      aiClass: severity === "high" ? "severe_accumulation" : severity === "moderate" ? "moderate_accumulation" : "minor_litter",
      status: i < 6 ? "new" : i < 12 ? "verified" : i < 20 ? "assigned" : "resolved",
      source: pick(["truck_camera", "truck_camera", "cctv", "citizen_report", "manual"] as const),
      detectedAt: hoursAgo(ri(1, 24 * 12)),
      observations: [pick(OBSERVATIONS[severity]), pick(OBSERVATIONS[severity])],
      recommendedAction: SEV_ACTIONS[severity],
      imageLabel: pick(["IMG_2041.jpg", "IMG_2088.jpg", "CAM_7712.jpg", "RPT_3390.jpg", "CAM_7820.jpg"]),
    });
  }
  return out.sort((a, b) => +new Date(b.detectedAt) - +new Date(a.detectedAt));
}

const WAYPOINTS: Record<string, { lat: number; lng: number }[]> = {
  R1: [
    { lat: -6.175, lng: 106.827 }, { lat: -6.19, lng: 106.815 }, { lat: -6.2, lng: 106.8 },
    { lat: -6.21, lng: 106.79 }, { lat: -6.205, lng: 106.78 }, { lat: -6.19, lng: 106.795 },
  ],
  R2: [
    { lat: -6.12, lng: 106.87 }, { lat: -6.13, lng: 106.89 }, { lat: -6.14, lng: 106.9 },
    { lat: -6.15, lng: 106.895 }, { lat: -6.16, lng: 106.885 }, { lat: -6.14, lng: 106.875 },
  ],
  R3: [
    { lat: -6.22, lng: 106.9 }, { lat: -6.23, lng: 106.905 }, { lat: -6.24, lng: 106.9 },
    { lat: -6.25, lng: 106.91 }, { lat: -6.24, lng: 106.915 }, { lat: -6.23, lng: 106.9 },
  ],
  R4: [
    { lat: -6.26, lng: 106.81 }, { lat: -6.27, lng: 106.82 }, { lat: -6.28, lng: 106.81 },
    { lat: -6.29, lng: 106.80 }, { lat: -6.28, lng: 106.79 }, { lat: -6.27, lng: 106.80 },
  ],
  R5: [
    { lat: -6.16, lng: 106.86 }, { lat: -6.17, lng: 106.875 }, { lat: -6.18, lng: 106.87 },
    { lat: -6.19, lng: 106.865 }, { lat: -6.18, lng: 106.855 }, { lat: -6.17, lng: 106.86 },
  ],
};

const TRUCK_NAMES = ["Compactor A", "Compactor B", "Hooklift C", "Side Loader D", "Roll-on E", "Roll-on F", "Compactor G", "Hooklift H"];
const DRIVERS = ["Budi Santoso", "Agus Wijaya", "Rudi Hartono", "Dedi Kurnia", "Eko Prasetyo", "Fajar Nugroho", "Hendra Gunawan", "Iwan Setiawan"];
const TEAMS = ["Team Alpha", "Team Bravo", "Team Charlie", "Team Delta"];
const PLATES = ["B 9123 ABC", "B 8456 DEF", "B 7788 GHI", "B 6543 JKL", "B 5321 MNO", "B 4987 PQR", "B 3675 STU", "B 2543 VWX"];

export function generateTrucks(): Truck[] {
  const routes = Object.keys(WAYPOINTS);
  const out: Truck[] = [];
  for (let i = 0; i < 8; i++) {
    const routeId = routes[i % routes.length];
    const wp = WAYPOINTS[routeId];
    const startIdx = ri(0, wp.length - 1);
    const status = i < 5 ? "active" : i === 6 ? "idle" : i === 7 ? "offline" : "active";
    out.push({
      id: `TRK-${String(i + 1).padStart(3, "0")}`,
      plate: PLATES[i],
      name: TRUCK_NAMES[i],
      status,
      lat: wp[startIdx].lat,
      lng: wp[startIdx].lng,
      routeId,
      routeName: `Route ${routeId} — ${DISTRICTS[i % DISTRICTS.length].name}`,
      driver: DRIVERS[i],
      team: TEAMS[i % TEAMS.length],
      lastUpdate: hoursAgo(ri(0, 2)),
      capacityKg: ri(6000, 12000),
      loadKg: status === "active" ? ri(1500, 8000) : status === "idle" ? ri(0, 2000) : 0,
      waypoints: wp,
      wpIndex: startIdx,
      speedKmh: ri(15, 35),
    });
  }
  return out;
}

export function generateTasks(detections: WasteDetection[]): CleaningTask[] {
  const tasks: CleaningTask[] = [];
  const statuses: CleaningTask["status"][] = [
    "pending", "pending", "assigned", "assigned", "en_route", "in_progress",
    "in_progress", "completed", "completed", "completed", "completed", "cancelled",
  ];
  const priorities: CleaningTask["priority"][] = ["critical", "high", "high", "medium", "medium", "low"];
  const assigned = detections.filter((d) => d.status === "assigned" || d.status === "resolved");
  for (let i = 0; i < 14; i++) {
    const det = assigned[i % Math.max(assigned.length, 1)];
    const status = statuses[i % statuses.length];
    const truckIdx = i % 8;
    const hasTruck = status !== "pending" && status !== "cancelled";
    tasks.push({
      id: `TSK-${String(i + 1).padStart(4, "0")}`,
      title: `Clean ${det?.severity ?? "high"} accumulation — ${det?.location ?? "Jl. TBD"}`,
      location: det?.location ?? "Jl. TBD",
      district: det?.district ?? "Central Jakarta",
      lat: det?.lat ?? -6.2,
      lng: det?.lng ?? 106.82,
      priority: det?.severity === "high" ? "critical" : priorities[i % priorities.length],
      status,
      detectionId: det?.id,
      truckId: hasTruck ? `TRK-${String(truckIdx + 1).padStart(3, "0")}` : undefined,
      team: hasTruck ? TEAMS[truckIdx % TEAMS.length] : undefined,
      createdBy: pick(["Siti Rahayu", "Andi Pratama", "Maya Kusuma"]),
      createdAt: daysAgo(ri(0, 5)),
      updatedAt: hoursAgo(ri(0, 48)),
      evidenceUploaded: status === "completed",
      verified: status === "completed" && i % 2 === 0,
      notes: i % 3 === 0 ? "Follow up on recurring hotspot." : undefined,
    });
  }
  return tasks;
}

export function generateFacilities(): Facility[] {
  const defs: { name: string; type: Facility["type"]; lat: number; lng: number; cap: number; load: number; status: Facility["status"]; op: string }[] = [
    { name: "TPS Jatinegara", type: "TPS", lat: -6.215, lng: 106.865, cap: 120, load: 88, status: "operational", op: "DLH East Jakarta" },
    { name: "TPS Menteng", type: "TPS", lat: -6.19, lng: 106.835, cap: 90, load: 61, status: "operational", op: "DLH Central Jakarta" },
    { name: "TPS Pluit", type: "TPS", lat: -6.125, lng: 106.865, cap: 100, load: 95, status: "near_capacity", op: "DLH North Jakarta" },
    { name: "TPS Cilandak", type: "TPS", lat: -6.285, lng: 106.795, cap: 110, load: 74, status: "operational", op: "DLH South Jakarta" },
    { name: "TPS Kalideres", type: "TPS", lat: -6.175, lng: 106.755, cap: 105, load: 102, status: "near_capacity", op: "DLH West Jakarta" },
    { name: "TPST Bantar Gebang", type: "TPST", lat: -6.315, lng: 106.94, cap: 7500, load: 6200, status: "operational", op: "BPLHD Jakarta" },
    { name: "TPST PIK 2", type: "TPST", lat: -6.095, lng: 106.915, cap: 1800, load: 1650, status: "near_capacity", op: "BPLHD Jakarta" },
    { name: "TPA Bantar Gebang", type: "TPA", lat: -6.335, lng: 106.96, cap: 9000, load: 8100, status: "near_capacity", op: "BPLHD Jakarta" },
    { name: "TPA Sukamahi", type: "TPA", lat: -6.36, lng: 106.86, cap: 6000, load: 5900, status: "full", op: "BPLHD Jakarta" },
  ];
  return defs.map((d, i) => ({
    id: `FAC-${String(i + 1).padStart(3, "0")}`,
    name: d.name,
    type: d.type,
    lat: d.lat,
    lng: d.lng,
    address: d.name.replace("TPS ", "Jl. TPS ").replace("TPST ", "Kompleks ").replace("TPA ", "Kawasan "),
    capacityTons: d.cap,
    currentLoadTons: d.load,
    operator: d.op,
    status: d.status,
    openHours: d.type === "TPA" ? "24 Jam" : "06.00 – 18.00 WIB",
  }));
}

export function generateDeliveries(trucks: Truck[], facilities: Facility[]): Delivery[] {
  const tps = facilities.filter((f) => f.type === "TPS");
  const big = facilities.filter((f) => f.type !== "TPS");
  const out: Delivery[] = [];
  for (let i = 0; i < 18; i++) {
    const truck = trucks[i % trucks.length];
    const fac = i % 3 === 0 ? big[i % big.length] : tps[i % tps.length];
    out.push({
      id: `DLV-${String(i + 1).padStart(4, "0")}`,
      truckId: truck.id,
      facilityId: fac.id,
      weightKg: ri(800, 4500),
      timestamp: hoursAgo(ri(1, 72)),
      status: i < 4 ? "in_transit" : i === 4 ? "scheduled" : "completed",
    });
  }
  return out.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
}

export function generateAlerts(detections: WasteDetection[], trucks: Truck[], facilities: Facility[]): Alert[] {
  const alerts: Alert[] = [];
  const highs = detections.filter((d) => d.severity === "high").slice(0, 5);
  highs.forEach((d, i) => {
    alerts.push({
      id: `ALT-${String(i + 1).padStart(4, "0")}`,
      type: "high_waste",
      severity: "critical",
      title: "High waste accumulation detected",
      message: `${d.location}, ${d.district} — AI confidence ${d.confidence}%. ${d.observations[0]}.`,
      createdAt: d.detectedAt,
      status: i < 2 ? "open" : "acknowledged",
      relatedId: d.id,
    });
  });
  const offline = trucks.filter((t) => t.status === "offline" || t.status === "maintenance");
  offline.forEach((t, i) => {
    alerts.push({
      id: `ALT-${String(10 + i).padStart(4, "0")}`,
      type: "offline_truck",
      severity: "warning",
      title: `${t.status === "offline" ? "Truck offline" : "Truck in maintenance"}: ${t.plate}`,
      message: `Last GPS update ${t.lastUpdate}. Driver: ${t.driver}.`,
      createdAt: hoursAgo(ri(2, 12)),
      status: "open",
      relatedId: t.id,
    });
  });
  facilities.filter((f) => f.status === "near_capacity" || f.status === "full").forEach((f, i) => {
    alerts.push({
      id: `ALT-${String(20 + i).padStart(4, "0")}`,
      type: "facility_capacity",
      severity: "warning",
      title: `Facility capacity warning: ${f.name}`,
      message: `${Math.round((f.currentLoadTons / f.capacityTons) * 100)}% capacity utilized (${f.currentLoadTons}/${f.capacityTons} tons).`,
      createdAt: hoursAgo(ri(3, 20)),
      status: i === 0 ? "open" : "acknowledged",
      relatedId: f.id,
    });
  });
  alerts.push({
    id: "ALT-0099",
    type: "delayed_operation",
    severity: "warning",
    title: "Cleaning operation delayed",
    message: "Task TSK-0003 (Jl. Kalimalang KM 4) has been En Route for over 3 hours without status update.",
    createdAt: hoursAgo(5),
    status: "open",
    relatedId: "TSK-0003",
  });
  alerts.push({
    id: "ALT-0100",
    type: "environmental_risk",
    severity: "info",
    title: "Potential environmental risk — Ciliwung corridor",
    message: "Waste accumulation near waterway may increase local blockage risk. Review detection module.",
    createdAt: hoursAgo(8),
    status: "acknowledged",
  });
  alerts.push({
    id: "ALT-0101",
    type: "repeat_detection",
    severity: "warning",
    title: "Repeated waste detection",
    message: "3rd detection in 7 days near Jl. Raya Bekasi KM 19. Recommend root-cause review with local kelurahan.",
    createdAt: hoursAgo(10),
    status: "resolved",
  });
  return alerts.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}


export const USERS: AppUser[] = [
  { id: "USR-001", name: "Admin", role: "admin", email: "admin@gmail.com" },
  { id: "USR-002", name: "Driver Demo", role: "truck_operator", email: "driver@gmail.com" },
  { id: "USR-003", name: "Guest", role: "user", email: "guest@anonymous" },
];

export function buildDemoState() {
  const detections = generateDetections();
  const trucks = generateTrucks();
  const facilities = generateFacilities();
  return {
    detections,
    trucks,
    tasks: generateTasks(detections),
    facilities,
    deliveries: generateDeliveries(trucks, facilities),
    alerts: generateAlerts(detections, trucks, facilities),
  };
}

export function simulateAIAnalysis(location: string, district: string, imageName?: string): AIAnalysis {
  // Demo-mode heuristic "AI" — clearly synthetic
  const seed = [...(location + (imageName ?? ""))].reduce((a, c) => a + c.charCodeAt(0), 0);
  const r = (n: number) => ((seed * 9301 + 49297) % 233280) / 233280 * n;
  const roll = r(100);
  const severity: Severity = roll > 55 ? "high" : roll > 25 ? "moderate" : "low";
  const conf = Math.round(72 + r(25));
  const pools: Record<Severity, string[]> = OBSERVATIONS;
  const obs = [pools[severity][seed % pools[severity].length], pools[severity][(seed + 1) % pools[severity].length]];
  const wasteTypes =
    severity === "high"
      ? [
          { label: "Mixed household waste", pct: 45 },
          { label: "Organic waste", pct: 30 },
          { label: "Plastics & packaging", pct: 15 },
          { label: "Other debris", pct: 10 },
        ]
      : severity === "moderate"
        ? [
            { label: "Household waste bags", pct: 50 },
            { label: "Packaging materials", pct: 30 },
            { label: "Organic waste", pct: 20 },
          ]
        : [
            { label: "Scattered litter", pct: 60 },
            { label: "Recyclables", pct: 25 },
            { label: "Organic waste", pct: 15 },
          ];
  return {
    severity,
    confidence: conf,
    observations: obs,
    recommendedActions: [SEV_ACTIONS[severity]],
    wasteTypes,
  };
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  truck_operator: "Truck Operator",
  user: "User (Guest)",
};
