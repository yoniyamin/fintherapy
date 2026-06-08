import { encouragementAnimationMarkup, type EncouragementAnimation as AnimationKey } from '../../lib/classifyEncouragement'

interface Props {
  animation: AnimationKey
  className?: string
}

/**
 * Inline animated SVG for classify encouragement — reliable on mobile/PWA vs img src.
 */
export default function EncouragementAnimation({ animation, className = '' }: Props) {
  return (
    <div
      className={`pointer-events-none [&>svg]:h-full [&>svg]:w-full ${className}`}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: encouragementAnimationMarkup(animation) }}
    />
  )
}
