/** Internal transfers between your own accounts (excluded from spending pie by default). */
export const OWN_TRANSFERS_CATEGORY_ID = 'own_transfers' as const

export const CATEGORIES = [
  { id: 'food_groceries', label: 'Food & Groceries', icon: '🛒', color: 'bg-green-500/20 border-green-500/40' },
  { id: 'transport', label: 'Transport', icon: '🚗', color: 'bg-blue-500/20 border-blue-500/40' },
  { id: 'streaming_subs', label: 'Streaming', icon: '📺', color: 'bg-purple-500/20 border-purple-500/40' },
  { id: 'dining', label: 'Dining', icon: '🍽️', color: 'bg-orange-500/20 border-orange-500/40' },
  { id: 'leisure_vacation', label: 'Leisure', icon: '🏖️', color: 'bg-cyan-500/20 border-cyan-500/40' },
  { id: 'health', label: 'Health', icon: '💊', color: 'bg-red-500/20 border-red-500/40' },
  { id: 'connectivity', label: 'Connectivity', icon: '📡', color: 'bg-indigo-500/20 border-indigo-500/40' },
  { id: 'clothing_footwear', label: 'Clothing', icon: '👟', color: 'bg-pink-500/20 border-pink-500/40' },
  { id: 'kids_toys', label: 'Kids & Toys', icon: '🧸', color: 'bg-yellow-500/20 border-yellow-500/40' },
  { id: 'home_maintenance', label: 'Home', icon: '🏠', color: 'bg-amber-500/20 border-amber-500/40' },
  { id: 'miscellaneous', label: 'Misc', icon: '📦', color: 'bg-slate-500/20 border-slate-500/40' },
  { id: 'own_transfers', label: 'Own transfers', icon: '🔁', color: 'bg-slate-600/25 border-slate-500/35' },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

export const XP_VALUES = {
  CLASSIFY_MANUAL: 10,
  CLASSIFY_EASY: 5,
  STREAK_MULTIPLIER: 1.5,
  FIRST_STRIKE_PER_AUTO: 2,
} as const

export const SWIPE_THRESHOLD = 100
