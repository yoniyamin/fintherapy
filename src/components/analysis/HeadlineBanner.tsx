import { motion } from 'framer-motion'
import { type HealthVerdict } from '../../lib/advisorInsights'

interface Props {
  headline: string
  verdict: HealthVerdict
}

const VERDICT_STYLES: Record<HealthVerdict, string> = {
  green: 'border-green-500/40 bg-green-500/10',
  amber: 'border-amber-500/40 bg-amber-500/10',
  red: 'border-red-500/40 bg-red-500/10',
}

const VERDICT_DOT: Record<HealthVerdict, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
}

export default function HeadlineBanner({ headline, verdict }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 ${VERDICT_STYLES[verdict]}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${VERDICT_DOT[verdict]}`} />
        <p className="text-sm font-semibold text-slate-100 leading-relaxed">
          {headline}
        </p>
      </div>
    </motion.div>
  )
}
