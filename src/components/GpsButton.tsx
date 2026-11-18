"use client";

import React, { useState } from "react";
import { LocateFixed, Loader2 } from "lucide-react";
import { cn } from "@/components/ui";

/**
 * "Enable GPS" button — grabs a precise one-shot device location and
 * calls onFix(lat, lng, accuracyMeters). Works for all roles.
 * Requires HTTPS or localhost (browser geolocation secure-context rule).
 */
export default function GpsButton({
  onFix,
  className,
  label = "Enable GPS",
}: {
  onFix: (lat: number, lng: number, accuracyM?: number) => void;
  className?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const locate = () => {
    if (!navigator.geolocation) {
      setErr("Geolocation not supported on this device.");
      return;
    }
    setBusy(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onFix(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        setBusy(false);
      },
      (e) => {
        setErr(
          e.code === e.PERMISSION_DENIED
            ? "Location permission denied — allow GPS in browser settings."
            : "Couldn't get a fix — move to open sky and retry."
        );
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={locate}
        disabled={busy}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-100 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
        {busy ? "Getting GPS fix…" : label}
      </button>
      {err && <p className="mt-1 text-center text-[10px] text-red-500">{err}</p>}
    </div>
  );
}
