"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildDemoState, simulateAIAnalysis, USERS } from "./demo-data";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import {
  alertToRow,
  deliveryToRow,
  detectionToRow,
  facilityToRow,
  floodZoneToRow,
  rowToAlert,
  rowToDelivery,
  rowToDetection,
  rowToFacility,
  rowToFloodZone,
  rowToTask,
  rowToTruck,
  rowToUser,
  taskToRow,
  truckToRow,
} from "./supabase-mappers";
import {
  AIAnalysis,
  Alert,
  AppUser,
  CleaningTask,
  Delivery,
  Facility,
  FloodZone,
  LayerKey,
  Severity,
  TaskStatus,
  Truck,
  WasteDetection,
} from "./types";

const STORAGE_KEY = "si-bridges-state-v1";

export type AppMode = "demo" | "supabase" | "loading";

export interface AppState {
  detections: WasteDetection[];
  trucks: Truck[];
  tasks: CleaningTask[];
  facilities: Facility[];
  deliveries: Delivery[];
  alerts: Alert[];
  floodZones: FloodZone[];
  users: AppUser[];
  currentUserId: string | null;
  loggedIn: boolean;
  layers: Record<LayerKey, boolean>;
}

interface Store extends AppState {
  mode: AppMode;
  currentUser: AppUser | null;
  authError: string;
  authBusy: boolean;
  login: (userId: string) => void;
  loginEmail: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (id: string) => void;
  toggleLayer: (k: LayerKey) => void;
  addDetection: (d: Omit<WasteDetection, "id" | "detectedAt" | "status">) => WasteDetection;
  verifyDetection: (id: string, override?: Partial<WasteDetection>) => void;
  rejectDetection: (id: string) => void;
  createTaskFromDetection: (detectionId: string, truckId?: string, priority?: CleaningTask["priority"]) => CleaningTask | null;
  updateTaskStatus: (taskId: string, status: TaskStatus, notes?: string) => void;
  assignTask: (taskId: string, truckId: string, team: string) => void;
  uploadTaskEvidence: (taskId: string) => void;
  verifyTask: (taskId: string) => void;
  addDelivery: (delivery: Omit<Delivery, "id" | "timestamp" | "status">) => void;
  acknowledgeAlert: (id: string) => void;
  resolveAlert: (id: string) => void;
  setTruckStatus: (id: string, status: Truck["status"]) => void;
  setTruckGpsLive: (id: string, live: boolean) => void;
  reportTruckPosition: (id: string, lat: number, lng: number, speedKmh?: number) => void;
  updateFacilityLoad: (id: string, deltaTons: number) => void;
  simulateAI: (location: string, district: string, imageName?: string) => AIAnalysis;
}

const Ctx = createContext<Store | null>(null);

const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  detections: true,
  trucks: true,
  routes: false,
  tps: true,
  tpst: true,
  tpa: true,
  flood: true,
  rivers: true,
};

const SUPABASE_MODE = isSupabaseConfigured;

function demoInitialState(): AppState {
  const d = buildDemoState();
  return { ...d, users: USERS, currentUserId: null, loggedIn: false, layers: DEFAULT_LAYERS };
}

function loadDemoState(): AppState {
  if (typeof window === "undefined") return demoInitialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        users: USERS,
        loggedIn: !!parsed.currentUserId || parsed.loggedIn,
        currentUserId: parsed.currentUserId ?? null,
        layers: { ...DEFAULT_LAYERS, ...(parsed.layers ?? {}) },
      };
    }
  } catch {}
  return demoInitialState();
}

const emptyState = (): AppState => ({
  detections: [], trucks: [], tasks: [], facilities: [], deliveries: [], alerts: [], floodZones: [],
  users: [], currentUserId: null, loggedIn: false, layers: DEFAULT_LAYERS,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => (SUPABASE_MODE ? emptyState() : loadDemoState()));
  const [mode, setMode] = useState<AppMode>(SUPABASE_MODE ? "loading" : "demo");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const seq = useRef(1000);
  const supabase = getSupabase();
  const gpsLive = useRef<Set<string>>(new Set());
  const gpsWpBackup = useRef(new Map<string, { lat: number; lng: number }[]>());

  // ---------- data fetching (supabase) ----------
  const fetchAll = useCallback(async (sb: NonNullable<typeof supabase>) => {
    const [det, trk, tsk, fac, dlv, alt, fld, usr] = await Promise.all([
      sb.from("detections").select("*").order("detected_at", { ascending: false }),
      sb.from("trucks").select("*"),
      sb.from("cleaning_tasks").select("*, profiles!cleaning_tasks_created_by_fkey(name)").order("created_at", { ascending: false }),
      sb.from("facilities").select("*"),
      sb.from("deliveries").select("*").order("timestamp", { ascending: false }),
      sb.from("alerts").select("*").order("created_at", { ascending: false }),
      sb.from("flood_zones").select("*"),
      sb.from("profiles").select("id,name,email,role"),
    ]);
    setState((s) => ({
      ...s,
      detections: (det.data ?? []).map(rowToDetection),
      trucks: (trk.data ?? []).map(rowToTruck),
      tasks: (tsk.data ?? []).map((r: any) => rowToTask({ ...r, created_by_name: r.profiles?.name })),
      facilities: (fac.data ?? []).map(rowToFacility),
      deliveries: (dlv.data ?? []).map(rowToDelivery),
      alerts: (alt.data ?? []).map(rowToAlert),
      floodZones: (fld.data ?? []).map(rowToFloodZone),
      users: (usr.data ?? []).map(rowToUser),
    }));
  }, []);

  // ---------- auth ----------
  useEffect(() => {
    if (!SUPABASE_MODE || !supabase) { setMode("demo"); return; }
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session) {
        await fetchAll(supabase);
        const { data: prof } = await supabase.from("profiles").select("id,name,email,role").eq("id", session.user.id).single();
        if (mounted && prof) {
          setState((s) => ({ ...s, currentUserId: prof.id, loggedIn: true }));
        }
        setMode("supabase");
      } else {
        setMode("supabase"); // show login screen
      }
    })();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setState(emptyState());
        setMode("supabase");
      } else if (session) {
        await fetchAll(supabase);
        const { data: prof } = await supabase.from("profiles").select("id,name,email,role").eq("id", session.user.id).single();
        setState((s) => ({ ...s, currentUserId: prof?.id ?? session.user.id, loggedIn: true }));
        setMode("supabase");
      }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [supabase, fetchAll]);

  // ---------- realtime ----------
  useEffect(() => {
    if (!SUPABASE_MODE || !supabase || !state.loggedIn) return;
    let timer: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel("si-bridges-changes")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => fetchAll(supabase), 600);
      })
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(channel); };
  }, [supabase, state.loggedIn, fetchAll]);

  // persist demo state only
  useEffect(() => {
    if (SUPABASE_MODE) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  // ---------- simulated truck GPS ----------
  useEffect(() => {
    const t = setInterval(() => {
      setState((s) => ({
        ...s,
        trucks: s.trucks.map((tr) => {
          if (tr.status !== "active" || tr.waypoints.length < 2 || gpsLive.current.has(tr.id)) return tr;
          const wp = tr.waypoints;
          const next = (tr.wpIndex + 1) % wp.length;
          const target = wp[next];
          const dLat = target.lat - tr.lat;
          const dLng = target.lng - tr.lng;
          const dist = Math.hypot(dLat, dLng);
          const step = 0.0018;
          if (dist <= step) {
            return { ...tr, lat: target.lat, lng: target.lng, wpIndex: next, lastUpdate: new Date().toISOString() };
          }
          return {
            ...tr,
            lat: tr.lat + (dLat / dist) * step,
            lng: tr.lng + (dLng / dist) * step,
            lastUpdate: new Date().toISOString(),
          };
        }),
      }));
    }, 2500);
    return () => clearInterval(t);
  }, []);

  // persist simulated positions to supabase (throttled ~20s)
  const tickRef = useRef(0);
  useEffect(() => {
    if (!SUPABASE_MODE || !supabase) return;
    tickRef.current++;
    if (tickRef.current % 8 !== 0) return;
    const rows = state.trucks
      .filter((t) => t.status === "active")
      .map((t) => ({ id: t.id, lat: t.lat, lng: t.lng, wp_index: t.wpIndex, last_update: t.lastUpdate }));
    if (rows.length) {
      supabase.from("trucks").upsert(rows).then(({ error }) => { if (error) console.error("truck sync", error); });
    }
  }, [state.trucks, supabase]);

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId) ?? null,
    [state.users, state.currentUserId]
  );

  const actions = useMemo((): Store => {
    const sb = supabase;
    const uid = () => state.currentUserId ?? undefined;

    const patchDetection = (id: string, p: Partial<WasteDetection>) => {
      setState((s) => ({ ...s, detections: s.detections.map((d) => (d.id === id ? { ...d, ...p } : d)) }));
      if (sb) {
        const row: Record<string, unknown> = {};
        if (p.status) row.status = p.status;
        if (p.severity) row.severity = p.severity;
        if (p.confidence) row.confidence = p.confidence;
        if (p.aiClass !== undefined) row.ai_class = p.aiClass;
        if (p.observations) row.observations = p.observations;
        if (p.recommendedAction !== undefined) row.recommended_action = p.recommendedAction;
        if (Object.keys(row).length) sb.from("detections").update(row).eq("id", id).then(({ error }) => error && console.error(error));
      }
    };

    const genId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;

    return {
      ...state,
      mode: SUPABASE_MODE ? mode : "demo",
      currentUser,
      authError,
      authBusy,

      login: (userId) => {
        setState((s) => ({ ...s, currentUserId: userId, loggedIn: true }));
        try { localStorage.setItem("si-bridges-user", userId); } catch {}
      },
      loginEmail: async (email, password) => {
        if (!sb) return;
        setAuthBusy(true); setAuthError("");
        const { error } = await sb.auth.signInWithPassword({ email, password });
        setAuthBusy(false);
        if (error) setAuthError(error.message);
      },
      logout: () => {
        if (sb) sb.auth.signOut();
        setState((s) => ({ ...s, currentUserId: null, loggedIn: false }));
      },
      setUser: (id) => {
        if (SUPABASE_MODE) return; // real users managed by auth
        setState((s) => ({ ...s, currentUserId: id }));
      },
      toggleLayer: (k) => setState((s) => ({ ...s, layers: { ...s.layers, [k]: !s.layers[k] } })),

      addDetection: (d) => {
        const det: WasteDetection = {
          ...d,
          id: genId("DET"),
          detectedAt: new Date().toISOString(),
          status: "new",
        };
        setState((s) => ({ ...s, detections: [det, ...s.detections] }));
        if (sb) {
          sb.from("detections").insert(detectionToRow(det, uid())).then(({ error }) => error && console.error(error));
          if (d.severity === "high") {
            const alert: Alert = {
              id: genId("ALT"), type: "high_waste", severity: "critical",
              title: "High waste accumulation detected",
              message: `${d.location}, ${d.district} — new AI detection.`,
              createdAt: det.detectedAt, status: "open", relatedId: det.id,
            };
            setState((s) => ({ ...s, alerts: [alert, ...s.alerts] }));
            sb.from("alerts").insert(alertToRow(alert)).then(({ error }) => error && console.error(error));
          }
        } else if (d.severity === "high") {
          setState((s) => ({
            ...s,
            alerts: [{
              id: `ALT-U${seq.current++}`, type: "high_waste", severity: "critical",
              title: "High waste accumulation detected",
              message: `${d.location}, ${d.district} — new AI detection.`,
              createdAt: det.detectedAt, status: "open", relatedId: det.id,
            }, ...s.alerts],
          }));
        }
        return det;
      },

      verifyDetection: (id, override) => patchDetection(id, { status: "verified", ...(override ?? {}) }),
      rejectDetection: (id) => patchDetection(id, { status: "rejected" }),

      createTaskFromDetection: (detectionId, truckId, priority) => {
        let created: CleaningTask | null = null;
        setState((s) => {
          const det = s.detections.find((d) => d.id === detectionId);
          if (!det) return s;
          const truck = truckId ? s.trucks.find((t) => t.id === truckId) : undefined;
          const task: CleaningTask = {
            id: genId("TSK"),
            title: `Clean ${det.severity} accumulation — ${det.location}`,
            location: det.location,
            district: det.district,
            lat: det.lat,
            lng: det.lng,
            priority: priority ?? (det.severity === "high" ? "critical" : det.severity === "moderate" ? "high" : "medium"),
            status: truck ? "assigned" : "pending",
            detectionId,
            truckId: truck?.id,
            team: truck?.team,
            createdBy: currentUser?.name ?? "System",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          created = task;
          return {
            ...s,
            tasks: [task, ...s.tasks],
            detections: s.detections.map((d) => (d.id === detectionId ? { ...d, status: "assigned" as const } : d)),
          };
        });
        if (sb && created) {
          sb.from("cleaning_tasks").insert({ ...taskToRow(created), created_by: state.currentUserId }).then(({ error }) => error && console.error(error));
          sb.from("detections").update({ status: "assigned" }).eq("id", detectionId).then(({ error }) => error && console.error(error));
        }
        return created;
      },

      updateTaskStatus: (taskId, status, notes) => {
        setState((s) => ({
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, status, updatedAt: new Date().toISOString(), notes: notes ?? t.notes } : t
          ),
        }));
        if (sb) {
          sb.from("cleaning_tasks").update({ status, notes: notes ?? null, updated_at: new Date().toISOString() }).eq("id", taskId)
            .then(({ error }) => error && console.error(error));
        }
      },

      assignTask: (taskId, truckId, team) => {
        setState((s) => ({
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, truckId, team, status: "assigned" as TaskStatus, updatedAt: new Date().toISOString() } : t
          ),
        }));
        if (sb) {
          sb.from("cleaning_tasks").update({ truck_id: truckId, team, status: "assigned", updated_at: new Date().toISOString() }).eq("id", taskId)
            .then(({ error }) => error && console.error(error));
        }
      },

      uploadTaskEvidence: (taskId) => {
        setState((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, evidenceUploaded: true, updatedAt: new Date().toISOString() } : t)),
        }));
        if (sb) sb.from("cleaning_tasks").update({ evidence_uploaded: true }).eq("id", taskId).then(({ error }) => error && console.error(error));
      },

      verifyTask: (taskId) => {
        const detId = state.tasks.find((t) => t.id === taskId)?.detectionId;
        setState((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, verified: true, status: "completed" as TaskStatus, updatedAt: new Date().toISOString() } : t)),
          detections: s.detections.map((d) => (d.id === detId ? { ...d, status: "resolved" as const } : d)),
        }));
        if (sb) {
          sb.from("cleaning_tasks").update({ verified: true, verified_by: state.currentUserId, status: "completed", updated_at: new Date().toISOString() }).eq("id", taskId)
            .then(({ error }) => error && console.error(error));
          if (detId) sb.from("detections").update({ status: "resolved" }).eq("id", detId).then(({ error }) => error && console.error(error));
        }
      },

      addDelivery: (delivery) => {
        const d: Delivery = { ...delivery, id: genId("DLV"), timestamp: new Date().toISOString(), status: "completed" };
        setState((s) => ({
          ...s,
          deliveries: [d, ...s.deliveries],
          facilities: s.facilities.map((f) =>
            f.id === delivery.facilityId ? { ...f, currentLoadTons: Math.min(f.capacityTons, f.currentLoadTons + delivery.weightKg / 1000) } : f
          ),
        }));
        if (sb) {
          sb.from("deliveries").insert(deliveryToRow(d)).then(({ error }) => error && console.error(error));
          const fac = state.facilities.find((f) => f.id === delivery.facilityId);
          if (fac) {
            const newLoad = Math.min(fac.capacityTons, fac.currentLoadTons + delivery.weightKg / 1000);
            sb.from("facilities").update({ current_load_tons: newLoad }).eq("id", fac.id).then(({ error }) => error && console.error(error));
          }
        }
      },

      acknowledgeAlert: (id) => {
        setState((s) => ({ ...s, alerts: s.alerts.map((a) => (a.id === id ? { ...a, status: "acknowledged" as const } : a)) }));
        if (sb) sb.from("alerts").update({ status: "acknowledged", acknowledged_by: state.currentUserId }).eq("id", id).then(({ error }) => error && console.error(error));
      },
      resolveAlert: (id) => {
        setState((s) => ({ ...s, alerts: s.alerts.map((a) => (a.id === id ? { ...a, status: "resolved" as const } : a)) }));
        if (sb) sb.from("alerts").update({ status: "resolved", resolved_by: state.currentUserId, resolved_at: new Date().toISOString() }).eq("id", id).then(({ error }) => error && console.error(error));
      },

      setTruckStatus: (id, status) => {
        setState((s) => ({ ...s, trucks: s.trucks.map((t) => (t.id === id ? { ...t, status, lastUpdate: new Date().toISOString() } : t)) }));
        if (sb) sb.from("trucks").update({ status, last_update: new Date().toISOString() }).eq("id", id).then(({ error }) => error && console.error(error));
      },

      setTruckGpsLive: (id, live) => {
        const truck = state.trucks.find((t) => t.id === id);
        if (live) {
          gpsLive.current.add(id);
          // Clear waypoints so simulated movement can't override real GPS — locally and in DB
          if (truck && truck.waypoints.length > 0) {
            gpsWpBackup.current.set(id, truck.waypoints);
            setState((s) => ({ ...s, trucks: s.trucks.map((t) => (t.id === id ? { ...t, waypoints: [] } : t)) }));
            if (sb) sb.from("trucks").update({ waypoints: [] }).eq("id", id).then(({ error }) => error && console.error(error));
          }
          // Force status active so the truck shows as moving
          if (truck && truck.status !== "active") {
            setState((s) => ({ ...s, trucks: s.trucks.map((t) => (t.id === id ? { ...t, status: "active" as const } : t)) }));
            if (sb) sb.from("trucks").update({ status: "active" }).eq("id", id).then(({ error }) => error && console.error(error));
          }
        } else {
          gpsLive.current.delete(id);
          const wp = gpsWpBackup.current.get(id);
          if (wp) {
            gpsWpBackup.current.delete(id);
            setState((s) => ({ ...s, trucks: s.trucks.map((t) => (t.id === id ? { ...t, waypoints: wp } : t)) }));
            if (sb) sb.from("trucks").update({ waypoints: wp }).eq("id", id).then(({ error }) => error && console.error(error));
          }
        }
      },

      reportTruckPosition: (id, lat, lng, speedKmh) => {
        const now = new Date().toISOString();
        setState((s) => ({
          ...s,
          trucks: s.trucks.map((t) =>
            t.id === id ? { ...t, lat, lng, speedKmh: speedKmh ?? t.speedKmh, lastUpdate: now } : t
          ),
        }));
        if (sb) {
          sb.from("trucks")
            .upsert({ id, lat, lng, speed_kmh: speedKmh ?? undefined, last_update: now })
            .then(({ error }) => error && console.error(error));
        }
      },

      updateFacilityLoad: (id, deltaTons) => {
        setState((s) => ({
          ...s,
          facilities: s.facilities.map((f) =>
            f.id === id ? { ...f, currentLoadTons: Math.max(0, Math.min(f.capacityTons, f.currentLoadTons + deltaTons)) } : f
          ),
        }));
        const f = state.facilities.find((x) => x.id === id);
        if (sb && f) {
          const newLoad = Math.max(0, Math.min(f.capacityTons, f.currentLoadTons + deltaTons));
          sb.from("facilities").update({ current_load_tons: newLoad }).eq("id", id).then(({ error }) => error && console.error(error));
        }
      },

      simulateAI: (location, district, imageName) => simulateAIAnalysis(location, district, imageName),
    };
  }, [state, currentUser, mode, authError, authBusy, supabase]);

  return <Ctx.Provider value={actions}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within AppProvider");
  return ctx;
}

export function useCan(roles: string[]) {
  const { currentUser } = useStore();
  return currentUser ? roles.includes(currentUser.role) : false;
}
