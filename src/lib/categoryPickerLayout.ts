import type { CategoryDef } from './constants'

/** Global classify frequency — highest first (Western reading order, top-left anchor). */
export const CATEGORY_FREQUENCY_ORDER: readonly string[] = [
  'food_groceries',
  'dining',
  'transport',
  'streaming_subs',
  'leisure_vacation',
  'health',
  'home_maintenance',
  'connectivity',
  'clothing_footwear',
  'kids_toys',
  'school_extras',
  'miscellaneous',
  'own_transfers',
]

const MERCHANT_HEURISTICS: readonly { test: RegExp; categoryId: string }[] = [
  { test: /\b(grocery|groceries|supermarket|whole foods|trader joe|costco|walmart|aldi|lidl|tesco|sainsbury|kroger|safeway|market)\b/i, categoryId: 'food_groceries' },
  { test: /\b(restaurant|cafe|coffee|starbucks|mcdonald|burger|pizza|dining|bistro|grill|doordash|ubereats|deliveroo|takeaway)\b/i, categoryId: 'dining' },
  { test: /\b(gas|shell|bp|exxon|fuel|petrol|parking|uber|lyft|transit|metro|train|taxi|bolt)\b/i, categoryId: 'transport' },
  { test: /\b(netflix|disney|hulu|spotify|hbo|prime video|streaming|youtube premium|apple tv)\b/i, categoryId: 'streaming_subs' },
  { test: /\b(hotel|airbnb|airline|flight|travel|vacation|booking\.com|expedia)\b/i, categoryId: 'leisure_vacation' },
  { test: /\b(pharmacy|cvs|walgreens|doctor|hospital|clinic|dental|health)\b/i, categoryId: 'health' },
  { test: /\b(home depot|lowes|ikea|hardware|maintenance|plumber|electrician)\b/i, categoryId: 'home_maintenance' },
  { test: /\b(verizon|at&t|t-mobile|mobile|phone|internet|broadband|connectivity)\b/i, categoryId: 'connectivity' },
  { test: /\b(nike|zara|h&m|clothing|apparel|footwear|shoe)\b/i, categoryId: 'clothing_footwear' },
  { test: /\b(toy|toys|kids|child|daycare|nursery)\b/i, categoryId: 'kids_toys' },
  { test: /\b(school|tuition|college|university|fees|extras)\b/i, categoryId: 'school_extras' },
]

export interface CategoryPickerLayoutInput {
  categories: readonly CategoryDef[]
  predictedCategory?: string | null
  currentCategory?: string | null
  merchantRaw?: string | null
  merchantClean?: string | null
}

export interface CategoryPickerLayout {
  suggested: CategoryDef[]
  /** Remaining categories in one continuous frequency-sorted grid. */
  grid: CategoryDef[]
}

const SUGGESTED_SLOT_COUNT = 3

/** Returns a stable frequency rank for sorting (unknown ids sort last). */
function frequencyRank(categoryId: string): number {
  const idx = CATEGORY_FREQUENCY_ORDER.indexOf(categoryId)
  return idx === -1 ? CATEGORY_FREQUENCY_ORDER.length : idx
}

/** Sorts categories by global classify frequency. */
export function sortCategoriesByFrequency(categories: readonly CategoryDef[]): CategoryDef[] {
  return [...categories].sort((a, b) => frequencyRank(a.id) - frequencyRank(b.id))
}

/** Infers likely category ids from merchant text using lightweight keyword rules. */
export function inferCategoriesFromMerchant(
  merchantRaw?: string | null,
  merchantClean?: string | null,
): string[] {
  const haystack = [merchantClean, merchantRaw].filter(Boolean).join(' ')
  if (!haystack.trim()) return []

  const matches: string[] = []
  for (const rule of MERCHANT_HEURISTICS) {
    if (rule.test.test(haystack) && !matches.includes(rule.categoryId)) {
      matches.push(rule.categoryId)
    }
  }
  return matches
}

/** Resolves three suggested category ids — prediction first, then frequency fallbacks. */
export function resolveSuggestedCategoryIds(input: CategoryPickerLayoutInput): string[] {
  const available = new Set(input.categories.map((c) => c.id))
  const suggested: string[] = []

  const push = (id: string | null | undefined) => {
    if (!id || !available.has(id) || suggested.includes(id)) return
    suggested.push(id)
  }

  push(input.predictedCategory)
  push(input.currentCategory)

  for (const id of inferCategoriesFromMerchant(input.merchantRaw, input.merchantClean)) {
    push(id)
  }

  for (const id of CATEGORY_FREQUENCY_ORDER) {
    push(id)
    if (suggested.length >= SUGGESTED_SLOT_COUNT) break
  }

  if (suggested.length < SUGGESTED_SLOT_COUNT) {
    for (const cat of sortCategoriesByFrequency(input.categories)) {
      push(cat.id)
      if (suggested.length >= SUGGESTED_SLOT_COUNT) break
    }
  }

  return suggested.slice(0, SUGGESTED_SLOT_COUNT)
}

/** Builds a suggested row and one continuous frequency-sorted grid for the rest. */
export function buildCategoryPickerLayout(input: CategoryPickerLayoutInput): CategoryPickerLayout {
  const byId = new Map(input.categories.map((c) => [c.id, c]))
  const suggestedIds = resolveSuggestedCategoryIds(input)

  const suggested = suggestedIds
    .map((id) => byId.get(id))
    .filter((c): c is CategoryDef => !!c)

  const suggestedSet = new Set(suggestedIds)
  const grid = sortCategoriesByFrequency(input.categories.filter((c) => !suggestedSet.has(c.id)))

  return { suggested, grid }
}
