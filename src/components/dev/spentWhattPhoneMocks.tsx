import type { ReactNode } from 'react'
import { ui } from '../../lib/uiClasses'

export function SpentWhattMiniPhone({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-[150px] shrink-0">
      <div className="rounded-[20px] border-[2.5px] border-surface-600/80 bg-surface-950 p-[3px] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.65)]">
        <div className="relative aspect-[9/19.5] overflow-hidden rounded-[16px]">{children}</div>
      </div>
      <div
        className="pointer-events-none absolute left-1/2 top-[6px] z-20 h-[3px] w-[28px] -translate-x-1/2 rounded-full bg-black/80"
        aria-hidden
      />
    </div>
  )
}

export function SpentWhattPhoneBackdrop() {
  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-b from-surface-850 via-surface-900 to-[#070b14]" />
      <div className="absolute -left-[30%] -top-[20%] h-[70%] w-[90%] rounded-full bg-teal-700/30 blur-2xl" />
      <div className="absolute -right-[25%] top-[5%] h-[55%] w-[80%] rounded-full bg-violet-700/25 blur-2xl" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(165,96,232,0.14),transparent_50%)]" />
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(248,250,252,0.9) 1px, transparent 0)`,
          backgroundSize: '12px 12px',
        }}
      />
    </>
  )
}

export function GenericFintechScreen() {
  return (
    <div className="flex h-full flex-col bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 p-1.5">
      <p className="text-[5px] font-bold uppercase tracking-widest text-white/45">NovaPay</p>
      <p className="mt-0.5 text-[9px] font-black text-white">$12,847</p>
      <div className="mt-1 grid grid-cols-3 gap-0.5">
        {['↑12%', 'VIP', 'AI'].map((c) => (
          <span key={c} className="rounded bg-white/20 py-px text-center text-[4px] font-bold text-white">
            {c}
          </span>
        ))}
      </div>
      <div className="mt-1 flex-1 space-y-0.5">
        {[1, 2, 3].map((n) => (
          <div key={n} className="rounded bg-white/15 p-0.5">
            <p className="text-[4px] text-white/70">Tx #{n}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SpentWhattClassifyScreen() {
  return (
    <div className="relative flex h-full flex-col">
      <SpentWhattPhoneBackdrop />
      <div className="relative flex flex-1 flex-col px-1.5 pb-[18%] pt-[12%]">
        <p className="text-center text-[6px] font-semibold text-surface-400">Classify</p>
        <div className="relative mx-auto mt-1.5 flex w-[92%] flex-1 flex-col items-center justify-center rounded-[14px] border border-white/[0.09] bg-gradient-to-br from-white/[0.07] via-surface-950 to-surface-950 p-2 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 rounded-[12px] border border-duo-green/50" />
          <p className="text-[5px] text-surface-500">Mar 12</p>
          <p className="mt-0.5 text-center text-[8px] font-bold text-surface-50">Whole Foods</p>
          <p className="mt-1 text-[10px] font-extrabold tabular-nums text-surface-50">$47.82</p>
          <div className="absolute left-1 top-1 rounded bg-duo-green px-1 py-px text-[4px] font-bold text-white">
            Sort
          </div>
          <div className="absolute right-1 top-1 rounded bg-flame px-1 py-px text-[4px] font-bold text-white">
            No idea
          </div>
          <div className="mt-2 inline-flex items-center gap-0.5 rounded-full border border-duo-green/40 bg-duo-green/15 px-1.5 py-0.5">
            <span className="text-[6px]">🛒</span>
            <span className="text-[5px] font-semibold text-duo-green">Groceries</span>
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 border-t border-white/[0.06] bg-surface-900/95 px-2 py-1">
        <div className="flex justify-around">
          {['Home', 'Sort', 'Reveal'].map((t, i) => (
            <span
              key={t}
              className={`text-[5px] font-semibold ${i === 1 ? 'text-duo-green' : 'text-surface-500'}`}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SpentWhattHomeScreen() {
  return (
    <div className="relative flex h-full flex-col">
      <SpentWhattPhoneBackdrop />
      <div className="relative flex flex-1 flex-col gap-1.5 px-2 pb-[16%] pt-[12%]">
        <p className={`${ui.heroTitle} text-[8px] leading-tight`}>Good evening</p>
        <div className={`${ui.glassFlat} p-2`}>
          <div className="flex items-center gap-1.5">
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gem/15 text-[6px] font-bold text-gem ring-1 ring-surface-900">
              Y
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[6px] font-semibold text-surface-200">Level 5</p>
              <div className="mt-0.5 h-0.5 overflow-hidden rounded-full bg-surface-800">
                <div className="h-full w-[65%] rounded-full bg-gradient-to-r from-gem to-duo-green" />
              </div>
            </div>
          </div>
        </div>
        <div className={`${ui.glassInset} p-2`}>
          <p className="text-[5px] text-surface-500">Queue</p>
          <p className="text-[7px] font-bold text-ice">12 to classify</p>
        </div>
        <span className="mt-auto rounded-lg border-b-[2px] border-duo-green-dark bg-duo-green py-1 text-center text-[6px] font-bold text-white shadow-[0_6px_16px_-4px_rgba(88,204,2,0.45)]">
          Start sorting
        </span>
      </div>
    </div>
  )
}

export function FlatOffBrandScreen() {
  return (
    <div className="flex h-full flex-col bg-[#12141a] p-2">
      <p className="text-[7px] text-surface-400">Reveal</p>
      <div className="mt-2 flex-1 rounded-lg bg-[#181a22] p-2">
        <p className="text-[8px] font-bold text-surface-100">Weekly recap</p>
        <p className="text-[5px] text-surface-600">Flat placeholder UI</p>
      </div>
    </div>
  )
}

export function SpentWhattRevealScreen() {
  return (
    <div className="relative flex h-full flex-col">
      <SpentWhattPhoneBackdrop />
      <div className="relative flex flex-1 flex-col gap-1.5 p-2 pt-[12%]">
        <p className="text-[7px] font-semibold text-surface-300">Reveal</p>
        <div className={`${ui.glassFlat} flex-1 p-2`}>
          <p className="text-[5px] uppercase tracking-wider text-gem/80">March spend</p>
          <p className="mt-1 text-[11px] font-extrabold tabular-nums text-surface-50">$2,184</p>
          <p className="mt-1 text-[5px] text-duo-green">↓ 8% vs last month</p>
        </div>
      </div>
    </div>
  )
}

export function PillSpamScreen() {
  return (
    <div className="relative h-full bg-slate-900">
      {['New', 'Hot', 'AI', 'Pro', 'Beta'].map((pill, i) => (
        <span
          key={pill}
          className="absolute rounded-full border border-purple-400/40 bg-purple-500/30 px-1 py-px text-[4px] font-bold text-purple-100"
          style={{ top: `${10 + i * 14}%`, left: `${8 + i * 12}%` }}
        >
          {pill}
        </span>
      ))}
      <div className="absolute inset-x-1.5 bottom-8 top-10 rounded-lg border border-white/10 bg-white/5 p-1">
        <p className="text-[6px] font-bold text-white/60">Starbucks</p>
      </div>
    </div>
  )
}

export function CrampedStatsScreen() {
  return (
    <div className="flex h-full flex-col gap-0.5 overflow-hidden bg-surface-900 p-1">
      {['Budget', 'Spent', 'Saved', 'Streak', 'XP', 'Rank'].map((row) => (
        <div key={row} className="flex justify-between rounded bg-surface-800 px-1 py-0.5">
          <span className="text-[5px] text-surface-400">{row}</span>
          <span className="text-[5px] font-bold text-surface-200">—</span>
        </div>
      ))}
    </div>
  )
}

export function UnsafeAreaScreen() {
  return (
    <div className="relative h-full bg-surface-900">
      <p className="absolute left-0 right-0 top-0 text-center text-[7px] font-bold text-surface-50">Classify</p>
      <div className="absolute inset-x-1 top-3 bottom-2 rounded-lg bg-surface-800 p-1">
        <p className="text-[6px] font-bold text-surface-100">Whole Foods</p>
      </div>
      <span className="absolute bottom-0 left-0 right-0 bg-ice py-0.5 text-center text-[5px] font-bold text-white">
        Confirm
      </span>
    </div>
  )
}
