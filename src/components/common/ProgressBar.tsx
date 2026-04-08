import { motion } from 'framer-motion'

interface ProgressBarProps {
  current: number
  total: number
  label?: string
}

export default function ProgressBar({ current, total, label }: ProgressBarProps) {
  const pct = total > 0 ? (current / total) * 100 : 0

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
          className="h-full rounded-full bg-gradient-to-r from-teal-500/90 via-duo-green to-duo-green-light"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
        >
          <div className="h-full w-full rounded-full bg-gradient-to-b from-white/20 to-transparent" />
        </motion.div>
      </div>
    </div>
  )
}
