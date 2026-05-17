"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Leaf, Droplets, Zap, Wind, RefreshCw, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { getEcoImpact, type EcoImpactData } from "@/app/actions";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(decimals);
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  blue:   { bg: "bg-blue-50 dark:bg-blue-950/30",   border: "border-blue-100 dark:border-blue-900/50",   text: "text-blue-700 dark:text-blue-300",   badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
  yellow: { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-100 dark:border-amber-900/50", text: "text-amber-700 dark:text-amber-300", badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" },
  green:  { bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-100 dark:border-green-900/50", text: "text-green-700 dark:text-green-300", badge: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" },
  orange: { bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-100 dark:border-orange-900/50", text: "text-orange-700 dark:text-orange-300", badge: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300" },
  red:    { bg: "bg-red-50 dark:bg-red-950/30",     border: "border-red-100 dark:border-red-900/50",     text: "text-red-700 dark:text-red-300",     badge: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" },
};

function StatCard({
  icon, label, value, unit, description, color = "green", trend,
}: {
  icon: React.ReactNode; label: string; value: string; unit: string;
  description: string; color?: string; trend?: string;
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.green;
  return (
    <div className={`${c.bg} ${c.border} border rounded-3xl p-6 flex flex-col gap-3`}>
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-2xl ${c.badge}`}>{icon}</div>
        {trend && (
          <span className="text-xs font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> {trend}
          </span>
        )}
      </div>
      <div>
        <p className={`text-3xl font-extrabold ${c.text}`}>{value}</p>
        <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5">{unit}</p>
      </div>
      <div>
        <p className="font-bold text-zinc-900 dark:text-zinc-50">{label}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function TicketRow({ ticket }: { ticket: EcoImpactData["tickets"][0] }) {
  const c = COLOR_MAP[ticket.color] ?? COLOR_MAP.green;
  const isResolved = ticket.resolvedAt !== null;
  return (
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:shadow-md transition-shadow">
      <span className="text-2xl flex-shrink-0">{ticket.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs font-semibold text-zinc-500">{ticket.ticketId}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${c.badge}`}>
            {ticket.category.replace("_", " ")}
          </span>
          {isResolved ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Resolved
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Active
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {isResolved
            ? `Resolved in ${ticket.hoursToResolve}h`
            : `Open for ${ticket.hoursToResolve ?? "—"}h`}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-lg font-extrabold ${c.text}`}>
          {ticket.savedAmount !== null ? fmt(ticket.savedAmount, ticket.unit === "kWh" ? 2 : 0) : "—"}
        </p>
        <p className="text-[10px] text-zinc-400 font-medium">{ticket.unit}</p>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EcoImpactPage() {
  const [data, setData] = useState<EcoImpactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getEcoImpact();
    setData(result);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  // Initial load + auto-refresh every 60 seconds
  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  const totalTickets = (data?.resolvedEcoTickets ?? 0) + (data?.activeEcoTickets ?? 0);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col font-sans pb-20">
      {/* Header */}
      <header className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <ArrowLeft className="w-6 h-6 text-zinc-900 dark:text-zinc-50" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <Leaf className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Eco-Impact Dashboard</h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Environmental savings from rapid civic response
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 space-y-8">

        {/* Last updated */}
        <p className="text-xs text-zinc-400 text-right">
          Last updated: {lastRefresh.toLocaleTimeString()} · Auto-refreshes every 60s
        </p>

        {loading && !data ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data && totalTickets === 0 ? (
          <div className="text-center py-24 text-zinc-400">
            <Leaf className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No eco-relevant tickets yet.</p>
            <p className="text-sm mt-1">Submit a water, electricity, or environment grievance to see impact data.</p>
          </div>
        ) : data ? (
          <>
            {/* Hero stats */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-4">
                Cumulative Environmental Savings
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={<Droplets className="w-6 h-6" />}
                  label="Water Conserved"
                  value={fmt(data.totalWaterSaved)}
                  unit="litres"
                  description="Clean water saved by rapid response to leaks and pipe bursts"
                  color="blue"
                  trend={data.totalWaterSaved > 0 ? `${fmt(data.totalWaterSaved / 1000, 1)}K L` : undefined}
                />
                <StatCard
                  icon={<Zap className="w-6 h-6" />}
                  label="Energy Saved"
                  value={fmt(data.totalEnergySaved, 1)}
                  unit="kWh"
                  description="Electricity saved by fixing faulty streetlights and transformers"
                  color="yellow"
                />
                <StatCard
                  icon={<Wind className="w-6 h-6" />}
                  label="Emissions Avoided"
                  value={fmt(data.totalEmissionsAvoided, 1)}
                  unit="kg CO₂e"
                  description="Carbon emissions avoided by addressing pollution and dump sites"
                  color="green"
                />
                <StatCard
                  icon={<Leaf className="w-6 h-6" />}
                  label="Accidents Prevented"
                  value={fmt(data.totalAccidentsPrevented, 1)}
                  unit="estimated"
                  description="Road accidents prevented by fixing potholes and infrastructure hazards"
                  color="orange"
                />
              </div>
            </section>

            {/* Summary row */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 text-center">
                <p className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">{totalTickets}</p>
                <p className="text-sm font-medium text-zinc-500 mt-1">Eco-Relevant Tickets</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 text-center">
                <p className="text-3xl font-extrabold text-green-600 dark:text-green-400">{data.resolvedEcoTickets}</p>
                <p className="text-sm font-medium text-zinc-500 mt-1">Resolved</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 text-center">
                <p className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
                  {data.avgResponseHours > 0 ? `${data.avgResponseHours}h` : "—"}
                </p>
                <p className="text-sm font-medium text-zinc-500 mt-1">Avg Response Time</p>
              </div>
            </section>

            {/* Category breakdown */}
            {data.categoryBreakdown.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-4">
                  Savings by Category
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.categoryBreakdown.map((cat) => {
                    const c = COLOR_MAP[cat.color] ?? COLOR_MAP.green;
                    return (
                      <div key={cat.category} className={`${c.bg} ${c.border} border rounded-2xl p-5 flex items-center gap-4`}>
                        <span className="text-3xl">{cat.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-zinc-900 dark:text-zinc-50 capitalize">
                            {cat.category.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">{cat.count} ticket{cat.count !== 1 ? "s" : ""}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-extrabold ${c.text}`}>{fmt(cat.totalSaved, 1)}</p>
                          <p className="text-[10px] text-zinc-400">{cat.unit}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Per-ticket breakdown */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-4">
                Per-Ticket Impact
              </h2>
              <div className="space-y-3">
                {data.tickets.map((t) => (
                  <TicketRow key={t.ticketId} ticket={t} />
                ))}
              </div>
            </section>

            {/* Methodology note */}
            <section className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Methodology</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Savings are estimated using published Indian municipal data. Water leak rates: 500–2,000 L/hr depending on severity (avg 900 L/hr).
                Electricity: 0.15 kWh/hr per faulty streetlight (250W sodium lamp). Pollution: 0.8 tonnes CO₂e/day per unaddressed dump site.
                Road hazards: ~0.1 incidents/day per unaddressed pothole. Values are capped at 7 days to prevent outlier inflation.
                Resolved tickets show actual response time; active tickets show savings accrued so far.
              </p>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
