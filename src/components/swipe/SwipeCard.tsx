import { motion, useMotionValue, useTransform } from 'framer-motion'
import type { MerchantGroup } from '../../stores/classificationStore'

interface SwipeCardProps {
  group: MerchantGroup
  onSwipeRight: () => void
  onSwipeLeft: () => void
  onTransfer: () => void
  stackIndex: number
}

export default function SwipeCard({
  group,
  onSwipeRight,
  onSwipeLeft,
  onTransfer,
  stackIndex,
}: SwipeCardProps) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-12, 12])
  const rightOpacity = useTransform(x, [0, 100], [0, 1])
  const leftOpacity = useTransform(x, [-100, 0], [1, 0])
  const rightGlow = useTransform(x, [0, 150], ['0px', '20px'])
  const leftGlow = useTransform(x, [-150, 0], ['20px', '0px'])
  const rightBoxShadow = useTransform(rightGlow, v => `0 0 ${v} var(--color-duo-green)`)
  const leftBoxShadow = useTransform(leftGlow, v => `0 0 ${v} var(--color-flame)`)

  const isTopCard = stackIndex === 0
  const scale = 1 - stackIndex * 0.05
  const yOffset = stackIndex * 10

  const handleDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x > 100) {
      onSwipeRight()
    } else if (info.offset.x < -100) {
      onSwipeLeft()
    }
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const tx = group.transactions[0]
  const dateRange = group.count > 1
    ? `${formatDate(group.transactions[group.transactions.length - 1].tx_date)} – ${formatDate(group.transactions[0].tx_date)}`
    : formatDate(tx.tx_date)

  return (
    <motion.div
      className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
      style={{
        x: isTopCard ? x : 0,
        rotate: isTopCard ? rotate : 0,
        scale,
        y: yOffset,
        zIndex: 10 - stackIndex,
      }}
      drag={isTopCard ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={isTopCard ? handleDragEnd : undefined}
      initial={{ scale: 0.95, opacity: 0, y: 30 }}
      animate={{ scale, opacity: 1, y: yOffset }}
      exit={{ x: 300, opacity: 0, rotate: 20, transition: { duration: 0.4, ease: 'easeIn' } }}
    >
      <div className="flex h-full flex-col items-center justify-center rounded-[24px] border border-white/[0.09] bg-gradient-to-br from-white/[0.07] via-surface-950/60 to-surface-950/90 p-8 shadow-[0_28px_56px_-24px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        {isTopCard && (
          <>
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-2xl border border-duo-green"
              style={{ opacity: rightOpacity, boxShadow: rightBoxShadow }}
            />
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-2xl border border-flame"
              style={{ opacity: leftOpacity, boxShadow: leftBoxShadow }}
            />

            <motion.div
              className="absolute left-4 top-4 rounded-lg bg-duo-green px-3 py-1 text-xs font-bold text-white"
              style={{ opacity: rightOpacity }}
            >
              Categorize
            </motion.div>
            <motion.div
              className="absolute right-4 top-4 rounded-lg bg-flame px-3 py-1 text-xs font-bold text-white"
              style={{ opacity: leftOpacity }}
            >
              Flag
            </motion.div>
          </>
        )}

        {isTopCard && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onTransfer()
            }}
            className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-ice/10 text-lg transition-all active:scale-90 active:bg-ice/20"
            title="Mark as money transfer"
          >
            💸
          </button>
        )}

        <div className="text-center">
          <p className="text-xs text-surface-500">{dateRange}</p>
          <h2 className="mt-2 text-xl font-bold text-surface-50">
            {group.merchantClean ?? group.merchantRaw}
          </h2>

          {group.count > 1 && (
            <motion.div
              className="mx-auto mt-2 inline-flex items-center gap-1.5 rounded-full bg-gem/10 px-2.5 py-0.5"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
            >
              <span className="text-xs font-semibold text-gem">{group.count} transactions</span>
            </motion.div>
          )}

          <p className="mt-4 text-4xl font-extrabold tracking-tight tabular-nums text-primary-400">
            {formatAmount(group.totalAmount)}
          </p>

          {group.count > 1 && (
            <p className="mt-1 text-xs text-surface-500">
              {group.transactions.map(t => formatAmount(Number(t.amount))).join(' + ')}
            </p>
          )}
        </div>

        {isTopCard && (
          <p className="mt-8 text-[10px] font-medium tracking-wider text-surface-500">
            Swipe right to categorize · left to flag
          </p>
        )}
      </div>
    </motion.div>
  )
}
