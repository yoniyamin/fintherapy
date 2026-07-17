import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'

interface ConfettiProps {
  count?: number
  active: boolean
}

const COLORS = ['#58CC02', '#FF9600', '#A560E8', '#1CB0F6', '#ef4444', '#f59e0b', '#22c55e', '#6366f1']

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min
}

export default function Confetti({ count = 50, active }: ConfettiProps) {
  const prefersReduced = useReducedMotion()

  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: randomBetween(-50, 50),
        endX: randomBetween(-200, 200),
        endY: randomBetween(300, 600),
        rotation: randomBetween(0, 720),
        color: COLORS[i % COLORS.length],
        delay: randomBetween(0, 0.3),
        duration: randomBetween(1.5, 3),
        size: randomBetween(6, 12),
        shape: Math.random() > 0.5 ? 'circle' : 'rect',
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active],
  )

  if (!active || prefersReduced) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute left-1/2 top-1/3"
          style={{
            width: p.shape === 'circle' ? p.size : p.size * 0.6,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
          }}
          initial={{ x: p.x, y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{
            x: p.endX,
            y: p.endY,
            opacity: 0,
            rotate: p.rotation,
            scale: 0.5,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  )
}
