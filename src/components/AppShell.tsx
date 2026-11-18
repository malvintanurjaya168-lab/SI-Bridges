"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Map,
  ScanSearch,
  Camera,
  Truck,
  ClipboardList,
  Factory,
  BarChart3,
  Bell,
  Settings,
  Recycle,
  Menu,
  X,
  ChevronLeft,
  LogOut,
  UserCircle,
  Flag,
} from "lucide-react";
import { cn } from "@/components/ui";
import { useStore } from "@/lib/store";
import { ROLE_LABELS } from "@/lib/demo-data";

// roles: which roles can see each nav item. Omitted = all roles.
// roles: which roles can see each nav item. Omitted = all roles.
// Citizens ("user") get the public minimum: dashboard stats + waste reporting.
// Everything operational (map with live assets, alerts, fleet, analytics, admin) is staff-only.
const NAV: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; roles?: string[] }[] = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard, roles: ["admin", "truck_operator"] },
  { href: "/report", label: "Report Waste", icon: Flag },
  { href: "/map", label: "GIS Monitoring", icon: Map, roles: ["admin", "truck_operator"] },
  { href: "/detection", label: "AI Detection", icon: ScanSearch, roles: ["admin", "truck_operator"] },
  { href: "/camera", label: "Live Camera", icon: Camera, roles: ["admin", "truck_operator"] },
  { href: "/fleet", label: "Fleet Monitoring", icon: Truck, roles: ["admin", "truck_operator"] },
  { href: "/operations", label: "Operations", icon: ClipboardList, roles: ["admin", "truck_operator"] },
  { href: "/facilities", label: "Facilities", icon: Factory, roles: ["admin", "truck_operator"] },
  { href: "/analytics", label: "Analytics", icon: BarChart3, roles: ["admin", "truck_operator"] },
  { href: "/alerts", label: "Alerts", icon: Bell, roles: ["admin", "truck_operator"] },
  { href: "/settings", label: "Data & Users", icon: Settings, roles: ["admin"] },
];

function LoginScreen() {
  const { users, login, mode, loginEmail, loginGuest, authError, authBusy } = useStore();
  const [sel, setSel] = useState(users[1]?.id ?? users[0]?.id);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (mode === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1f33]">
        <div className="flex flex-col items-center gap-3">
          <Recycle className="h-10 w-10 animate-pulse text-emerald-400" />
          <p className="text-sm text-slate-400">Connecting…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b1f33] p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500">
            <Recycle className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">SI BRIDGES</h1>
            <p className="text-xs text-slate-400">Jakarta Smart Waste Monitoring & Prediction</p>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-2xl">
          {mode === "supabase" ? (
            <>
              <h2 className="text-sm font-bold text-slate-900">Sign in</h2>
              <p className="mt-1 text-xs text-slate-500">Use your provisioned operator account.</p>
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => { e.preventDefault(); loginEmail(email, password); }}
              >
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</label>
                  <input
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="you@dlh.jakarta.go.id"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Password</label>
                  <input
                    type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="••••••••"
                  />
                </div>
                {authError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{authError}</p>}
                <button
                  type="submit" disabled={authBusy}
                  className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {authBusy ? "Signing in…" : "Sign In"}
                </button>
              </form>
              <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-wider text-slate-400">
                <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
              </div>
              <button
                onClick={loginGuest} disabled={authBusy}
                className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Continue as Guest — no account needed
              </button>
            </>
          ) : (
            <>
              <h2 className="text-sm font-bold text-slate-900">Sign in — Demo Mode</h2>
              <p className="mt-1 text-xs text-slate-500">Select a demo role. No credentials required.</p>
              <div className="mt-4 space-y-2">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSel(u.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition",
                      sel === u.id ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20" : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-500">
                      {ROLE_LABELS[u.role]}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => login(sel)}
                className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition"
              >
                Enter Dashboard
              </button>
              <button
                onClick={loginGuest}
                className="mt-2 w-full rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Continue as Guest — no account needed
              </button>
            </>
          )}
          <p className="mt-3 text-center text-[10px] text-slate-400">
            {mode === "supabase" ? "Connected to Supabase — data persists across devices." : "All data is synthetic demo data for evaluation purposes."}
          </p>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentUser, logout, setUser, users, alerts, mode } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const openAlerts = alerts.filter((a) => a.status !== "resolved").length;
  const router = useRouter();
  const allowedHrefs = NAV.filter((item) => !item.roles || item.roles.includes(currentUser?.role ?? "")).map((n) => n.href);
  const routeAllowed = allowedHrefs.some((h) => pathname.startsWith(h));

  useEffect(() => setMobileOpen(false), [pathname]);

  const sidebar = (
    <div className="flex h-full flex-col bg-[#0b1f33] text-slate-300">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500">
          <Recycle className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-wide text-white">SI BRIDGES</p>
            <p className="truncate text-[10px] uppercase tracking-widest text-slate-400">Smart Waste Platform</p>
          </div>
        )}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {NAV.filter((item) => !item.roles || item.roles.includes(currentUser?.role ?? "")).map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all",
                active ? "bg-emerald-600/15 text-emerald-300" : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                collapsed && "justify-center px-0"
              )}
            >
              <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-emerald-400")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && item.href === "/alerts" && openAlerts > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{openAlerts}</span>
              )}
              {collapsed && item.href === "/alerts" && openAlerts > 0 && (
                <span className="absolute ml-6 h-2 w-2 rounded-full bg-red-500" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        {!collapsed && (
          <div className="rounded-xl bg-white/5 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 pulse-dot" /> Demo Mode
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
              Synthetic Jakarta data. Not verified operational data.
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mt-2 hidden w-full items-center justify-center gap-2 rounded-xl py-2 text-xs text-slate-500 hover:bg-white/5 hover:text-slate-300 lg:flex"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && "Collapse"}
        </button>
      </div>
    </div>
  );

  if (!currentUser) return <LoginScreen />;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className={cn("hidden shrink-0 transition-all duration-300 lg:block", collapsed ? "w-[68px]" : "w-[240px]")}>{sidebar}</aside>
      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[260px]">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold text-slate-900 sm:text-base">
              {NAV.find((n) => pathname.startsWith(n.href))?.label ?? "Dashboard"}
            </h1>
            <p className="hidden text-[11px] text-slate-400 sm:block">Jakarta Smart Waste Monitoring & Prediction System</p>
          </div>
          <Link href="/alerts" className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100">
            <Bell className="h-5 w-5" />
            {openAlerts > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
          </Link>
          <div className="relative">
            <button
              onClick={() => setUserMenu(!userMenu)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 hover:bg-slate-50"
            >
              <UserCircle className="h-6 w-6 text-emerald-600" />
              <div className="hidden text-left sm:block">
                <p className="text-xs font-semibold text-slate-800">{currentUser.name}</p>
                <p className="text-[10px] text-slate-400">{ROLE_LABELS[currentUser.role]}</p>
              </div>
            </button>
            {userMenu && (
              <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {mode === "supabase" ? "Signed in" : "Switch demo user"}
                </p>
                {mode === "demo" && users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => { setUser(u.id); setUserMenu(false); }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50",
                      u.id === currentUser.id && "bg-emerald-50"
                    )}
                  >
                    <span className="font-medium text-slate-700">{u.name}</span>
                    <span className="text-[9px] text-slate-400">{ROLE_LABELS[u.role]}</span>
                  </button>
                ))}
                <button
                  onClick={() => { logout(); router.push("/overview"); }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {routeAllowed ? children : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-lg font-bold text-slate-800">Access restricted</p>
              <p className="mt-1 text-sm text-slate-500">Your role ({ROLE_LABELS[currentUser.role]}) doesn&apos;t have access to this page.</p>
              <button onClick={() => router.push("/overview")} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Back to Overview
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
