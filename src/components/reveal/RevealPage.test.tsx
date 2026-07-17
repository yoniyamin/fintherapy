import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RevealPage from './RevealPage'
import { MockAuthProvider } from '../../test/mock-auth'
import { MockRouter } from '../../test/mock-router'
import type { Profile } from '../../types/database'

const TEST_HOUSEHOLD_ID = 'hh-reveal-1'

const mockProfile: Profile = {
  id: 'user-1',
  display_name: 'Revealer',
  household_id: TEST_HOUSEHOLD_ID,
  total_xp: 200,
  created_at: '2026-01-01',
}

const mockCategories = [
  { id: 'food', label: 'Food', icon: '🛒', color: 'bg-green-500/20 border-green-500/40', expenseType: 'discretionary' as const },
  { id: 'transport', label: 'Transport', icon: '🚗', color: 'bg-blue-500/20 border-blue-500/40', expenseType: 'discretionary' as const },
]

const mockFetchSummary = vi.fn()

vi.mock('../../hooks/useReveal', () => ({
  useReveal: () => ({
    summary: [
      { category: 'food', total_amount: 350, tx_count: 15 },
      { category: 'transport', total_amount: 120, tx_count: 8 },
    ],
    leaderboard: [
      { user_id: 'user-1', display_name: 'Revealer', total_xp: 200, classified_count: 50 },
    ],
    monthlyTotals: [
      { billing_month: '2026-06', total_amount: 470, tx_count: 23 },
    ],
    householdIncome: 3000,
    loading: false,
    fetchSummary: mockFetchSummary,
    setIncome: vi.fn().mockResolvedValue(undefined),
  }),
}))

const mockGetMonthStats = vi.fn()

vi.mock('../../hooks/useTransactions', () => ({
  useTransactions: () => ({
    getTransactionsByCategory: vi.fn().mockResolvedValue([]),
    reclassifyTransaction: vi.fn().mockResolvedValue({ error: null }),
    markTransfer: vi.fn().mockResolvedValue({ error: null }),
    setTransactionsUserNote: vi.fn().mockResolvedValue(undefined),
    getExportData: vi.fn().mockResolvedValue([]),
    getAccountAliases: vi.fn().mockResolvedValue([]),
    getDistinctAccountLast4ForHousehold: vi.fn().mockResolvedValue(['1234']),
    upsertAccountAlias: vi.fn().mockResolvedValue(undefined),
    autoMarkDebitLoads: vi.fn().mockResolvedValue(0),
    getMonthStats: mockGetMonthStats,
  }),
}))

vi.mock('../../hooks/useCategoryConfig', () => ({
  useCategoryConfig: () => ({
    categories: mockCategories,
    loading: false,
    categoryLookup: Object.fromEntries(mockCategories.map(c => [c.id, c])),
  }),
}))

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}))

vi.mock('../../lib/generateSlideDeck', () => ({
  generateSlideDeck: vi.fn().mockResolvedValue(new Blob()),
  downloadBlob: vi.fn(),
}))

function renderReveal() {
  return render(
    <MockRouter initialEntries={['/reveal']}>
      <MockAuthProvider value={{ profile: mockProfile }}>
        <RevealPage />
      </MockAuthProvider>
    </MockRouter>,
  )
}

describe('RevealPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMonthStats.mockResolvedValue({
      total_count: 23,
      pending_count: 0,
      classified_count: 20,
      transfer_count: 3,
      offset_count: 0,
      flagged_count: 0,
    })
  })

  it('renders the reveal page with month selector', async () => {
    // Arrange & Act
    renderReveal()

    // Assert
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })
  })

  it('fetches summary on mount', () => {
    // Arrange & Act
    renderReveal()

    // Assert
    expect(mockFetchSummary).toHaveBeenCalled()
  })

  it('shows celebration screen when all transactions are classified', async () => {
    // Arrange & Act
    renderReveal()

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/all.*classified/i) ?? screen.getByText(/done/i)).toBeTruthy()
    })
  })

  it('shows income editor after dismissing completion screen', async () => {
    // Arrange
    renderReveal()
    const user = userEvent.setup()

    // Act — dismiss the "all classified" completion screen
    const revealBtn = await screen.findByRole('button', { name: /reveal the numbers/i })
    await user.click(revealBtn)

    // Assert — income editor should be visible on the dashboard
    await waitFor(() => {
      expect(screen.getByText(/household income/i)).toBeInTheDocument()
    })
  })

  it('shows blocked state when too many pending transactions', async () => {
    // Arrange
    mockGetMonthStats.mockResolvedValue({
      total_count: 100,
      pending_count: 50,
      classified_count: 50,
      transfer_count: 0,
      offset_count: 0,
      flagged_count: 0,
    })

    // Act
    renderReveal()

    // Assert
    await waitFor(() => {
      const blockText = screen.queryByText(/classify/i)
      expect(blockText).toBeInTheDocument()
    })
  })

  it('shows no-data state when month has zero transactions', async () => {
    // Arrange
    mockGetMonthStats.mockResolvedValue({
      total_count: 0,
      pending_count: 0,
      classified_count: 0,
      transfer_count: 0,
      offset_count: 0,
      flagged_count: 0,
    })

    // Act
    renderReveal()

    // Assert
    await waitFor(() => {
      const noDataEl = screen.queryByText(/no.*transactions/i) ?? screen.queryByText(/upload/i)
      expect(noDataEl).toBeInTheDocument()
    })
  })

  it('changes month via the selector', async () => {
    // Arrange
    renderReveal()
    const user = userEvent.setup()

    // Act
    const select = await screen.findByRole('combobox')
    await user.selectOptions(select, select.querySelectorAll('option')[1]?.value ?? '')

    // Assert
    expect(mockFetchSummary).toHaveBeenCalledTimes(2)
  })
})
