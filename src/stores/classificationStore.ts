import { create } from 'zustand'
import type { Transaction } from '../types/database'

export interface MerchantGroup {
  key: string
  merchantRaw: string
  merchantClean: string | null
  /** Set when every tx in the group was auto-classified to the same category. Null otherwise. */
  predictedCategory: string | null
  transactions: Transaction[]
  totalAmount: number
  count: number
}

export type SessionActionKind = 'classified' | 'auto-confirmed' | 'flagged' | 'transfer'

/** A user action taken during this classify session. Used by the Undo toast
 *  and the Recent panel to re-classify or revert mistakes. */
export interface SessionAction {
  id: number
  kind: SessionActionKind
  /** Category id at time of action; null for flagged. 'own_transfers' for transfer. */
  category: string | null
  merchantRaw: string
  merchantClean: string | null
  /** Pristine snapshots (status='pending', category=null) — used to re-inject the group when reverting. */
  txSnapshots: Transaction[]
  totalAmount: number
  count: number
  timestamp: number
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

  sessionHistory: SessionAction[]

  load: (txns: Transaction[]) => void
  /** Rebuild groups from updated txns without resetting session counters. */
  refreshDeck: (txns: Transaction[]) => void
  advance: (txCount: number) => void
  flag: () => void
  /** Move current group to end of queue (e.g. skip in No idea deck). */
  rotateCurrentToEnd: () => void
  markTransfer: () => void
  openCategoryPicker: () => void
  closeCategoryPicker: () => void
  reset: () => void
  /** Apply the same note to all listed transaction ids (local state after RPC save). */
  setNotesOnTransactions: (txIds: string[], note: string | null) => void

  /** Record an action so it shows up in Undo / Recent UIs. Returns the recorded action. */
  recordAction: (a: Omit<SessionAction, 'id' | 'timestamp'>) => SessionAction
  /** Remove an action from history and roll back the corresponding counter (used on revert-to-pending). */
  rollbackAction: (actionId: number) => void
  /** Replace an action's kind/category in history (used when reclassifying / marking transfer from Recent). */
  updateActionInHistory: (actionId: number, kind: SessionActionKind, category: string | null) => void

  /** @deprecated kept for compatibility */
  transactions: Transaction[]
  activeTransaction: Transaction | null
}

/** Buckets pending/auto deck rows: same merchant text may repeat across billing_month — never stack across months. */
function classifyStackKey(tx: Transaction): string {
  const merchant = tx.merchant_raw.toLowerCase().trim()
  const bm = tx.billing_month?.trim() ?? ''
  return `${merchant}\u0000${bm}`
}

function groupByMerchant(txns: Transaction[]): MerchantGroup[] {
  const map = new Map<string, Transaction[]>()
  for (const tx of txns) {
    const key = classifyStackKey(tx)
    const existing = map.get(key)
    if (existing) existing.push(tx)
    else map.set(key, [tx])
  }
  return Array.from(map.entries()).map(([key, transactions]) => {
    // A group counts as "predicted" only when every tx is status='auto' AND they all
    // resolved to the same category. Mixed pending/auto stays unpredicted (safer to ask).
    const allAuto = transactions.every((t) => t.status === 'auto' && t.category)
    const autoCats = new Set(transactions.map((t) => t.category).filter(Boolean) as string[])
    const predictedCategory = allAuto && autoCats.size === 1 ? [...autoCats][0]! : null
    return {
      key,
      merchantRaw: transactions[0].merchant_raw,
      merchantClean: transactions[0].merchant_clean,
      predictedCategory,
      transactions,
      totalAmount: transactions.reduce((sum, t) => sum + Number(t.amount), 0),
      count: transactions.length,
    }
  })
}

let nextActionId = 1

export const useClassificationStore = create<ClassificationState>((set, get) => ({
  groups: [],
  currentIndex: 0,
  completedCount: 0,
  classifiedTxCount: 0,
  flaggedCount: 0,
  transferCount: 0,
  showCategoryPicker: false,
  activeGroup: null,

  sessionHistory: [],

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
      sessionHistory: [],
    })
  },

  refreshDeck: (txns) => {
    const groups = groupByMerchant(txns)
    set({
      groups,
      transactions: txns,
      currentIndex: 0,
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

  rotateCurrentToEnd: () => {
    const { groups, currentIndex } = get()
    if (groups.length <= 1) return
    const cur = groups[currentIndex]
    const others = groups.filter((_, i) => i !== currentIndex)
    const nextGroups = [...others, cur]
    set({
      groups: nextGroups,
      currentIndex: 0,
      showCategoryPicker: false,
      activeGroup: nextGroups[0] ?? null,
      activeTransaction: nextGroups[0]?.transactions[0] ?? null,
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

  setNotesOnTransactions: (txIds, note) => {
    const idSet = new Set(txIds)
    set((state) => {
      const patchTx = (t: Transaction) =>
        idSet.has(t.id) ? { ...t, user_note: note } : t
      const nextGroups = state.groups.map((g) => ({
        ...g,
        transactions: g.transactions.map(patchTx),
      }))
      const cur = nextGroups[state.currentIndex] ?? null
      return {
        groups: nextGroups,
        transactions: state.transactions.map(patchTx),
        activeGroup: cur,
        activeTransaction: cur?.transactions[0] ?? null,
      }
    })
  },

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
      sessionHistory: [],
    }),

  recordAction: (a) => {
    const action: SessionAction = {
      ...a,
      id: nextActionId++,
      timestamp: Date.now(),
    }
    set((state) => ({ sessionHistory: [...state.sessionHistory, action] }))
    return action
  },

  rollbackAction: (actionId) => {
    set((state) => {
      const target = state.sessionHistory.find((h) => h.id === actionId)
      if (!target) return state
      const nextHistory = state.sessionHistory.filter((h) => h.id !== actionId)
      const patch: Partial<ClassificationState> = { sessionHistory: nextHistory }
      switch (target.kind) {
        case 'classified':
        case 'auto-confirmed':
          patch.completedCount = Math.max(0, state.completedCount - 1)
          patch.classifiedTxCount = Math.max(0, state.classifiedTxCount - target.count)
          break
        case 'flagged':
          patch.flaggedCount = Math.max(0, state.flaggedCount - 1)
          break
        case 'transfer':
          patch.transferCount = Math.max(0, state.transferCount - 1)
          break
      }
      return patch as ClassificationState
    })
  },

  updateActionInHistory: (actionId, kind, category) => {
    set((state) => ({
      sessionHistory: state.sessionHistory.map((h) =>
        h.id === actionId ? { ...h, kind, category, timestamp: Date.now() } : h,
      ),
    }))
  },
}))
