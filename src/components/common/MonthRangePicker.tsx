import { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ui } from '../../lib/uiClasses'

export type MonthSelection =
  | { mode: 'single'; months: [string] }
  | { mode: 'multi'; months: string[] }
  | { mode: 'range'; from: string; to: string; months: string[] }
  | { mode: 'year'; year: number; months: string[] }

interface Props {
  value: MonthSelection
  onChange: (selection: MonthSelection) => void
  monthsWithData?: string[]
  allowSingle?: boolean
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatMonthShort(value: string): string {
  const [, m] = value.split('-')
  return MONTH_LABELS[Number(m) - 1] ?? m
}

function formatMonthFull(value: string): string {
  const [year, month] = value.split('-')
  const date = new Date(Number(year), Number(month) - 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function getChipLabel(sel: MonthSelection): string {
  if (sel.mode === 'single') return formatMonthFull(sel.months[0])
  if (sel.mode === 'year') return `${sel.year} (${sel.months.length} months)`
  if (sel.months.length === 0) return 'Select months'
  if (sel.months.length === 1) return formatMonthFull(sel.months[0])

  const sorted = [...sel.months].sort()
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const [fy] = first.split('-')
  const [ly] = last.split('-')
  const sameYear = fy === ly

  return sameYear
    ? `${formatMonthShort(first)} – ${formatMonthShort(last)} ${fy} (${sorted.length} months)`
    : `${formatMonthShort(first)} ${fy} – ${formatMonthShort(last)} ${ly} (${sorted.length} months)`
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function MonthRangePicker({ value, onChange, monthsWithData, allowSingle = true }: Props) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => {
    const first = value.months[0] ?? getCurrentMonth()
    return Number(first.split('-')[0])
  })
  const [multiMode, setMultiMode] = useState(value.mode !== 'single')
  const [draft, setDraft] = useState<Set<string>>(() => new Set(value.months))
  const panelRef = useRef<HTMLDivElement>(null)

  const handleToggleOpen = () => {
    if (!open) {
      setDraft(new Set(value.months))
      setMultiMode(value.mode !== 'single')
    }
    setOpen(!open)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const dataSet = useMemo(() => new Set(monthsWithData ?? []), [monthsWithData])

  const yearMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) =>
      `${viewYear}-${String(i + 1).padStart(2, '0')}`
    )
  }, [viewYear])

  const handleMonthClick = (month: string) => {
    if (!multiMode) {
      if (allowSingle) {
        onChange({ mode: 'single', months: [month] })
        setOpen(false)
      }
      return
    }
    setDraft(prev => {
      const next = new Set(prev)
      if (next.has(month)) next.delete(month)
      else next.add(month)
      return next
    })
  }

  const handleApply = () => {
    const sorted = Array.from(draft).sort()
    if (sorted.length === 0) return
    if (sorted.length === 1 && allowSingle) {
      onChange({ mode: 'single', months: [sorted[0]] as [string] })
    } else {
      onChange({ mode: 'multi', months: sorted })
    }
    setOpen(false)
  }

  const handleSelectYear = () => {
    const months = yearMonths.filter(m => !monthsWithData || dataSet.has(m))
    if (months.length === 0) return
    setDraft(new Set(months))
  }

  const handlePreset = (label: string) => {
    const now = new Date()
    let count = 3
    if (label === 'Last 6m') count = 6
    else if (label === 'YTD') count = now.getMonth() + 1

    const months: string[] = []
    for (let i = 0; i < count; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    const sorted = months.sort()
    setDraft(new Set(sorted))
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={handleToggleOpen}
        className={`flex w-full items-center justify-between gap-2 ${ui.select}`}
      >
        <span className="truncate">{getChipLabel(value)}</span>
        <span className="text-surface-500">{open ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute left-0 right-0 top-full z-[100] mt-2 overflow-hidden rounded-2xl border border-white/[0.1] bg-surface-950 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.65)]"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <div className="p-3 space-y-3">
              {/* Multi-mode toggle */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMultiMode(m => !m)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    multiMode ? 'bg-duo-green/15 text-duo-green' : 'bg-surface-800 text-surface-400'
                  }`}
                >
                  {multiMode ? 'Multi-select ON' : 'Single month'}
                </button>
                {multiMode && (
                  <div className="flex gap-1">
                    {['Last 3m', 'Last 6m', 'YTD'].map(label => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => handlePreset(label)}
                        className="rounded-md bg-surface-800 px-2 py-1 text-[10px] font-medium text-surface-400 transition-colors hover:bg-surface-700 hover:text-surface-200"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Year nav */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setViewYear(y => y - 1)}
                  className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-white/[0.04] hover:text-surface-200"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={multiMode ? handleSelectYear : undefined}
                  className={`text-sm font-bold text-surface-200 ${multiMode ? 'cursor-pointer hover:text-duo-green' : ''}`}
                  title={multiMode ? `Select all of ${viewYear}` : undefined}
                >
                  {viewYear}
                </button>
                <button
                  type="button"
                  onClick={() => setViewYear(y => y + 1)}
                  className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-white/[0.04] hover:text-surface-200"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>

              {/* Month grid */}
              <div className="grid grid-cols-4 gap-1.5">
                {yearMonths.map((month, i) => {
                  const hasData = !monthsWithData || dataSet.has(month)
                  const selected = draft.has(month)
                  const isFuture = month > getCurrentMonth()
                  const cantSelect = isFuture || (!hasData && !!monthsWithData)
                  const disabled = cantSelect && !selected

                  return (
                    <button
                      key={month}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleMonthClick(month)}
                      className={`rounded-xl py-2.5 text-xs font-semibold transition-all ${
                        selected
                          ? 'bg-duo-green/20 text-duo-green border border-duo-green/40 shadow-[0_0_8px_rgba(88,204,2,0.2)]'
                          : disabled
                            ? 'text-surface-700 cursor-not-allowed'
                            : 'text-surface-400 border border-transparent hover:bg-white/[0.04] hover:text-surface-200'
                      }`}
                    >
                      {MONTH_LABELS[i]}
                    </button>
                  )
                })}
              </div>

              {/* Apply + Clear buttons (multi-mode) */}
              {multiMode && (
                <div className="flex gap-2">
                  {draft.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setDraft(new Set())}
                      className="rounded-xl border border-surface-600/40 bg-surface-800 px-3 py-2.5 text-xs font-semibold text-surface-400 transition-colors hover:bg-surface-700 hover:text-surface-200"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={draft.size === 0}
                    className="flex-1 rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_-8px_rgba(88,204,2,0.4)] transition-all active:translate-y-[1px] active:border-b disabled:opacity-40"
                  >
                    Apply ({draft.size} month{draft.size !== 1 ? 's' : ''})
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
