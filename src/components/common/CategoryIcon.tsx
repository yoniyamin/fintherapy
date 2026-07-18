import { isGifIconToken, resolveCategoryIconSrc } from '../../lib/categoryIconAssets'

type CategoryIconSize = 'sm' | 'md' | 'lg' | 'xl'

const SIZE_CLASS: Record<CategoryIconSize, string> = {
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-8 w-8',
  xl: 'h-10 w-10',
}

const EMOJI_CLASS: Record<CategoryIconSize, string> = {
  sm: 'text-sm',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
}

interface CategoryIconProps {
  categoryId: string
  emoji: string
  size?: CategoryIconSize
  className?: string
}

/** Renders a category GIF asset when available, otherwise the emoji fallback. */
export default function CategoryIcon({
  categoryId,
  emoji,
  size = 'md',
  className = '',
}: CategoryIconProps) {
  const src = resolveCategoryIconSrc(categoryId, emoji)

  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden
        className={`${SIZE_CLASS[size]} shrink-0 object-contain ${className}`}
      />
    )
  }

  const displayEmoji = isGifIconToken(emoji) ? '📦' : emoji

  return (
    <span className={`leading-none ${EMOJI_CLASS[size]} ${className}`} aria-hidden>
      {displayEmoji}
    </span>
  )
}
