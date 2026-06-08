import { useEffect, useRef } from 'react'
import { animate, createScope, createTimeline, spring, stagger } from 'animejs'
import type { EncouragementAnimation } from '../../lib/classifyEncouragement'
import DeckClearedAnimation from './DeckClearedAnimation'

type AnimeVariant = Exclude<EncouragementAnimation, 'star'>

interface Props {
  variant: AnimeVariant
  className?: string
}

/**
 * anime.js encouragement visuals — star stays on SMIL in EncouragementAnimation.
 */
export default function EncouragementAnimeAnimation({ variant, className = '' }: Props) {
  if (variant === 'trophy') {
    return <DeckClearedAnimation className={className} />
  }

  if (variant === 'high-five') {
    return <HighFiveAnimation className={className} />
  }

  return <MedalAnimation className={className} />
}

function HighFiveAnimation({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const scopeRef = useRef<ReturnType<typeof createScope> | null>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    scopeRef.current = createScope({ root }).add(() => {
      createTimeline({ defaults: { ease: 'out(3)' } })
        .add('[data-enc-glow]', {
          opacity: [0, 0.5],
          scale: [0.5, 1.1, 1],
          duration: 600,
        })
        .add(
          '[data-enc-hand]',
          {
            opacity: [0, 1],
            duration: 400,
          },
          '-=350',
        )
        .add(
          '[data-enc-hand-left]',
          {
            translateX: [-36, 4],
            rotate: [-18, -6],
            duration: 520,
            ease: spring({ stiffness: 340, damping: 16 }),
          },
          '-=380',
        )
        .add(
          '[data-enc-hand-right]',
          {
            translateX: [36, -4],
            rotate: [18, 6],
            duration: 520,
            ease: spring({ stiffness: 340, damping: 16 }),
          },
          '-=520',
        )
        .add(
          '[data-enc-impact]',
          {
            opacity: [0, 1, 0],
            scale: [0.4, 1.2, 0.9],
            duration: 450,
            ease: 'out(2)',
          },
          '-=120',
        )
        .add(
          '[data-enc-spark]',
          {
            opacity: [0, 1],
            scale: [0, 1],
            duration: 380,
            delay: stagger(60, { from: 'center' }),
            ease: spring({ stiffness: 400, damping: 14 }),
          },
          '-=280',
        )

      animate('[data-enc-hand-left]', {
        rotate: [-8, -4],
        duration: 1800,
        ease: 'inOut(2)',
        alternate: true,
        loop: true,
        delay: 700,
      })
      animate('[data-enc-hand-right]', {
        rotate: [8, 4],
        duration: 1800,
        ease: 'inOut(2)',
        alternate: true,
        loop: true,
        delay: 700,
      })
    })

    return () => {
      scopeRef.current?.revert()
      scopeRef.current = null
    }
  }, [])

  return (
    <div ref={rootRef} className={`relative mx-auto aspect-square ${className}`} aria-hidden>
      <div
        data-enc-glow
        className="absolute inset-[12%] rounded-full bg-ice/30 opacity-0 blur-md"
      />
      <svg viewBox="0 0 120 120" className="relative h-full w-full overflow-visible">
        <circle
          data-enc-impact
          cx="60"
          cy="58"
          r="14"
          fill="#86e2fb"
          opacity="0"
        />
        <g data-enc-hand data-enc-hand-left opacity="0" style={{ transformOrigin: '42px 58px' }}>
          <rect x="18" y="48" width="28" height="22" rx="8" fill="#86e2fb" />
          <rect x="22" y="52" width="20" height="14" rx="5" fill="#45b1ce" />
          <path
            d="M46 52 L52 48 L54 56 L48 62 Z"
            fill="#ffffff"
            stroke="#e8e8e8"
            strokeWidth="1"
          />
        </g>
        <g data-enc-hand data-enc-hand-right opacity="0" style={{ transformOrigin: '78px 58px' }}>
          <rect x="74" y="48" width="28" height="22" rx="8" fill="#86e2fb" />
          <rect x="78" y="52" width="20" height="14" rx="5" fill="#45b1ce" />
          <path
            d="M74 52 L68 48 L66 56 L72 62 Z"
            fill="#ffffff"
            stroke="#e8e8e8"
            strokeWidth="1"
          />
        </g>
        <path
          data-enc-spark
          className="opacity-0"
          d="M60 34 L61.5 38 L66 38 L62.5 41 L64 45 L60 42 L56 45 L57.5 41 L54 38 L58.5 38 Z"
          fill="#ffffff"
        />
        <path
          data-enc-spark
          className="opacity-0"
          d="M44 44 L45 47 L48 47 L46 49 L47 52 L44 50 L41 52 L42 49 L40 47 L43 47 Z"
          fill="#58CC02"
        />
        <path
          data-enc-spark
          className="opacity-0"
          d="M76 44 L77 47 L80 47 L78 49 L79 52 L76 50 L73 52 L74 49 L72 47 L75 47 Z"
          fill="#A560E8"
        />
      </svg>
    </div>
  )
}

function MedalAnimation({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const scopeRef = useRef<ReturnType<typeof createScope> | null>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    scopeRef.current = createScope({ root }).add(() => {
      createTimeline({ defaults: { ease: 'out(3)' } })
        .add('[data-enc-ribbon]', {
          opacity: [0, 1],
          translateY: [-20, 0],
          duration: 500,
        })
        .add(
          '[data-enc-medal]',
          {
            opacity: [0, 1],
            scale: [0.3, 1],
            rotate: [-24, 0],
            duration: 700,
            ease: spring({ stiffness: 260, damping: 13 }),
          },
          '-=280',
        )
        .add(
          '[data-enc-medal-star]',
          {
            opacity: [0, 1],
            scale: [0, 1],
            duration: 350,
            ease: spring({ stiffness: 360, damping: 12 }),
          },
          '-=200',
        )
        .add(
          '[data-enc-medal-spark]',
          {
            opacity: [0, 1],
            scale: [0, 1],
            duration: 400,
            delay: stagger(80, { from: 'center' }),
          },
          '-=150',
        )

      animate('[data-enc-medal]', {
        rotate: [-4, 4],
        duration: 2200,
        ease: 'inOut(2)',
        alternate: true,
        loop: true,
        delay: 800,
      })
    })

    return () => {
      scopeRef.current?.revert()
      scopeRef.current = null
    }
  }, [])

  return (
    <div ref={rootRef} className={`relative mx-auto aspect-square ${className}`} aria-hidden>
      <div
        data-enc-glow
        className="absolute inset-[10%] rounded-full bg-gem/25 opacity-0 blur-md"
      />
      <svg viewBox="0 0 120 120" className="relative h-full w-full overflow-visible">
        <g data-enc-ribbon opacity="0">
          <path d="M48 28 L52 52 L60 46 L68 52 L72 28 Z" fill="#ad98f5" />
          <path d="M52 52 L56 88 L60 82 L64 88 L68 52 Z" fill="#dacfff" />
        </g>
        <g data-enc-medal opacity="0" style={{ transformOrigin: '60px 62px' }}>
          <circle cx="60" cy="62" r="22" fill="#ffcf33" />
          <circle cx="60" cy="62" r="18" fill="#ffb43f" />
          <circle cx="60" cy="62" r="14" fill="#ffffff" opacity="0.35" />
          <path
            data-enc-medal-star
            className="opacity-0"
            d="M60 52 L62 58 L68 58 L63 62 L65 68 L60 64 L55 68 L57 62 L52 58 L58 58 Z"
            fill="#5d308a"
          />
        </g>
        <path
          data-enc-medal-spark
          className="opacity-0"
          d="M34 50 L35 53 L38 53 L36 55 L37 58 L34 56 L31 58 L32 55 L30 53 L33 53 Z"
          fill="#ffffff"
        />
        <path
          data-enc-medal-spark
          className="opacity-0"
          d="M86 50 L87 53 L90 53 L88 55 L89 58 L86 56 L83 58 L84 55 L82 53 L85 53 Z"
          fill="#58CC02"
        />
      </svg>
    </div>
  )
}
