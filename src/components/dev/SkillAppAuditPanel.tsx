import { useCallback, useState } from 'react'
import { AuditVisualExample } from './auditVisualExamples'
import {
  AUDIT_PRIORITY_LABEL,
  AUDIT_PRIORITY_STYLE,
  type SkillAppAudit,
} from './skillAppAudits'
import { ui } from '../../lib/uiClasses'

/**
 * Per-skill audit of the real SpentWhatt UI — grounded in uiClasses, graphify, and production components.
 */
export default function SkillAppAuditPanel({ audit }: { audit: SkillAppAudit }) {
  const [replayKeys, setReplayKeys] = useState<Record<string, number>>({})

  const replayVisual = useCallback((key: string) => {
    setReplayKeys((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }))
  }, [])

  return (
    <section className={`${ui.glassFlat} space-y-4 p-4`}>
      <div>
        <h2 className="text-sm font-semibold text-surface-50">{audit.skillName} — app audit</h2>
        <p className="mt-1 text-xs text-surface-400">{audit.summary}</p>
        <p className="mt-2 font-mono text-[10px] text-surface-600">
          Reviewed: {audit.reviewed.join(' · ')}
        </p>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-duo-green/80">Already working</p>
        <ul className="mt-2 space-y-1.5">
          {audit.strengths.map((s) => (
            <li key={s} className="text-xs leading-relaxed text-surface-300">
              {s}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-flame/80">Recommendations</p>
        <ul className="mt-2 space-y-3">
          {audit.recommendations.map((item) => {
            const visualKey = `${audit.skillId}-${item.title}`
            return (
              <li
                key={item.title}
                className="rounded-xl border border-white/[0.06] bg-surface-950/45 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-surface-100">{item.title}</p>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${AUDIT_PRIORITY_STYLE[item.priority]}`}
                  >
                    {AUDIT_PRIORITY_LABEL[item.priority]}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-surface-400">{item.advice}</p>
                <p className="mt-1.5 font-mono text-[10px] text-ice/70">{item.files.join(' · ')}</p>
                {item.visualId ? (
                  <AuditVisualExample
                    id={item.visualId}
                    replayKey={replayKeys[visualKey] ?? 0}
                    onReplay={() => replayVisual(visualKey)}
                  />
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
