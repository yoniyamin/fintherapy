import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BetsPage from './BetsPage'
import { MockAuthProvider } from '../../test/mock-auth'
import { MockRouter } from '../../test/mock-router'
import type { Profile } from '../../types/database'

const TEST_HOUSEHOLD_ID = 'hh-111'
const TEST_USER_ID = 'user-1'

const mockProfile: Profile = {
  id: TEST_USER_ID,
  display_name: 'Tester',
  household_id: TEST_HOUSEHOLD_ID,
  total_xp: 100,
  created_at: '2026-01-01',
}

const mockCategories = [
  { id: 'food', label: 'Food', icon: '🛒', color: 'bg-green-500/20 border-green-500/40', expenseType: 'discretionary' as const },
  { id: 'transport', label: 'Transport', icon: '🚗', color: 'bg-blue-500/20 border-blue-500/40', expenseType: 'discretionary' as const },
  { id: 'streaming', label: 'Streaming', icon: '📺', color: 'bg-purple-500/20 border-purple-500/40', expenseType: 'fixed' as const },
  { id: 'dining', label: 'Dining', icon: '🍽️', color: 'bg-orange-500/20 border-orange-500/40', expenseType: 'discretionary' as const },
  { id: 'health', label: 'Health', icon: '💊', color: 'bg-red-500/20 border-red-500/40', expenseType: 'fixed' as const },
]

const mockFetchMyBets = vi.fn()
const mockFetchHouseholdBets = vi.fn()
const mockFetchHouseholdBetStatus = vi.fn()
const mockSubmitBets = vi.fn().mockResolvedValue({ error: null })

vi.mock('../../hooks/useBets', () => ({
  useBets: () => ({
    myBets: [],
    householdBets: [],
    householdBetStatus: [],
    loading: false,
    fetchMyBets: mockFetchMyBets,
    fetchHouseholdBets: mockFetchHouseholdBets,
    fetchHouseholdBetStatus: mockFetchHouseholdBetStatus,
    submitBets: mockSubmitBets,
  }),
}))

vi.mock('../../hooks/useReveal', () => ({
  useReveal: () => ({
    summary: [],
    fetchSummary: vi.fn(),
  }),
}))

vi.mock('../../hooks/useTransactions', () => ({
  useTransactions: () => ({
    getMonthStats: vi.fn().mockResolvedValue({ total_count: 10, pending_count: 5, classified_count: 5, transfer_count: 0, offset_count: 0, flagged_count: 0 }),
  }),
}))

vi.mock('../../hooks/useCategoryConfig', () => ({
  useCategoryConfig: () => ({ categories: mockCategories, loading: false }),
}))

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

function renderBets() {
  return render(
    <MockRouter>
      <MockAuthProvider value={{
        profile: mockProfile,
        user: { id: TEST_USER_ID } as never,
      }}>
        <BetsPage />
      </MockAuthProvider>
    </MockRouter>,
  )
}

describe('BetsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubmitBets.mockResolvedValue({ error: null })
  })

  it('renders the bets page with month selector and tabs', () => {
    // Arrange & Act
    renderBets()

    // Assert
    expect(screen.getByText('Bets')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('Place Bets')).toBeInTheDocument()
    expect(screen.getByText('Results')).toBeInTheDocument()
  })

  it('shows 4 randomly selected bet categories', async () => {
    // Arrange & Act
    renderBets()

    // Assert
    const inputs = await screen.findAllByRole('spinbutton')
    expect(inputs).toHaveLength(4)
  })

  it('fetches bets on mount', () => {
    // Arrange & Act
    renderBets()

    // Assert
    expect(mockFetchMyBets).toHaveBeenCalled()
    expect(mockFetchHouseholdBetStatus).toHaveBeenCalled()
  })

  it('submits bets and shows success', async () => {
    // Arrange
    renderBets()
    const user = userEvent.setup()

    // Act
    const inputs = await screen.findAllByRole('spinbutton')
    await user.clear(inputs[0])
    await user.type(inputs[0], '250')
    const submitBtns = screen.getAllByRole('button', { name: /place bets/i })
    const submitBtn = submitBtns.find(btn => btn.classList.contains('w-full'))!
    await user.click(submitBtn)

    // Assert
    await waitFor(() => {
      expect(mockSubmitBets).toHaveBeenCalled()
    })
  })

  it('shows error banner when submitBets returns an error', async () => {
    // Arrange
    mockSubmitBets.mockResolvedValue({ error: { message: 'Network failure' } })
    renderBets()
    const user = userEvent.setup()

    // Act
    const inputs = await screen.findAllByRole('spinbutton')
    await user.clear(inputs[0])
    await user.type(inputs[0], '100')
    const submitBtns = screen.getAllByRole('button', { name: /place bets/i })
    const submitBtn = submitBtns.find(btn => btn.classList.contains('w-full'))!
    await user.click(submitBtn)

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeInTheDocument()
    })
  })

  it('disables button while submitting', async () => {
    // Arrange
    let resolveSubmit!: (v: { error: null }) => void
    mockSubmitBets.mockReturnValue(
      new Promise<{ error: null }>((resolve) => { resolveSubmit = resolve }),
    )
    renderBets()
    const user = userEvent.setup()

    // Act
    const inputs = await screen.findAllByRole('spinbutton')
    await user.clear(inputs[0])
    await user.type(inputs[0], '200')
    const submitBtns = screen.getAllByRole('button', { name: /place bets/i })
    const submitBtn = submitBtns.find(btn => btn.classList.contains('w-full'))!
    await user.click(submitBtn)

    // Assert
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()

    // Cleanup — resolve with proper shape to avoid unhandled rejection
    resolveSubmit({ error: null })
  })
})
