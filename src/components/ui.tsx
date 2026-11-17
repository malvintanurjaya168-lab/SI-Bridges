import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import React from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]", className)} {...p}>
      {children}
    </div>
  );
}

export function Badge({ className, children, tone = "slate" }: { className?: string; children: React.ReactNode; tone?: "slate" | "green" | "amber" | "red" | "blue" | "purple" | "teal" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-1 ring-red-200",
    blue: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    purple: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
    teal: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", tones[tone], className)}>{children}</span>;
}

export function Button({ className, variant = "primary", size = "md", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "outline"; size?: "sm" | "md" }) {
  const v = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
    secondary: "bg-slate-900 text-white hover:bg-slate-800",
    outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  }[variant];
  const s = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  return <button className={cn("inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none", v, s, className)} {...p} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400",
        "focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition",
        props.className
      )}
      {...props}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800",
        "focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition",
        props.className
      )}
      {...props}
    />
  );
}

export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={cn("mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500", className)}>{children}</label>;
}

export function StatCard({ icon, label, value, sub, tone = "emerald", trend }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; tone?: "emerald" | "amber" | "red" | "blue" | "purple" | "teal"; trend?: string }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-violet-50 text-violet-600",
    teal: "bg-teal-50 text-teal-600",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        <div className={cn("rounded-xl p-2.5", tones[tone])}>{icon}</div>
      </div>
      {trend && <p className="mt-3 text-xs font-medium text-emerald-600">{trend}</p>}
    </Card>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { tone: "red" | "amber" | "green" | "slate" | "blue" | "purple"; label: string }> = {
    high: { tone: "red", label: "High" },
    critical: { tone: "red", label: "Critical" },
    moderate: { tone: "amber", label: "Moderate" },
    medium: { tone: "amber", label: "Medium" },
    low: { tone: "green", label: "Low" },
    insufficient: { tone: "slate", label: "Insufficient Data" },
  };
  const m = map[severity] ?? { tone: "slate" as const, label: severity };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: "slate" | "green" | "amber" | "red" | "blue" | "purple" | "teal"; label: string }> = {
    new: { tone: "blue", label: "New" },
    verified: { tone: "teal", label: "Verified" },
    assigned: { tone: "purple", label: "Assigned" },
    resolved: { tone: "green", label: "Resolved" },
    rejected: { tone: "red", label: "Rejected" },
    pending: { tone: "amber", label: "Pending" },
    en_route: { tone: "blue", label: "En Route" },
    in_progress: { tone: "purple", label: "In Progress" },
    completed: { tone: "green", label: "Completed" },
    cancelled: { tone: "slate", label: "Cancelled" },
    active: { tone: "green", label: "Active" },
    idle: { tone: "amber", label: "Idle" },
    offline: { tone: "red", label: "Offline" },
    maintenance: { tone: "slate", label: "Maintenance" },
    open: { tone: "red", label: "Open" },
    acknowledged: { tone: "amber", label: "Acknowledged" },
    operational: { tone: "green", label: "Operational" },
    near_capacity: { tone: "amber", label: "Near Capacity" },
    full: { tone: "red", label: "Full" },
    in_transit: { tone: "blue", label: "In Transit" },
    scheduled: { tone: "slate", label: "Scheduled" },
  };
  const m = map[status] ?? { tone: "slate" as const, label: status };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function DemoTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
      Demo Data
    </span>
  );
}

export function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-2xl bg-slate-100 p-4 text-slate-400">{icon}</div>
      <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
export function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - +new Date(iso)) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
