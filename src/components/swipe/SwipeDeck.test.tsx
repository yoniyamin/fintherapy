import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

const mockClassifyBatch = vi.fn().mockResolvedValue({ error: null, updatedCount: 2 })
const mockFlagBatch = vi.fn().mockResolvedValue({ error: null, updatedCount: 1 })
const mockMarkTransferBatch = vi.fn().mockResolvedValue({ error: null, updatedCount: 1 })
const mockRevertBatch = vi.fn().mockResolvedValue({ error: null, updatedCount: 1 })
const mockReclassifyBatch = vi.fn().mockResolvedValue({ error: null, updatedCount: 1 })
const mockAwardXp = vi.fn().mockResolvedValue({ error: null })
const mockGetMonthStats = vi.fn().mockResolvedValue({ total_count: 5, pending_count: 2, classified_count: 3, transfer_count: 0, offset_count: 0, flagged_count: 0 })
const mockRefetchFresh = vi.fn().mockResolvedValue({ pending: [], autoClassified: [] })
const mockApplyPendingPayload = vi.fn()
const mockDetectRefundsAndRefresh = vi.fn().mockResolvedValue({ offsetCount: 0, pending: [], autoClassified: [] })

const mockClassifySplit = vi.fn()
const mockRemoveTransactions = vi.fn()
const mockTransactions: Transaction[] = []

vi.mock('../../hooks/useTransactions', () => ({
  useTransactions: () => ({
    transactions: mockTransactions,
    autoClassified: [],
    loading: false,
    classifyTransactionsBatch: mockClassifyBatch,
    classifyTransactionsSplit: mockClassifySplit,
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
    applyPendingPayload: mockApplyPendingPayload,
    detectRefundsAndRefresh: mockDetectRefundsAndRefresh,
    removeTransactions: mockRemoveTransactions,
    addPendingTransactions: vi.fn(),
    detectRefunds: vi.fn().mockResolvedValue(0),
    getClassifiedCountsForAccount: vi.fn().mockResolvedValue([]),
    getTransactionsClassifiedInDateRange: vi.fn().mockResolvedValue({ txs: [], error: null }),
    getClassifiedTransactions: vi.fn().mockResolvedValue([]),
  }),
}))

vi.mock('../../hooks/useMerchantKnowledge', () => ({
  useMerchantKnowledge: () => ({
    confirmAutoClassified: vi.fn().mockResolvedValue({ error: null }),
    confirmAutoClassifiedBatch: vi.fn().mockResolvedValue({ error: null, updatedCount: 1 }),
    rejectAutoClassified: vi.fn().mockResolvedValue({ error: null }),
    learnMerchant: vi.fn(),
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

const mockStore = vi.hoisted(() => ({
  groups: [] as unknown[],
  activeGroup: null as unknown,
  transactions: [] as unknown[],
  sessionHistory: [] as unknown[],
  currentIndex: 0,
  completedCount: 0,
  classifiedTxCount: 0,
  flaggedCount: 0,
  transferCount: 0,
  sessionXpEarned: 0,
  showCategoryPicker: false,
  refreshDeck: vi.fn(),
  load: vi.fn(),
  advance: vi.fn(),
  recordPartialClassified: vi.fn(),
  addSessionXp: vi.fn(),
  flag: vi.fn(),
  markTransfer: vi.fn(),
  rotateCurrentToEnd: vi.fn(),
  openCategoryPicker: vi.fn(),
  closeCategoryPicker: vi.fn(),
  setNotesOnTransactions: vi.fn(),
  recordAction: vi.fn((a: object) => ({ ...a, id: 99, timestamp: 1 })),
  rollbackAction: vi.fn(),
  updateActionInHistory: vi.fn(),
}))

vi.mock('../../stores/classificationStore', () => {
  const hook = Object.assign(
    () => mockStore,
    { getState: () => mockStore, setState: vi.fn(), subscribe: vi.fn() },
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

function resetDeckState() {
  mockTransactions.splice(0, mockTransactions.length)
  mockStore.groups = []
  mockStore.activeGroup = null
  mockStore.sessionHistory = []
  mockClassifySplit.mockReset()
  mockRevertBatch.mockResolvedValue({ error: null, updatedCount: 2 })
}

describe('SwipeDeck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDeckState()
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

function seedDeckStack(txs: Transaction[], predictedCategory: string | null = null) {
  mockTransactions.splice(0, mockTransactions.length, ...txs)
  const group = {
    key: 'amazon\u00002026-06',
    merchantRaw: 'AMAZON',
    merchantClean: 'Amazon',
    predictedCategory,
    transactions: txs,
    totalAmount: txs.reduce((sum, t) => sum + Number(t.amount), 0),
    count: txs.length,
  }
  mockStore.groups = [group]
  mockStore.activeGroup = group
}

function makeSessionAction(overrides: Record<string, unknown> = {}) {
  const snapshots = [makeTx({ id: 'a' }), makeTx({ id: 'b' })]
  return {
    id: 5,
    kind: 'classified',
    category: null,
    merchantRaw: 'AMAZON',
    merchantClean: 'Amazon',
    txSnapshots: snapshots,
    totalAmount: -85,
    count: 2,
    xpEarned: 10,
    timestamp: Date.now(),
    ...overrides,
  }
}

const stackTxs = () => [
  makeTx({ id: 't1', amount: -10 }),
  makeTx({ id: 't2', amount: -20 }),
  makeTx({ id: 't3', amount: -30 }),
]

describe('SwipeDeck grouped transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDeckState()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    localStorage.clear()
    localStorage.setItem('classify_tutorial_dismissed', '1')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function openReviewModal() {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDeck()
    await user.click(await screen.findByRole('button', { name: /review/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Amazon' })
    return { user, dialog }
  }

  const rowSelects = (dialog: HTMLElement) =>
    within(dialog).getAllByRole('combobox', { name: /^Category for/ })

  describe('review modal on the deck card', () => {
    it('starts every row on the predicted category', async () => {
      // Arrange
      seedDeckStack(stackTxs(), 'food')

      // Act
      const { dialog } = await openReviewModal()

      // Assert
      expect(rowSelects(dialog).map((s) => (s as HTMLSelectElement).value)).toEqual(['food', 'food', 'food'])
    })

    it('saves a different category per transaction in one call and records a mixed action', async () => {
      // Arrange
      seedDeckStack(stackTxs(), null)
      mockClassifySplit.mockResolvedValue({ error: null, updatedIds: ['t1', 't2', 't3'] })
      const { user, dialog } = await openReviewModal()

      // Act
      await user.selectOptions(rowSelects(dialog)[0]!, 'food')
      await user.selectOptions(rowSelects(dialog)[1]!, 'food')
      await user.selectOptions(rowSelects(dialog)[2]!, 'transport')
      await user.click(within(dialog).getByRole('button', { name: 'Save 3 transactions' }))

      // Assert
      await waitFor(() => expect(mockClassifySplit).toHaveBeenCalledTimes(1))
      expect(mockClassifySplit).toHaveBeenCalledWith([
        { txId: 't1', category: 'food' },
        { txId: 't2', category: 'food' },
        { txId: 't3', category: 'transport' },
      ])
      expect(mockRemoveTransactions).toHaveBeenCalledWith(['t1', 't2', 't3'])
      expect(mockStore.advance).toHaveBeenCalledWith(3)
      expect(mockStore.recordAction).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'classified',
          category: null,
          count: 3,
          partial: false,
          txCategories: { t1: 'food', t2: 'food', t3: 'transport' },
        }),
      )
    })

    it('saves only the assigned rows and leaves the rest in the deck without completing the stack', async () => {
      // Arrange
      seedDeckStack(stackTxs(), null)
      mockClassifySplit.mockResolvedValue({ error: null, updatedIds: ['t1'] })
      const { user, dialog } = await openReviewModal()

      // Act
      await user.selectOptions(rowSelects(dialog)[0]!, 'food')
      await user.click(within(dialog).getByRole('button', { name: 'Save 1, leave 2 in deck' }))

      // Assert
      await waitFor(() => expect(mockClassifySplit).toHaveBeenCalledTimes(1))
      expect(mockClassifySplit).toHaveBeenCalledWith([{ txId: 't1', category: 'food' }])
      expect(mockRemoveTransactions).toHaveBeenCalledWith(['t1'])
      expect(mockStore.recordPartialClassified).toHaveBeenCalledWith(1)
      expect(mockStore.advance).not.toHaveBeenCalled()
      expect(mockStore.recordAction).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'food', count: 1, partial: true }),
      )
    })

    it('keeps what was saved and reports rows another member already classified instead of failing', async () => {
      // Arrange
      seedDeckStack(stackTxs(), 'food')
      mockClassifySplit.mockResolvedValue({ error: null, updatedIds: ['t1', 't3'] })
      const { user, dialog } = await openReviewModal()

      // Act
      await user.click(within(dialog).getByRole('button', { name: 'Save 3 transactions' }))

      // Assert
      expect(await screen.findByText(/1 transaction was already classified by someone else/)).toBeInTheDocument()
      expect(screen.queryByText(/Could not save/)).not.toBeInTheDocument()
      expect(mockRemoveTransactions).toHaveBeenCalledWith(['t1', 't3'])
      expect(mockStore.advance).toHaveBeenCalledWith(2)
      expect(mockRefetchFresh).toHaveBeenCalledWith({ silent: true })
      expect(mockStore.recordAction).toHaveBeenCalledWith(expect.objectContaining({ count: 2, category: 'food' }))
    })

    it('keeps the modal open and changes nothing when the save fails', async () => {
      // Arrange
      seedDeckStack(stackTxs(), 'food')
      mockClassifySplit.mockResolvedValue({ error: { message: 'boom' }, updatedIds: [] })
      const { user, dialog } = await openReviewModal()

      // Act
      await user.click(within(dialog).getByRole('button', { name: 'Save 3 transactions' }))

      // Assert
      expect(await screen.findByText(/Could not save — nothing was changed/)).toBeInTheDocument()
      expect(mockRemoveTransactions).not.toHaveBeenCalled()
      expect(mockStore.recordAction).not.toHaveBeenCalled()
      expect(screen.getByRole('dialog', { name: 'Amazon' })).toBeInTheDocument()
    })
  })

  describe('undoing a split', () => {
    async function openRecentAndClickBackToDeck(action: object) {
      mockTransactions.splice(0, mockTransactions.length, makeTx({ id: 'other', merchant_raw: 'OTHER' }))
      mockStore.groups = [{ key: 'other', merchantRaw: 'OTHER', merchantClean: null, predictedCategory: null, transactions: mockTransactions, totalAmount: -42.5, count: 1 }]
      mockStore.activeGroup = mockStore.groups[0]
      mockStore.sessionHistory = [action]
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderDeck()
      await user.click(await screen.findByRole('button', { name: /^Recent/ }))
      await user.click(await screen.findByRole('button', { name: 'Back to deck' }))
      return user
    }

    it('asks for confirmation before reverting a stack split across categories', async () => {
      // Arrange
      const action = makeSessionAction({ txCategories: { a: 'food', b: 'transport' } })

      // Act
      await openRecentAndClickBackToDeck(action)

      // Assert
      const dialog = await screen.findByRole('alertdialog', { name: 'Undo split classification?' })
      expect(dialog).toHaveTextContent('split across 2 categories')
      expect(dialog).toHaveTextContent('all 2 transactions')
      expect(mockRevertBatch).not.toHaveBeenCalled()
    })

    it('keeps the split when the user cancels', async () => {
      // Arrange
      const user = await openRecentAndClickBackToDeck(
        makeSessionAction({ txCategories: { a: 'food', b: 'transport' } }),
      )

      // Act
      await user.click(await screen.findByRole('button', { name: 'Keep split' }))

      // Assert
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(mockRevertBatch).not.toHaveBeenCalled()
    })

    it('reverts every transaction once the user confirms', async () => {
      // Arrange
      const user = await openRecentAndClickBackToDeck(
        makeSessionAction({ txCategories: { a: 'food', b: 'transport' } }),
      )

      // Act
      await user.click(await screen.findByRole('button', { name: 'Undo and send back' }))

      // Assert
      await waitFor(() => expect(mockRevertBatch).toHaveBeenCalledWith(['a', 'b']))
    })

    it('reverts a single-category stack immediately without a confirmation', async () => {
      // Arrange & Act
      await openRecentAndClickBackToDeck(makeSessionAction({ category: 'food' }))

      // Assert
      await waitFor(() => expect(mockRevertBatch).toHaveBeenCalledWith(['a', 'b']))
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })
})
