export type Severity = "high" | "moderate" | "low";
export type WasteStatus = "new" | "verified" | "assigned" | "resolved" | "rejected";
export type TaskStatus =
  | "pending"
  | "assigned"
  | "en_route"
  | "in_progress"
  | "completed"
  | "cancelled";
export type TruckStatus = "active" | "idle" | "offline" | "maintenance";
export type FacilityType = "TPS" | "TPST" | "TPA";
export type AlertStatus = "open" | "acknowledged" | "resolved";
export type AlertSeverity = "critical" | "warning" | "info";
export type UserRole =
  | "admin"
  | "monitoring_operator"
  | "field_supervisor"
  | "truck_operator"
  | "analyst"
  | "viewer";
export type DetectionSource = "truck_camera" | "cctv" | "citizen_report" | "manual" | "live_camera";
export type FloodRisk = "low" | "moderate" | "high" | "insufficient";
export type LayerKey =
  | "detections"
  | "trucks"
  | "routes"
  | "tps"
  | "tpst"
  | "tpa"
  | "flood"
  | "rivers";

export interface WasteDetection {
  id: string;
  location: string;
  district: string;
  lat: number;
  lng: number;
  severity: Severity;
  confidence: number;
  aiClass: string;
  status: WasteStatus;
  source: DetectionSource;
  detectedAt: string;
  observations: string[];
  recommendedAction: string;
  imageLabel?: string;
}

export interface Truck {
  id: string;
  plate: string;
  name: string;
  status: TruckStatus;
  lat: number;
  lng: number;
  routeId: string;
  routeName: string;
  driver: string;
  team: string;
  lastUpdate: string;
  capacityKg: number;
  loadKg: number;
  /** Waypoints the simulated truck follows */
  waypoints: { lat: number; lng: number }[];
  wpIndex: number;
  speedKmh: number;
}

export interface CleaningTask {
  id: string;
  title: string;
  location: string;
  district: string;
  lat: number;
  lng: number;
  priority: "critical" | "high" | "medium" | "low";
  status: TaskStatus;
  detectionId?: string;
  truckId?: string;
  team?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  evidenceUploaded?: boolean;
  verified?: boolean;
}

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  lat: number;
  lng: number;
  address: string;
  capacityTons: number;
  currentLoadTons: number;
  operator: string;
  status: "operational" | "near_capacity" | "full" | "maintenance";
  openHours: string;
}

export interface Delivery {
  id: string;
  truckId: string;
  facilityId: string;
  weightKg: number;
  timestamp: string;
  status: "completed" | "in_transit" | "scheduled";
}

export interface Alert {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  createdAt: string;
  status: AlertStatus;
  relatedId?: string;
}

export interface FloodZone {
  id: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
  risk: FloodRisk;
  score: number;
  factors: { label: string; value: string; impact: "positive" | "negative" | "neutral" }[];
  recommendations: string[];
}

export interface AppUser {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

export interface AIAnalysis {
  severity: Severity;
  confidence: number;
  observations: string[];
  recommendedActions: string[];
  wasteTypes: { label: string; pct: number }[];
}
