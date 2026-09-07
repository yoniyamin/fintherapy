import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ANALYSIS_SECTIONS } from '../../lib/analysisSections'
import { ROUTE_KEYS, sessionStats } from '../../lib/sessionStats'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { ui } from '../../lib/uiClasses'
import ScreenSurface from '../layout/ScreenSurface'

interface StatsSummary {
  total_sessions: number
  total_duration_seconds: number
  section_totals: Record<string, number>
  section_session_counts: Record<string, number>
  auth_action_counts: Record<string, number>
  recent_sessions: {
    id: string
    created_at: string
    auth_action: string
    section_seconds: Record<string, number>
    duration_seconds: number
  }[]
}

const ROUTE_LABELS: Record<string, string> = {
  home: 'Home',
  classify: 'Classify',
  reveal: 'Reveal',
  analysis: 'Analysis',
  bets: 'Bets',
  upload: 'Upload',
  settings: 'Settings',
  household: 'Household',
}

const ANALYSIS_LABELS = Object.fromEntries(ANALYSIS_SECTIONS.map((s) => [s.id, s.label]))

/** Formats integer seconds into a compact human-readable string. */
function fmtDuration(s: number): string {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

/** Builds a fallback summary from the current in-memory session. */
function buildFallback(): StatsSummary {
  const snap = sessionStats.getSnapshot()
  const totals = snap.sectionSeconds
  return {
    total_sessions: 1,
    total_duration_seconds: ROUTE_KEYS.reduce((sum, k) => sum + (totals[k] ?? 0), 0),
    section_totals: totals,
    section_session_counts: Object.fromEntries(
      Object.entries(totals)
        .filter(([, v]) => v > 0)
        .map(([k]) => [k, 1]),
    ),
    auth_action_counts: { [snap.authAction]: 1 },
    recent_sessions: [],
  }
}

/** Fetches aggregate session statistics from Supabase. */
function useUsageStats() {
  const [data, setData] = useState<StatsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabaseConfigured) {
        if (!cancelled) {
          setData(buildFallback())
          setLoading(false)
        }
        return
      }
      const { data: result, error: err } = await supabase.rpc('get_session_statistics_summary')
      if (cancelled) return
      if (err) {
        setError(err.message)
        setData(buildFallback())
      } else {
        setData(result as StatsSummary)
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading, error }
}

interface BarRow {
  key: string
  label: string
  seconds: number
  sessions: number
}

/** Horizontal bar rows sorted by seconds descending. */
function SectionBars({ rows, color, maxSeconds }: { rows: BarRow[]; color: string; maxSeconds: number }) {
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-right text-xs font-medium text-surface-400">{r.label}</span>
          <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-white/[0.04]">
            {r.seconds > 0 && (
              <div
                className="absolute inset-y-0 left-0 rounded-md transition-all"
                style={{
                  width: `${Math.max(2, (r.seconds / maxSeconds) * 100)}%`,
                  backgroundColor: color,
                  opacity: 0.7,
                }}
              />
            )}
          </div>
          <span
            className={`w-16 shrink-0 text-right font-mono text-xs ${r.seconds > 0 ? 'text-surface-200' : 'text-surface-600'}`}
          >
            {r.seconds > 0 ? fmtDuration(r.seconds) : '—'}
          </span>
          <span className="w-12 shrink-0 text-right text-[10px] text-surface-600">
            {r.sessions > 0 ? `${r.sessions} sess` : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Small KPI stat card. */
function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${ui.glassFlat} px-4 py-3 text-center`}>
      <p className="text-lg font-bold text-surface-50">{value}</p>
      <p className="mt-0.5 text-[11px] text-surface-500">{label}</p>
    </div>
  )
}

/**
 * Dev-only screen showing aggregate usage statistics.
 * Helps determine which parts of the app are heavily used vs never visited.
 */
export default function UsageStatsPage() {
  const { data, loading, error } = useUsageStats()

  const routeRows = useMemo<BarRow[]>(() => {
    if (!data) return []
    return [...ROUTE_KEYS]
      .map((k) => ({
        key: k,
        label: ROUTE_LABELS[k] ?? k,
        seconds: Math.floor(data.section_totals[k] ?? 0),
        sessions: data.section_session_counts[k] ?? 0,
      }))
      .sort((a, b) => b.seconds - a.seconds)
  }, [data])

  const analysisRows = useMemo<BarRow[]>(() => {
    if (!data) return []
    return ANALYSIS_SECTIONS.map((s) => ({
      key: s.id,
      label: ANALYSIS_LABELS[s.id] ?? s.id,
      seconds: Math.floor(data.section_totals[s.id] ?? 0),
      sessions: data.section_session_counts[s.id] ?? 0,
    })).sort((a, b) => b.seconds - a.seconds)
  }, [data])

  const routeMax = routeRows[0]?.seconds || 1
  const analysisMax = analysisRows[0]?.seconds || 1
  const neverUsedRoutes = routeRows.filter((r) => r.seconds === 0)
  const neverUsedAnalysis = analysisRows.filter((r) => r.seconds === 0)

  return (
    <ScreenSurface>
      <div className="flex min-h-[100dvh] flex-col pt-[env(safe-area-inset-top,0px)]">
        <header className="shrink-0 border-b border-white/[0.06] px-4 py-4 text-center">
          <Link
            to="/dev"
            className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/90 hover:text-amber-300"
          >
            ← Dev only
          </Link>
          <h1 className="text-xl font-bold text-surface-50">Usage Statistics</h1>
          <p className="mt-1 text-xs text-surface-400">
            {error
              ? `⚠ RPC failed — showing current session · ${error}`
              : 'Aggregate session tracking data'}
          </p>
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-surface-500">Loading…</p>
          </div>
        ) : data ? (
          <div className="flex-1 overflow-y-auto px-4 py-5">
            <div className="mx-auto max-w-xl space-y-6">
              {/* KPI summary */}
              <div className="grid grid-cols-3 gap-3">
                <Kpi label="Sessions" value={String(data.total_sessions)} />
                <Kpi label="Total time" value={fmtDuration(data.total_duration_seconds)} />
                <Kpi
                  label="Avg duration"
                  value={fmtDuration(
                    data.total_sessions > 0
                      ? Math.round(data.total_duration_seconds / data.total_sessions)
                      : 0,
                  )}
                />
              </div>

              {/* Route usage */}
              <section>
                <h2 className="mb-3 text-sm font-semibold text-surface-300">Route usage</h2>
                <div className={`${ui.glassFlat} p-4`}>
                  <SectionBars rows={routeRows} color="#38bdf8" maxSeconds={routeMax} />
                </div>
                {neverUsedRoutes.length > 0 && (
                  <p className="mt-2 text-xs text-surface-600">
                    Never visited:{' '}
                    <span className="text-red-400/80">
                      {neverUsedRoutes.map((r) => r.label).join(', ')}
                    </span>
                  </p>
                )}
              </section>

              {/* Analysis tab breakdown */}
              <section>
                <h2 className="mb-3 text-sm font-semibold text-surface-300">Analysis tab breakdown</h2>
                <div className={`${ui.glassFlat} p-4`}>
                  <SectionBars rows={analysisRows} color="#a78bfa" maxSeconds={analysisMax} />
                </div>
                {neverUsedAnalysis.length > 0 && (
                  <p className="mt-2 text-xs text-surface-600">
                    Never viewed:{' '}
                    <span className="text-red-400/80">
                      {neverUsedAnalysis.map((r) => r.label).join(', ')}
                    </span>
                  </p>
                )}
              </section>

              {/* Auth action breakdown */}
              <section>
                <h2 className="mb-3 text-sm font-semibold text-surface-300">Sign-in methods</h2>
                <div className={`${ui.glassFlat} flex gap-6 px-4 py-3`}>
                  {Object.entries(data.auth_action_counts).map(([action, count]) => (
                    <div key={action} className="text-center">
                      <p className="text-base font-bold text-surface-50">{count as number}</p>
                      <p className="text-[11px] text-surface-500">{action.replace('_', ' ')}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Recent sessions */}
              {data.recent_sessions.length > 0 && (
                <section>
                  <h2 className="mb-3 text-sm font-semibold text-surface-300">
                    Recent sessions ({data.recent_sessions.length})
                  </h2>
                  <div className={`${ui.glassFlat} divide-y divide-white/[0.06] overflow-hidden`}>
                    {data.recent_sessions.map((s) => {
                      const dominant = Object.entries(s.section_seconds)
                        .filter(([k]) => k in ROUTE_LABELS)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 3)
                        .map(([k]) => ROUTE_LABELS[k] ?? k)
                      return (
                        <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="shrink-0 font-mono text-[11px] text-surface-600">
                            {new Date(s.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          <span className="shrink-0 font-mono text-xs text-surface-300">
                            {fmtDuration(s.duration_seconds)}
                          </span>
                          <span className="min-w-0 truncate text-xs text-surface-500">
                            {dominant.join(' → ')}
                          </span>
                          <span className="ml-auto shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-surface-500">
                            {s.auth_action.replace('_', ' ')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </ScreenSurface>
  )
}
