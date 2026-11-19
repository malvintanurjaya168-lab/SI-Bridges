"use client";

import React, { useMemo } from "react";
import { Sparkles, MapPin, CalendarCheck } from "lucide-react";
import { Card, Badge, DemoTag, fmtDate, EmptyState } from "@/components/ui";
import { useStore } from "@/lib/store";
import { DISTRICTS } from "@/lib/geo";

export default function CleanedAreasPage() {
  const { tasks } = useStore();

  // Only staff-verified completions count — citizens see what ops confirmed, nothing else.
  const cleaned = useMemo(
    () => tasks.filter((t) => t.status === "completed" && t.verified).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [tasks]
  );

  const byDistrict = useMemo(() => {
    const m = new Map<string, number>();
    cleaned.forEach((t) => m.set(t.district, (m.get(t.district) ?? 0) + 1));
    return DISTRICTS.map((d) => ({ district: d, count: m.get(d) ?? 0 })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count);
  }, [cleaned]);

  const maxCount = byDistrict[0]?.count ?? 1;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Sparkles className="h-5 w-5 text-emerald-500" /> Cleaned Areas</h1>
          <p className="text-sm text-slate-500">Waste piles verified and cleared by crews — updated live.</p>
        </div>
        <DemoTag />
      </div>

      {/* District summary */}
      <Card className="mb-5 p-5">
        <h3 className="mb-3 text-sm font-bold text-slate-900">By district</h3>
        {byDistrict.length === 0 ? (
          <p className="text-xs text-slate-400">No verified cleanups yet.</p>
        ) : (
          <div className="space-y-2">
            {byDistrict.map(({ district, count }) => (
              <div key={district}>
                <div className="mb-0.5 flex justify-between text-[11px]">
                  <span className="font-medium text-slate-600">{district}</span>
                  <span className="font-semibold text-slate-500">{count} cleaned</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(count / maxCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent cleanups */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-900">Recently cleaned locations</h3>
          <Badge tone="green">{cleaned.length} total</Badge>
        </div>
        {cleaned.length === 0 ? (
          <EmptyState icon={<CalendarCheck className="h-6 w-6" />} title="Nothing cleaned yet" sub="Verified cleanups by field crews will appear here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {cleaned.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600"><MapPin className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{t.location}</p>
                  <p className="text-[11px] text-slate-400">{t.district} · {t.title}</p>
                  {t.evidenceUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.evidenceUrl} alt="cleaned proof" className="mt-1.5 h-14 w-20 rounded-lg border border-slate-200 object-cover" />
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-600">{fmtDate(t.updatedAt)}</p>
                  {t.verified && <Badge tone="green">verified</Badge>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
