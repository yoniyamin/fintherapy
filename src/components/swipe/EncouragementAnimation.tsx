import { encouragementAnimationMarkup, type EncouragementAnimation as AnimationKey } from '../../lib/classifyEncouragement'
import EncouragementAnimeAnimation from './EncouragementAnimeAnimation'

interface Props {
  animation: AnimationKey
  className?: string
}

/**
 * Classify encouragement visual — star uses inline SMIL; others use anime.js.
 */
export default function EncouragementAnimation({ animation, className = '' }: Props) {
  if (animation === 'star') {
    return (
      <div
        className={`pointer-events-none [&>svg]:h-full [&>svg]:w-full ${className}`}
        aria-hidden
        dangerouslySetInnerHTML={{ __html: encouragementAnimationMarkup() }}
      />
    )
  }

  return <EncouragementAnimeAnimation variant={animation} className={className} />
}
