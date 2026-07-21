import { DEFAULT_CATEGORIES } from './constants'
import { fluentEmojiKey, isFluentEmojiToken, resolveFluentEmojiUrl } from './fluentAnimatedEmojis'
import leisureIcon from '../assets/Categories/doodle-color-157-sun-lounger-hover-shift.gif'
import healthIcon from '../assets/Categories/wired-flat-1277-antibacterial-spray-disinfection-hover-pinch.gif'
import diningIcon from '../assets/Categories/wired-flat-13-pizza-hover-rotate.gif'
import kidsToysIcon from '../assets/Categories/wired-flat-1534-paper-boat-in-reveal.gif'
import schoolExtrasIcon from '../assets/Categories/wired-flat-486-school-hover-pinch.gif'
import streamingIcon from '../assets/Categories/wired-flat-1736-smart-tv-layout-interface-hover-pinch.gif'
import clothingIcon from '../assets/Categories/wired-flat-1788-kimono-hover-pinch.gif'
import foodGroceriesIcon from '../assets/Categories/wired-flat-526-paper-bag-vegetables-hover-pinch.gif'
import homeIcon from '../assets/Categories/wired-flat-63-home-hover-3d-roll.gif'
import connectivityIcon from '../assets/Categories/wired-flat-726-wireless-connection-hover-pinch.gif'
import transportIcon from '../assets/Categories/wired-flat-860-electric-car-hover-pinch.gif'
import miscIcon from '../assets/Categories/wired-flat-943-commodity-hover-pinch.gif'
import ownTransfersIcon from '../assets/Categories/wired-flat-945-dividends-hover-pinch.gif'

export const GIF_ICON_PREFIX = 'gif:'

/** Animated GIF icons keyed by category id. */
export const CATEGORY_ICON_ASSETS: Partial<Record<string, string>> = {
  clothing_footwear: clothingIcon,
  connectivity: connectivityIcon,
  dining: diningIcon,
  food_groceries: foodGroceriesIcon,
  health: healthIcon,
  home_maintenance: homeIcon,
  kids_toys: kidsToysIcon,
  leisure_vacation: leisureIcon,
  miscellaneous: miscIcon,
  own_transfers: ownTransfersIcon,
  school_extras: schoolExtrasIcon,
  streaming_subs: streamingIcon,
  transport: transportIcon,
}

export interface CategoryGifOption {
  key: string
  src: string
  label: string
}

const defaultLabelById = Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.id, c.label]))

/** Selectable animated icons for the category editor. */
export const CATEGORY_GIF_OPTIONS: CategoryGifOption[] = Object.entries(CATEGORY_ICON_ASSETS)
  .map(([key, src]) => ({
    key,
    src: src!,
    label: defaultLabelById[key] ?? key,
  }))
  .sort((a, b) => a.label.localeCompare(b.label))

/** Returns true when a category id has a bundled animated GIF icon. */
export function categoryHasBuiltInIcon(categoryId: string): boolean {
  return categoryId in CATEGORY_ICON_ASSETS
}

/** Returns true when the stored icon value references a GIF asset. */
export function isGifIconToken(icon: string): boolean {
  return icon.startsWith(GIF_ICON_PREFIX)
}

/** Extracts the GIF asset key from a stored icon token. */
export function gifIconKey(icon: string): string | null {
  if (!isGifIconToken(icon)) return null
  const key = icon.slice(GIF_ICON_PREFIX.length)
  return key.length > 0 ? key : null
}

/** Builds the persisted icon token for a GIF asset key. */
export function toGifIconToken(assetKey: string): string {
  return `${GIF_ICON_PREFIX}${assetKey}`
}

/** Resolves the icon URL for a category, checking fluent: tokens, gif: tokens, then built-in assets. */
export function resolveCategoryIconSrc(categoryId: string, icon: string): string | undefined {
  const fKey = fluentEmojiKey(icon)
  if (fKey) return resolveFluentEmojiUrl(fKey)

  const tokenKey = gifIconKey(icon)
  if (tokenKey && CATEGORY_ICON_ASSETS[tokenKey]) {
    return CATEGORY_ICON_ASSETS[tokenKey]
  }
  return CATEGORY_ICON_ASSETS[categoryId]
}

export { isFluentEmojiToken }
