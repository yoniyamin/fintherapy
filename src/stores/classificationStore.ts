import { create } from 'zustand'
import type { Transaction } from '../types/database'

export interface MerchantGroup {
  key: string
  merchantRaw: string
  merchantClean: string | null
  transactions: Transaction[]
  totalAmount: number
  count: number
}

interface ClassificationState {
  groups: MerchantGroup[]
  currentIndex: number
  completedCount: number
  classifiedTxCount: number
  flaggedCount: number
  transferCount: number
  showCategoryPicker: boolean
  activeGroup: MerchantGroup | null

  load: (txns: Transaction[]) => void
  advance: (txCount: number) => void
  flag: () => void
  markTransfer: () => void
  openCategoryPicker: () => void
  closeCategoryPicker: () => void
  reset: () => void

  /** @deprecated kept for compatibility */
  transactions: Transaction[]
  activeTransaction: Transaction | null
}

function groupByMerchant(txns: Transaction[]): MerchantGroup[] {
  const map = new Map<string, Transaction[]>()
  for (const tx of txns) {
    const key = tx.merchant_raw.toLowerCase().trim()
    const existing = map.get(key)
    if (existing) existing.push(tx)
    else map.set(key, [tx])
  }
  return Array.from(map.entries()).map(([key, transactions]) => ({
    key,
    merchantRaw: transactions[0].merchant_raw,
    merchantClean: transactions[0].merchant_clean,
    transactions,
    totalAmount: transactions.reduce((sum, t) => sum + Number(t.amount), 0),
    count: transactions.length,
  }))
}

export const useClassificationStore = create<ClassificationState>((set, get) => ({
  groups: [],
  currentIndex: 0,
  completedCount: 0,
  classifiedTxCount: 0,
  flaggedCount: 0,
  transferCount: 0,
  showCategoryPicker: false,
  activeGroup: null,

  transactions: [],
  activeTransaction: null,

  load: (txns) => {
    const groups = groupByMerchant(txns)
    set({
      groups,
      transactions: txns,
      currentIndex: 0,
      completedCount: 0,
      classifiedTxCount: 0,
      flaggedCount: 0,
      transferCount: 0,
      showCategoryPicker: false,
      activeGroup: groups[0] ?? null,
      activeTransaction: groups[0]?.transactions[0] ?? null,
    })
  },

  advance: (txCount: number) => {
    const { groups, currentIndex, completedCount, classifiedTxCount } = get()
    const nextIndex = currentIndex + 1
    set({
      currentIndex: nextIndex,
      completedCount: completedCount + 1,
      classifiedTxCount: classifiedTxCount + txCount,
      showCategoryPicker: false,
      activeGroup: groups[nextIndex] ?? null,
      activeTransaction: groups[nextIndex]?.transactions[0] ?? null,
    })
  },

  flag: () => {
    const { groups, currentIndex, flaggedCount } = get()
    const nextIndex = currentIndex + 1
    set({
      currentIndex: nextIndex,
      flaggedCount: flaggedCount + 1,
      showCategoryPicker: false,
      activeGroup: groups[nextIndex] ?? null,
      activeTransaction: groups[nextIndex]?.transactions[0] ?? null,
    })
  },

  markTransfer: () => {
    const { groups, currentIndex, transferCount } = get()
    const nextIndex = currentIndex + 1
    set({
      currentIndex: nextIndex,
      transferCount: transferCount + 1,
      showCategoryPicker: false,
      activeGroup: groups[nextIndex] ?? null,
      activeTransaction: groups[nextIndex]?.transactions[0] ?? null,
    })
  },

  openCategoryPicker: () => set({ showCategoryPicker: true }),
  closeCategoryPicker: () => set({ showCategoryPicker: false }),

  reset: () =>
    set({
      groups: [],
      transactions: [],
      currentIndex: 0,
      completedCount: 0,
      classifiedTxCount: 0,
      flaggedCount: 0,
      transferCount: 0,
      showCategoryPicker: false,
      activeGroup: null,
      activeTransaction: null,
    }),
}))
