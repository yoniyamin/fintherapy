import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MotionGlobalConfig } from 'framer-motion'
import type { ComponentProps } from 'react'
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
const mockFetchPending = vi.fn()
const mockLoadState = { error: null as Error | null }
const mockConfirmAutoBatch = vi.fn().mockResolvedValue({ error: null, updatedCount: 1 })
const mockRejectAuto = vi.fn().mockResolvedValue({ error: null })
const mockTransactions: Transaction[] = []
const mockGetAccountAliases = vi.fn().mockResolvedValue([])
const mockGetDistinctLast4 = vi.fn().mockResolvedValue(['1234'])
vi.mock('../../hooks/useTransactions', () => ({
  useTransactions: () => ({
    transactions: mockTransactions,
    autoClassified: [],
    loading: false,
    loadError: mockLoadState.error,
    fetchPending: mockFetchPending,
    classifyTransactionsBatch: mockClassifyBatch,
    classifyTransactionsSplit: mockClassifySplit,
    flagTransactionsBatch: mockFlagBatch,
    markTransferBatch: mockMarkTransferBatch,
    revertToPendingBatch: mockRevertBatch,
    reclassifyTransactionsBatch: mockReclassifyBatch,
    awardXp: mockAwardXp,
    getMonthStats: mockGetMonthStats,
    getExportData: vi.fn().mockResolvedValue([]),
    getAccountAliases: mockGetAccountAliases,
    getDistinctAccountLast4ForHousehold: mockGetDistinctLast4,
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
    confirmAutoClassifiedBatch: mockConfirmAutoBatch,
    rejectAutoClassified: mockRejectAuto,
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

/** Renders the real card plus probe controls: swipes cannot be driven through jsdom drag, so the probe calls the same handlers and exposes the restore tick the deck passes down. */
vi.mock('./SwipeCard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./SwipeCard')>()
  const RealSwipeCard = actual.default
  return {
    default: (props: ComponentProps<typeof RealSwipeCard>) => (
      <>
        <RealSwipeCard {...props} />
        {props.stackIndex === 0 && (
          <div data-testid="swipe-probe" data-restore-tick={props.pickerCancelTick ?? 0}>
            <button type="button" onClick={() => props.onSwipeRight()}>probe swipe right</button>
            <button type="button" onClick={() => props.onSwipeLeft()}>probe swipe left</button>
            <button type="button" onClick={() => props.onTransfer()}>probe transfer</button>
          </div>
        )}
      </>
    ),
  }
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
  return render(deckTree(route))
}

function deckTree(route: string) {
  return (
    <MockRouter initialEntries={[route]}>
      <MockAuthProvider value={{
        profile: mockProfile,
        user: { id: TEST_USER_ID } as never,
      }}>
        <SwipeDeck />
      </MockAuthProvider>
    </MockRouter>
  )
}

function resetDeckState() {
  mockTransactions.splice(0, mockTransactions.length)
  mockStore.groups = []
  mockStore.activeGroup = null
  mockStore.sessionHistory = []
  mockStore.showCategoryPicker = false
  mockLoadState.error = null
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

describe('SwipeDeck failed saves restore the top card', () => {
  const failed = { error: { message: 'boom' }, updatedCount: 0 }
  const restoreTick = () => screen.getByTestId('swipe-probe').getAttribute('data-restore-tick')

  beforeEach(() => {
    vi.clearAllMocks()
    resetDeckState()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    localStorage.clear()
    localStorage.setItem('classify_tutorial_dismissed', '1')
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    mockClassifyBatch.mockReset().mockResolvedValue({ error: null, updatedCount: 3 })
    mockFlagBatch.mockReset().mockResolvedValue({ error: null, updatedCount: 3 })
    mockMarkTransferBatch.mockReset().mockResolvedValue({ error: null, updatedCount: 3 })
    mockConfirmAutoBatch.mockReset().mockResolvedValue({ error: null, updatedCount: 3 })
    mockRejectAuto.mockReset().mockResolvedValue({ error: null })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  async function clickProbe(name: string, route = '/classify') {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDeck(route)
    await user.click(await screen.findByRole('button', { name }))
    return user
  }

  it('restores the card when confirming a predicted stack fails', async () => {
    // Arrange
    seedDeckStack(stackTxs(), 'food')
    mockConfirmAutoBatch.mockResolvedValue(failed)

    // Act
    await clickProbe('probe swipe right')

    // Assert
    await waitFor(() => expect(restoreTick()).toBe('1'))
    expect(await screen.findByText(/Could not save — try again/)).toBeInTheDocument()
    expect(mockRemoveTransactions).not.toHaveBeenCalled()
    expect(mockStore.advance).not.toHaveBeenCalled()
  })

  it('restores the card when rejecting a predicted stack fails', async () => {
    // Arrange
    seedDeckStack(stackTxs(), 'food')
    mockRejectAuto.mockResolvedValue({ error: { message: 'boom' } })

    // Act
    await clickProbe('probe swipe left')

    // Assert
    await waitFor(() => expect(restoreTick()).toBe('1'))
    expect(mockStore.flag).not.toHaveBeenCalled()
  })

  it('restores the card when flagging an unpredicted stack fails', async () => {
    // Arrange
    seedDeckStack(stackTxs(), null)
    mockFlagBatch.mockResolvedValue(failed)

    // Act
    await clickProbe('probe swipe left')

    // Assert
    await waitFor(() => expect(restoreTick()).toBe('1'))
    expect(mockStore.flag).not.toHaveBeenCalled()
  })

  it('restores the card when the server updated fewer rows than requested', async () => {
    // Arrange
    seedDeckStack(stackTxs(), null)
    mockFlagBatch.mockResolvedValue({ error: null, updatedCount: 1 })

    // Act
    await clickProbe('probe swipe left')

    // Assert
    await waitFor(() => expect(restoreTick()).toBe('1'))
    expect(mockStore.flag).not.toHaveBeenCalled()
  })

  it('restores the card when marking a transfer fails', async () => {
    // Arrange
    seedDeckStack(stackTxs(), null)
    mockMarkTransferBatch.mockResolvedValue(failed)

    // Act
    await clickProbe('probe transfer')

    // Assert
    await waitFor(() => expect(restoreTick()).toBe('1'))
    expect(mockStore.markTransfer).not.toHaveBeenCalled()
  })

  it('restores the card when the category save fails after picking a category', async () => {
    // Arrange
    seedDeckStack(stackTxs(), null)
    mockStore.showCategoryPicker = true
    mockClassifyBatch.mockResolvedValue(failed)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDeck()

    // Act
    await user.click((await screen.findAllByRole('option', { name: /Food/ }))[0]!)

    // Assert
    await waitFor(() => expect(restoreTick()).toBe('1'))
    expect(mockStore.advance).not.toHaveBeenCalled()
  })

  it('restores the card and shows the save error when the save request throws', async () => {
    // Arrange
    seedDeckStack(stackTxs(), null)
    mockStore.showCategoryPicker = true
    mockClassifyBatch.mockRejectedValue(new Error('network down'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDeck()

    // Act
    await user.click((await screen.findAllByRole('option', { name: /Food/ }))[0]!)

    // Assert
    await waitFor(() => expect(restoreTick()).toBe('1'))
    expect(await screen.findByText(/Could not save — try again/)).toBeInTheDocument()
    expect(mockStore.advance).not.toHaveBeenCalled()
  })

  it('still recovers when the refetch after a failed save also throws', async () => {
    // Arrange
    seedDeckStack(stackTxs(), null)
    mockFlagBatch.mockResolvedValue(failed)
    mockRefetchFresh.mockRejectedValueOnce(new Error('offline'))

    // Act
    await clickProbe('probe swipe left')

    // Assert
    await waitFor(() => expect(restoreTick()).toBe('1'))
    expect(await screen.findByText(/Could not save — try again/)).toBeInTheDocument()
  })

  it('reports an unexpected error instead of failing silently when a follow-up step throws', async () => {
    // Arrange
    seedDeckStack(stackTxs(), 'food')
    mockAwardXp.mockRejectedValueOnce(new Error('auth lock timeout'))

    // Act
    await clickProbe('probe swipe right')

    // Assert
    expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument()
    expect(mockStore.advance).toHaveBeenCalledWith(3)
  })

  it('restores the card when skipping the only stack in the no-idea deck', async () => {
    // Arrange
    seedDeckStack(stackTxs(), null)

    // Act
    await clickProbe('probe swipe left', '/classify/no-idea')

    // Assert
    await waitFor(() => expect(restoreTick()).toBe('1'))
    expect(mockStore.rotateCurrentToEnd).not.toHaveBeenCalled()
  })

  it('rotates without restoring when the no-idea deck has more than one stack', async () => {
    // Arrange
    seedDeckStack(stackTxs(), null)
    mockStore.groups = [mockStore.groups[0], { ...(mockStore.groups[0] as object), key: 'other\u00002026-06' }]

    // Act
    await clickProbe('probe swipe left', '/classify/no-idea')

    // Assert
    await waitFor(() => expect(mockStore.rotateCurrentToEnd).toHaveBeenCalledTimes(1))
    expect(restoreTick()).toBe('0')
  })

  it('does not restore the card after a successful save', async () => {
    // Arrange
    seedDeckStack(stackTxs(), 'food')

    // Act
    await clickProbe('probe swipe right')

    // Assert
    await waitFor(() => expect(mockStore.advance).toHaveBeenCalledWith(3))
    expect(restoreTick()).toBe('0')
  })
})

describe('SwipeDeck load failures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDeckState()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    localStorage.clear()
    localStorage.setItem('classify_tutorial_dismissed', '1')
    mockRefetchFresh.mockReset().mockResolvedValue({ pending: [], autoClassified: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows an error with a retry instead of an empty deck when the first load fails', async () => {
    // Arrange
    mockLoadState.error = new Error('request timed out')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDeck()

    // Act
    await user.click(await screen.findByRole('button', { name: 'Try again' }))

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't load your transactions/)
    expect(mockFetchPending).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/how classification works/i)).not.toBeInTheDocument()
  })

  it('shows an error with a retry when confirming the cleared deck fails, and recovers on retry', async () => {
    // Arrange
    mockStore.sessionHistory = [makeSessionAction()]
    mockRefetchFresh.mockRejectedValueOnce(new Error('request timed out'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDeck()
    const retry = await screen.findByRole('button', { name: 'Try again' })
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't confirm/)

    // Act
    await user.click(retry)

    // Assert
    await waitFor(() => expect(mockRefetchFresh).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
})

describe('SwipeDeck open picker follows the active stack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDeckState()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    localStorage.clear()
    localStorage.setItem('classify_tutorial_dismissed', '1')
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('closes the picker when a refresh swaps the active stack underneath it', async () => {
    // Arrange
    seedDeckStack(stackTxs())
    mockStore.showCategoryPicker = true
    const view = renderDeck()
    await screen.findByTestId('swipe-probe')

    // Act
    mockStore.activeGroup = { ...(mockStore.activeGroup as object), key: 'netflix\u00002026-06' }
    view.rerender(deckTree('/classify'))

    // Assert
    await waitFor(() => expect(mockStore.closeCategoryPicker).toHaveBeenCalledTimes(1))
  })

  it('keeps the picker open while the active stack is unchanged', async () => {
    // Arrange
    seedDeckStack(stackTxs())
    mockStore.showCategoryPicker = true
    const view = renderDeck()
    await screen.findByTestId('swipe-probe')

    // Act
    view.rerender(deckTree('/classify'))

    // Assert
    expect(mockStore.closeCategoryPicker).not.toHaveBeenCalled()
  })
})
describe('SwipeDeck refresh edge cases', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  const defaultDetect = { offsetCount: 0, pending: [], autoClassified: [] }

  beforeEach(() => {
    vi.clearAllMocks()
    resetDeckState()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    localStorage.clear()
    localStorage.setItem('classify_tutorial_dismissed', '1')
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mockRefetchFresh.mockReset().mockResolvedValue({ pending: [], autoClassified: [], stale: false })
    mockDetectRefundsAndRefresh.mockReset().mockResolvedValue({ ...defaultDetect, stale: false })
    mockClassifyBatch.mockReset().mockResolvedValue({ error: null, updatedCount: 3 })
    mockReclassifyBatch.mockReset().mockResolvedValue({ error: null, updatedCount: 2 })
  })

  afterEach(() => {
    warnSpy.mockRestore()
    delete (document as { visibilityState?: unknown }).visibilityState
    vi.useRealTimers()
    vi.unstubAllGlobals()
    mockDetectRefundsAndRefresh.mockReset().mockResolvedValue(defaultDetect)
    mockRefetchFresh.mockReset().mockResolvedValue({ pending: [], autoClassified: [] })
  })

  const storeCallsJson = () =>
    JSON.stringify([...mockStore.load.mock.calls, ...mockStore.refreshDeck.mock.calls])

  it('syncs the store with the refreshed queue when the refresh is current', async () => {
    // Arrange
    seedDeckStack(stackTxs())
    mockDetectRefundsAndRefresh.mockResolvedValue({
      offsetCount: 0,
      stale: false,
      pending: [makeTx({ id: 'fresh-only' })],
      autoClassified: [],
    })

    // Act
    renderDeck()

    // Assert
    await waitFor(() => expect(storeCallsJson()).toContain('fresh-only'))
  })

  it('leaves the store alone when the refresh was superseded by a newer change', async () => {
    // Arrange
    seedDeckStack(stackTxs())
    mockDetectRefundsAndRefresh.mockResolvedValue({
      offsetCount: 0,
      stale: true,
      pending: [makeTx({ id: 'stale-only' })],
      autoClassified: [],
    })

    // Act
    renderDeck()
    await waitFor(() => expect(mockDetectRefundsAndRefresh).toHaveBeenCalled())
    await vi.advanceTimersByTimeAsync(0)

    // Assert
    expect(storeCallsJson()).not.toContain('stale-only')
  })

  it('logs a warning instead of failing silently when the 30 s refresh fails', async () => {
    // Arrange
    seedDeckStack(stackTxs())
    const failure = new Error('offline')
    mockRefetchFresh.mockRejectedValue(failure)
    renderDeck()
    await screen.findByTestId('swipe-probe')

    // Act
    await vi.advanceTimersByTimeAsync(30_000)

    // Assert
    await waitFor(() => expect(warnSpy).toHaveBeenCalledWith('queue refresh failed:', failure))
  })

  it('logs a warning when the refresh on returning to the tab fails', async () => {
    // Arrange
    seedDeckStack(stackTxs())
    const failure = new Error('offline')
    mockRefetchFresh.mockRejectedValue(failure)
    renderDeck()
    await screen.findByTestId('swipe-probe')

    // Act
    document.dispatchEvent(new Event('visibilitychange'))

    // Assert
    await waitFor(() => expect(warnSpy).toHaveBeenCalledWith('queue refresh failed:', failure))
  })

  it('shows an error with a retry instead of an endless spinner when the cleared-deck check was superseded', async () => {
    // Arrange
    mockStore.sessionHistory = [makeSessionAction()]
    mockRefetchFresh.mockResolvedValue({ pending: [makeTx()], autoClassified: [], stale: true })

    // Act
    renderDeck()

    // Assert
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't confirm/)
  })

  it('classifies the active stack, not an old Recent entry, after the Recent picker was cancelled', async () => {
    // Arrange
    seedDeckStack(stackTxs())
    mockStore.sessionHistory = [makeSessionAction({ category: 'food' })]
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const view = renderDeck()
    await user.click(await screen.findByRole('button', { name: /^Recent/ }))
    await user.click(await screen.findByRole('button', { name: 'Change category' }))
    mockStore.showCategoryPicker = true
    view.rerender(deckTree('/classify'))
    await screen.findByRole('dialog', { name: 'Pick a Category' })

    // Act
    await user.keyboard('{Escape}')
    await user.click(await screen.findByRole('option', { name: /Food/ }))

    // Assert
    await waitFor(() => expect(mockClassifyBatch).toHaveBeenCalledWith(['t1', 't2', 't3'], 'food'))
    expect(mockReclassifyBatch).not.toHaveBeenCalled()
  })
})
describe('SwipeDeck saving indicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDeckState()
    localStorage.clear()
    localStorage.setItem('classify_tutorial_dismissed', '1')
    mockConfirmAutoBatch.mockReset()
    mockRefetchFresh.mockReset().mockResolvedValue({ pending: [], autoClassified: [], stale: false })
    MotionGlobalConfig.skipAnimations = true
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    MotionGlobalConfig.skipAnimations = false
    vi.mocked(console.warn).mockRestore()
  })

  /** Swipes right on a predicted stack whose save stays pending until the returned resolver is called. */
  async function swipeWithPendingSave() {
    seedDeckStack(stackTxs(), 'food')
    let settle!: (value: { error: unknown; updatedCount: number }) => void
    mockConfirmAutoBatch.mockReturnValue(new Promise((resolve) => { settle = resolve }))
    const user = userEvent.setup()
    renderDeck()
    await user.click(await screen.findByRole('button', { name: 'probe swipe right' }))
    return settle
  }

  it('shows a saving pill while the save is pending and removes it once the save succeeds', async () => {
    // Arrange & Act
    const settle = await swipeWithPendingSave()

    // Assert
    expect(await screen.findByText('Saving…')).toBeInTheDocument()

    // Act
    settle({ error: null, updatedCount: 3 })
    // Assert
    await waitFor(() => expect(screen.queryByText('Saving…')).not.toBeInTheDocument())
  })

  it('removes the saving pill when the save fails', async () => {
    // Arrange
    const settle = await swipeWithPendingSave()
    expect(await screen.findByText('Saving…')).toBeInTheDocument()

    // Act
    settle({ error: { message: 'boom' }, updatedCount: 0 })

    // Assert
    await waitFor(() => expect(screen.queryByText('Saving…')).not.toBeInTheDocument())
    expect(await screen.findByText(/Could not save/)).toBeInTheDocument()
  })
})