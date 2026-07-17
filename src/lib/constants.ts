/** Internal transfers between your own accounts (excluded from spending pie by default). */
export const OWN_TRANSFERS_CATEGORY_ID = 'own_transfers' as const

export type ExpenseType = 'fixed' | 'discretionary'

export const DEFAULT_CATEGORIES = [
  { id: 'food_groceries', label: 'Food & Groceries', icon: '🛒', color: 'bg-green-500/20 border-green-500/40', expenseType: 'discretionary' as ExpenseType },
  { id: 'transport', label: 'Transport', icon: '🚗', color: 'bg-blue-500/20 border-blue-500/40', expenseType: 'discretionary' as ExpenseType },
  { id: 'streaming_subs', label: 'Streaming', icon: '📺', color: 'bg-purple-500/20 border-purple-500/40', expenseType: 'fixed' as ExpenseType },
  { id: 'dining', label: 'Dining', icon: '🍽️', color: 'bg-orange-500/20 border-orange-500/40', expenseType: 'discretionary' as ExpenseType },
  { id: 'leisure_vacation', label: 'Leisure', icon: '🏖️', color: 'bg-cyan-500/20 border-cyan-500/40', expenseType: 'discretionary' as ExpenseType },
  { id: 'health', label: 'Health', icon: '💊', color: 'bg-red-500/20 border-red-500/40', expenseType: 'fixed' as ExpenseType },
  { id: 'connectivity', label: 'Connectivity', icon: '📡', color: 'bg-indigo-500/20 border-indigo-500/40', expenseType: 'fixed' as ExpenseType },
  { id: 'clothing_footwear', label: 'Clothing', icon: '👟', color: 'bg-pink-500/20 border-pink-500/40', expenseType: 'discretionary' as ExpenseType },
  { id: 'kids_toys', label: 'Kids & Toys', icon: '🧸', color: 'bg-yellow-500/20 border-yellow-500/40', expenseType: 'fixed' as ExpenseType },
  { id: 'home_maintenance', label: 'Home', icon: '🏠', color: 'bg-amber-500/20 border-amber-500/40', expenseType: 'fixed' as ExpenseType },
  { id: 'miscellaneous', label: 'Misc', icon: '📦', color: 'bg-slate-500/20 border-slate-500/40', expenseType: 'discretionary' as ExpenseType },
  { id: 'own_transfers', label: 'Own transfers', icon: '🔁', color: 'bg-slate-600/25 border-slate-500/35', expenseType: 'fixed' as ExpenseType },
] as const

export type CategoryId = (typeof DEFAULT_CATEGORIES)[number]['id']

export interface CategoryDef {
  id: string
  label: string
  icon: string
  color: string
  expenseType: ExpenseType
}

/** Tile-colour palette users can pick from in the category editor. */
export const COLOR_PALETTE: { label: string; value: string }[] = [
  { label: 'Green',   value: 'bg-green-500/20 border-green-500/40' },
  { label: 'Blue',    value: 'bg-blue-500/20 border-blue-500/40' },
  { label: 'Purple',  value: 'bg-purple-500/20 border-purple-500/40' },
  { label: 'Orange',  value: 'bg-orange-500/20 border-orange-500/40' },
  { label: 'Cyan',    value: 'bg-cyan-500/20 border-cyan-500/40' },
  { label: 'Red',     value: 'bg-red-500/20 border-red-500/40' },
  { label: 'Indigo',  value: 'bg-indigo-500/20 border-indigo-500/40' },
  { label: 'Pink',    value: 'bg-pink-500/20 border-pink-500/40' },
  { label: 'Yellow',  value: 'bg-yellow-500/20 border-yellow-500/40' },
  { label: 'Amber',   value: 'bg-amber-500/20 border-amber-500/40' },
  { label: 'Slate',   value: 'bg-slate-500/20 border-slate-500/40' },
  { label: 'Teal',    value: 'bg-teal-500/20 border-teal-500/40' },
  { label: 'Rose',    value: 'bg-rose-500/20 border-rose-500/40' },
  { label: 'Emerald', value: 'bg-emerald-500/20 border-emerald-500/40' },
  { label: 'Violet',  value: 'bg-violet-500/20 border-violet-500/40' },
  { label: 'Lime',    value: 'bg-lime-500/20 border-lime-500/40' },
]

export const XP_VALUES = {
  CLASSIFY_MANUAL: 10,
  CLASSIFY_EASY: 5,
} as const

export const SWIPE_THRESHOLD = 100
