import { useEffect, useRef } from 'react'
import { animate, createScope, createTimeline, spring, stagger } from 'animejs'

interface Props {
  className?: string
}

/**
 * Deck-cleared trophy celebration driven by anime.js (prototype — not SMIL SVG assets).
 */
export default function DeckClearedAnimation({ className = '' }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const scopeRef = useRef<ReturnType<typeof createScope> | null>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    scopeRef.current = createScope({ root }).add(() => {
      const intro = createTimeline({ defaults: { ease: 'out(3)' } })

      intro
        .add('[data-deck-cleared-glow]', {
          opacity: [0, 0.55],
          scale: [0.4, 1.15, 1],
          duration: 700,
        })
        .add(
          '[data-deck-cleared-trophy]',
          {
            opacity: [0, 1],
            scale: [0.35, 1],
            duration: 850,
            ease: spring({ stiffness: 280, damping: 14 }),
          },
          '-=450',
        )
        .add(
          '[data-deck-cleared-star]',
          {
            opacity: [0, 1],
            scale: [0, 1],
            rotate: [-40, 0],
            duration: 500,
            delay: stagger(70, { from: 'center' }),
            ease: spring({ stiffness: 320, damping: 12 }),
          },
          '-=350',
        )

      animate('[data-deck-cleared-trophy]', {
        rotate: [-5, 5],
        duration: 2400,
        ease: 'inOut(2)',
        alternate: true,
        loop: true,
        delay: 900,
      })

      animate('[data-deck-cleared-star]', {
        opacity: [0.65, 1],
        scale: [0.85, 1.1],
        duration: 1400,
        ease: 'inOut(2)',
        alternate: true,
        loop: true,
        delay: stagger(180, { from: 'random' }),
      })
    })

    return () => {
      scopeRef.current?.revert()
      scopeRef.current = null
    }
  }, [])

  return (
    <div
      ref={rootRef}
      className={`relative mx-auto aspect-square ${className}`}
      aria-hidden
    >
      <div
        data-deck-cleared-glow
        className="absolute inset-[8%] rounded-full bg-duo-green/25 opacity-0 blur-md"
      />
      <svg viewBox="0 0 120 120" className="relative h-full w-full overflow-visible">
        <g data-deck-cleared-trophy className="origin-center opacity-0" style={{ transformOrigin: '60px 58px' }}>
          <rect
            data-deck-cleared-base
            x="41"
            y="88"
            width="38"
            height="9"
            rx="2.5"
            fill="#59586e"
          />
          <rect x="56" y="78" width="8" height="12" rx="1.5" fill="#59586e" />
          <path
            d="M38 52 C36 72 48 82 60 86 C72 82 84 72 82 52 L38 52 Z"
            fill="#ffb43f"
          />
          <path
            d="M42 54 C41 68 50 76 60 79 C70 76 79 68 78 54 Z"
            fill="#ff8645"
            opacity="0.45"
          />
          <path
            d="M38 54 L38 48 C38 38 46 32 60 32 C74 32 82 38 82 48 L82 54"
            fill="#ffc857"
          />
          <path
            d="M38 56 C28 58 24 66 28 74"
            stroke="#ffb43f"
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M82 56 C92 58 96 66 92 74"
            stroke="#ffb43f"
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M60 26 L63 34 L71 34 L65 39 L67 47 L60 42 L53 47 L55 39 L49 34 L57 34 Z"
            fill="#ffffff"
            opacity="0.95"
          />
        </g>
        <path
          data-deck-cleared-star
          className="opacity-0"
          d="M22 38 L24 44 L30 44 L25 48 L27 54 L22 50 L17 54 L19 48 L14 44 L20 44 Z"
          fill="#ffffff"
        />
        <path
          data-deck-cleared-star
          className="opacity-0"
          d="M98 42 L100 48 L106 48 L101 52 L103 58 L98 54 L93 58 L95 52 L90 48 L96 48 Z"
          fill="#ffffff"
        />
        <path
          data-deck-cleared-star
          className="opacity-0"
          d="M28 72 L29.5 76 L34 76 L30.5 79 L32 83 L28 80 L24 83 L25.5 79 L22 76 L26.5 76 Z"
          fill="#58CC02"
        />
        <path
          data-deck-cleared-star
          className="opacity-0"
          d="M92 68 L93.5 72 L98 72 L94.5 75 L96 79 L92 76 L88 79 L89.5 75 L86 72 L90.5 72 Z"
          fill="#A560E8"
        />
      </svg>
    </div>
  )
}
