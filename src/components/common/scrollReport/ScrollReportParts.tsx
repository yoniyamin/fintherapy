import { useRef, type ReactNode } from 'react'
import { motion, useInView } from 'framer-motion'
import { REPORT_EASE } from '../../../lib/scrollReportMotion'

/** Soft gradient divider between report sections. */
export function ScrollReportDivider() {
  return <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
}

interface ScrollReportSectionProps {
  id: string
  title?: string
  children: ReactNode
}

/** Compact report section with scroll-triggered reveal. */
export function ScrollReportSection({ id, title, children }: ScrollReportSectionProps) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.2, margin: '0px 0px -8% 0px' })

  return (
    <section
      ref={ref}
      id={id}
      aria-labelledby={title ? `${id}-heading` : undefined}
      className="scroll-mt-[4.5rem] py-5"
    >
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 0.55, ease: REPORT_EASE }}
        className="space-y-3"
      >
        {title && (
          <motion.h2
            id={`${id}-heading`}
            initial={{ opacity: 0, x: -12 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.45, delay: 0.05, ease: REPORT_EASE }}
            className="text-sm font-semibold uppercase tracking-wider text-surface-500"
          >
            {title}
          </motion.h2>
        )}
        {children}
      </motion.div>
    </section>
  )
}

/** Staggered child reveal for list rows and cards. */
export function RevealStagger({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.15 })

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
      }}
    >
      {children}
    </motion.div>
  )
}

/** Single stagger item with slide-up fade. */
export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: REPORT_EASE } },
      }}
    >
      {children}
    </motion.div>
  )
}

interface ScrollReportTitleSectionProps {
  id: string
  onTitleClick: () => void
  children: ReactNode
}

/** Hero title block with spring entrance and scroll hint. */
export function ScrollReportTitleSection({ id, onTitleClick, children }: ScrollReportTitleSectionProps) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })

  return (
    <section ref={ref} id={id} className="scroll-mt-[4.5rem] py-4">
      <button
        type="button"
        onClick={onTitleClick}
        className="mx-auto block w-full transition-opacity hover:opacity-90"
      >
        {children}
      </button>
      <motion.p
        className="mt-4 text-center text-[11px] text-surface-600"
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: [0.4, 1, 0.4] } : {}}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      >
        Scroll to explore ↓
      </motion.p>
    </section>
  )
}
