import type { CategoryDef } from '../../lib/constants'

export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function formatMonthLabel(value: string): string {
  const [year, month] = value.split('-')
  const date = new Date(Number(year), Number(month) - 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    options.push({ value, label: formatMonthLabel(value) })
  }
  return options
}

/**
 * Deterministic pseudo-random shuffle seeded by a string.
 * All household members get the same result for the same seed.
 */
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  }
  const next = () => {
    h = (h * 1664525 + 1013904223) | 0
    return (h >>> 0) / 4294967296
  }
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export const BET_CATEGORY_COUNT = 4

export function pickBetCategories(
  categories: CategoryDef[],
  householdId: string,
  month: string,
): CategoryDef[] {
  const seed = `${householdId}:${month}`
  const shuffled = seededShuffle(categories, seed)
  return shuffled.slice(0, BET_CATEGORY_COUNT)
}

export function fireConfetti() {
  import('canvas-confetti').then(({ default: confetti }) => {
    const duration = 1500
    const end = Date.now() + duration

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#58cc02', '#1cb0f6', '#ff9600', '#ff4b4b', '#ce82ff'],
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#58cc02', '#1cb0f6', '#ff9600', '#ff4b4b', '#ce82ff'],
      })
      if (Date.now() < end) requestAnimationFrame(frame)
    }

    confetti({
      particleCount: 80,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#58cc02', '#1cb0f6', '#ff9600', '#ff4b4b', '#ce82ff'],
    })
    frame()
  })
}
