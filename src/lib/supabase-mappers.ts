import {
  AIAnalysis,
  Alert,
  AppUser,
  CleaningTask,
  Delivery,
  Facility,
  TaskStatus,
  Truck,
  UserRole,
  WasteDetection,
} from "./types";

// ---------- row -> app ----------

export function rowToDetection(r: any): WasteDetection {
  return {
    id: r.id,
    location: r.location,
    district: r.district,
    lat: r.lat,
    lng: r.lng,
    severity: r.severity,
    confidence: r.confidence,
    aiClass: r.ai_class ?? "",
    status: r.status,
    source: r.source,
    detectedAt: r.detected_at,
    observations: r.observations ?? [],
    recommendedAction: r.recommended_action ?? "",
    imageLabel: r.image_label ?? undefined,
    imageUrl: r.image_url ?? undefined,
    reviewedBy: r.reviewed_by_name ?? undefined,
    reviewedAt: r.reviewed_at ?? undefined,
    reviewNote: r.review_note ?? undefined,
    aiSeverity: r.ai_severity ?? undefined,
    aiConfidence: r.ai_confidence ?? undefined,
  };
}

export function rowToTruck(r: any): Truck {
  return {
    id: r.id,
    plate: r.plate,
    name: r.name,
    status: r.status,
    lat: r.lat,
    lng: r.lng,
    routeId: r.route_id ?? "",
    routeName: r.route_name ?? "",
    driver: r.driver ?? "",
    team: r.team ?? "",
    lastUpdate: r.last_update,
    capacityKg: r.capacity_kg,
    loadKg: r.load_kg,
    waypoints: r.waypoints ?? [],
    wpIndex: r.wp_index ?? 0,
    speedKmh: r.speed_kmh ?? 20,
  };
}

export function rowToTask(r: any): CleaningTask {
  return {
    id: r.id,
    title: r.title,
    location: r.location,
    district: r.district,
    lat: r.lat,
    lng: r.lng,
    priority: r.priority,
    status: r.status as TaskStatus,
    detectionId: r.detection_id ?? undefined,
    truckId: r.truck_id ?? undefined,
    team: r.team ?? undefined,
    createdBy: r.created_by_name ?? r.created_by ?? "System",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    notes: r.notes ?? undefined,
    evidenceUploaded: r.evidence_uploaded ?? false,
    verified: r.verified ?? false,
  };
}

export function rowToFacility(r: any): Facility {
  const pct = r.capacity_tons ? (r.current_load_tons / r.capacity_tons) * 100 : 0;
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    lat: r.lat,
    lng: r.lng,
    address: r.address ?? "",
    capacityTons: r.capacity_tons,
    currentLoadTons: r.current_load_tons,
    operator: r.operator ?? "",
    status: r.status ?? (pct > 90 ? "full" : pct > 70 ? "near_capacity" : "operational"),
    openHours: r.open_hours ?? "",
  };
}

export function rowToDelivery(r: any): Delivery {
  return {
    id: r.id,
    truckId: r.truck_id,
    facilityId: r.facility_id,
    weightKg: r.weight_kg,
    timestamp: r.timestamp,
    status: r.status,
  };
}

export function rowToAlert(r: any): Alert {
  return {
    id: r.id,
    type: r.type,
    severity: r.severity,
    title: r.title,
    message: r.message ?? "",
    createdAt: r.created_at,
    status: r.status,
    relatedId: r.related_id ?? undefined,
  };
}


export function rowToUser(r: any): AppUser {
  return { id: r.id, name: r.name, email: r.email, role: r.role as UserRole };
}

// ---------- app -> row ----------

export function detectionToRow(d: WasteDetection, userId?: string) {
  return {
    id: d.id,
    location: d.location,
    district: d.district,
    lat: d.lat,
    lng: d.lng,
    severity: d.severity,
    confidence: d.confidence,
    ai_class: d.aiClass,
    status: d.status,
    source: d.source,
    observations: d.observations,
    recommended_action: d.recommendedAction,
    image_label: d.imageLabel ?? null,
    image_url: d.imageUrl ?? null,
    detected_at: d.detectedAt,
    verified_by: userId ?? null,
    reviewed_at: d.reviewedAt ?? null,
    review_note: d.reviewNote ?? null,
    ai_severity: d.aiSeverity ?? null,
    ai_confidence: d.aiConfidence ?? null,
  };
}

export function truckToRow(t: Truck) {
  return {
    id: t.id,
    plate: t.plate,
    name: t.name,
    status: t.status,
    lat: t.lat,
    lng: t.lng,
    route_id: t.routeId,
    route_name: t.routeName,
    driver: t.driver,
    team: t.team,
    last_update: t.lastUpdate,
    capacity_kg: t.capacityKg,
    load_kg: t.loadKg,
    waypoints: t.waypoints,
    wp_index: t.wpIndex,
    speed_kmh: t.speedKmh,
  };
}

export function taskToRow(t: CleaningTask) {
  return {
    id: t.id,
    title: t.title,
    location: t.location,
    district: t.district,
    lat: t.lat,
    lng: t.lng,
    priority: t.priority,
    status: t.status,
    detection_id: t.detectionId ?? null,
    truck_id: t.truckId ?? null,
    team: t.team ?? null,
    notes: t.notes ?? null,
    evidence_uploaded: t.evidenceUploaded ?? false,
    verified: t.verified ?? false,
  };
}

export function facilityToRow(f: Facility) {
  return {
    id: f.id,
    name: f.name,
    type: f.type,
    lat: f.lat,
    lng: f.lng,
    address: f.address,
    capacity_tons: f.capacityTons,
    current_load_tons: f.currentLoadTons,
    operator: f.operator,
    status: f.status,
    open_hours: f.openHours,
  };
}

export function deliveryToRow(d: Delivery) {
  return {
    id: d.id,
    truck_id: d.truckId,
    facility_id: d.facilityId,
    weight_kg: d.weightKg,
    timestamp: d.timestamp,
    status: d.status,
  };
}

export function alertToRow(a: Alert) {
  return {
    id: a.id,
    type: a.type,
    severity: a.severity,
    title: a.title,
    message: a.message,
    related_id: a.relatedId ?? null,
    status: a.status,
  };
}


export type { AIAnalysis };
