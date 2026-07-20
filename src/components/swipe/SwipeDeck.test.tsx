import { render, screen, waitFor } from '@testing-library/react'
import SwipeDeck from './SwipeDeck'
import { MockAuthProvider } from '../../test/mock-auth'
import { MockRouter } from '../../test/mock-router'
import type { Profile, Transaction } from '../../types/database'

const TEST_HOUSEHOLD_ID = 'hh-swipe-1'
const TEST_USER_ID = 'user-1'

const mockProfile: Profile = {
  id: TEST_USER_ID,
  display_name: 'Swiper',
  household_id: TEST_HOUSEHOLD_ID,
  total_xp: 50,
  created_at: '2026-01-01',
}

const mockCategories = [
  { id: 'food', label: 'Food', icon: '🛒', color: 'bg-green-500/20 border-green-500/40', expenseType: 'discretionary' as const },
  { id: 'transport', label: 'Transport', icon: '🚗', color: 'bg-blue-500/20 border-blue-500/40', expenseType: 'discretionary' as const },
  { id: 'own_transfers', label: 'Own transfers', icon: '🔁', color: 'bg-slate-600/25 border-slate-500/35', expenseType: 'fixed' as const },
]

const makeTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: crypto.randomUUID(),
  household_id: TEST_HOUSEHOLD_ID,
  merchant_raw: 'SUPERMARKET XYZ',
  merchant_clean: 'Supermarket',
  amount: -42.5,
  tx_date: '2026-06-15',
  billing_month: '2026-06',
  status: 'pending',
  category: null,
  classified_by: null,
  classified_at: null,
  uploaded_by: TEST_USER_ID,
  uploaded_at: '2026-06-15T10:00:00Z',
  batch_id: 'batch-1',
  account_last4: '1234',
  account_type: null,
  is_refund: false,
  refund_pair_id: null,
  notes: null,
  transfer_kind: null,
  ...overrides,
})

const mockClassifyBatch = vi.fn().mockResolvedValue({ error: null })
const mockFlagBatch = vi.fn().mockResolvedValue({ error: null })
const mockMarkTransferBatch = vi.fn().mockResolvedValue({ error: null })
const mockRevertBatch = vi.fn().mockResolvedValue({ error: null })
const mockReclassifyBatch = vi.fn().mockResolvedValue({ error: null })
const mockAwardXp = vi.fn().mockResolvedValue({ error: null })
const mockGetMonthStats = vi.fn().mockResolvedValue({ total_count: 5, pending_count: 2, classified_count: 3, transfer_count: 0, offset_count: 0, flagged_count: 0 })
const mockRefetchFresh = vi.fn()

vi.mock('../../hooks/useTransactions', () => ({
  useTransactions: () => ({
    transactions: [makeTx(), makeTx({ merchant_raw: 'GAS STATION', merchant_clean: 'Gas Station', amount: -30 })],
    autoClassified: [],
    loading: false,
    classifyTransactionsBatch: mockClassifyBatch,
    flagTransactionsBatch: mockFlagBatch,
    markTransferBatch: mockMarkTransferBatch,
    revertToPendingBatch: mockRevertBatch,
    reclassifyTransactionsBatch: mockReclassifyBatch,
    awardXp: mockAwardXp,
    getMonthStats: mockGetMonthStats,
    getExportData: vi.fn().mockResolvedValue([]),
    getAccountAliases: vi.fn().mockResolvedValue([]),
    getDistinctAccountLast4ForHousehold: vi.fn().mockResolvedValue(['1234']),
    upsertAccountAlias: vi.fn().mockResolvedValue(undefined),
    setTransactionsUserNote: vi.fn().mockResolvedValue(undefined),
    refetchFresh: mockRefetchFresh,
    getClassifiedTransactions: vi.fn().mockResolvedValue([]),
  }),
}))

vi.mock('../../hooks/useMerchantKnowledge', () => ({
  useMerchantKnowledge: () => ({
    confirmAutoClassified: vi.fn().mockResolvedValue({ error: null }),
    confirmAutoClassifiedBatch: vi.fn().mockResolvedValue({ error: null }),
    rejectAutoClassified: vi.fn().mockResolvedValue({ error: null }),
  }),
}))

vi.mock('../../hooks/usePresence', () => ({
  usePresence: () => ({ onlineUsers: [], untrack: vi.fn() }),
}))

vi.mock('../../hooks/useFlaggedCount', () => ({
  useFlaggedCount: () => 0,
}))

vi.mock('../../hooks/useFlaggedSuggestions', () => ({
  useFlaggedSuggestions: () => ({ suggestions: [], suggestionCount: 0, loading: false, removeSuggestion: vi.fn() }),
}))

vi.mock('../../hooks/useCategoryConfig', () => ({
  useCategoryConfig: () => ({ categories: mockCategories, loading: false }),
}))

vi.mock('../../hooks/useClassifyEncouragement', () => ({
  useClassifyEncouragement: () => ({
    onClassifySuccess: vi.fn(),
    encouragementBurst: null,
    dismissBurst: vi.fn(),
  }),
}))

vi.mock('../../lib/flaggedCountInvalidate', () => ({
  invalidateFlaggedCount: vi.fn(),
}))

vi.mock('../../stores/classificationStore', () => {
  const state = {
    groups: [],
    transactions: [],
    sessionHistory: [],
    sessionXpEarned: 0,
    pickerOpen: false,
    refreshDeck: vi.fn(),
    openCategoryPicker: vi.fn(),
    closeCategoryPicker: vi.fn(),
    recordAction: vi.fn(),
    rollbackAction: vi.fn(),
    clearSession: vi.fn(),
    load: vi.fn(),
  }
  const hook = Object.assign(
    () => state,
    { getState: () => state, setState: vi.fn(), subscribe: vi.fn() },
  )
  return { useClassificationStore: hook }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    }),
  },
}))

function renderDeck(route = '/classify') {
  return render(
    <MockRouter initialEntries={[route]}>
      <MockAuthProvider value={{
        profile: mockProfile,
        user: { id: TEST_USER_ID } as never,
      }}>
        <SwipeDeck />
      </MockAuthProvider>
    </MockRouter>,
  )
}

describe('SwipeDeck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows classify tutorial when deck is empty', async () => {
    // Arrange & Act
    renderDeck()

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/how classification works/i)).toBeInTheDocument()
    })
  })

  it('shows swipe gesture instructions in tutorial', async () => {
    // Arrange & Act
    renderDeck()

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/pick a spending category/i)).toBeInTheDocument()
    })
  })

  it('renders the component without crashing', () => {
    // Arrange & Act & Assert
    expect(() => renderDeck()).not.toThrow()
  })

  it('renders in no-idea mode without crashing', () => {
    // Arrange & Act & Assert
    expect(() => renderDeck('/classify/no-idea')).not.toThrow()
  })
})
