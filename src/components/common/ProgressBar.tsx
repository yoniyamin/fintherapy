import { motion } from 'framer-motion'

interface ProgressBarProps {
  current: number
  total: number
  label?: string
}

export default function ProgressBar({ current, total, label }: ProgressBarProps) {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0

  return (
    <div className="w-full">
      {label && (
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-surface-400">{label}</span>
          <span className="text-xs font-bold tabular-nums text-duo-green">
            {current}/{total}
          </span>
        </div>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-950/80 ring-1 ring-white/[0.06]">
        <motion.div
          className="h-full w-full origin-left rounded-full bg-gradient-to-r from-teal-500/90 via-duo-green to-duo-green-light"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: pct / 100 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="h-full w-full rounded-full bg-gradient-to-b from-white/20 to-transparent" />
        </motion.div>
      </div>
    </div>
  )
}
