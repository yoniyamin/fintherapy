import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CompactHomePanel from './CompactHomePanel'
import { MockAuthProvider } from '../../test/mock-auth'
import type { Profile } from '../../types/database'

const mockProfile: Profile = {
  id: 'u1',
  display_name: 'Tester',
  household_id: 'hh1',
  total_xp: 250,
  created_at: '2026-01-01',
}

const mockGetHouseholdInfo = vi.fn().mockResolvedValue({ name: 'Smith Family', invite_code: 'ABC123' })
const mockGetLeaderboard = vi.fn().mockResolvedValue([
  { user_id: 'u1', display_name: 'Tester', total_xp: 250 },
])

const mockGetDailyActivity = vi.fn().mockResolvedValue([
  { user_id: 'u1', display_name: 'Tester', classified_today: 5, uploads_today: 0, bets_placed_today: 0 },
])
const mockGetMemberDailyRecords = vi.fn().mockResolvedValue([])

vi.mock('../../hooks/useTransactions', () => ({
  useTransactions: () => ({
    transactions: [{ id: '1' }, { id: '2' }],
    autoClassified: [],
    getDailyActivity: mockGetDailyActivity,
    getHouseholdInfo: mockGetHouseholdInfo,
    getLeaderboard: mockGetLeaderboard,
    getMemberDailyRecords: mockGetMemberDailyRecords,
  }),
}))

vi.mock('../../hooks/useFlaggedCount', () => ({
  useFlaggedCount: () => 3,
}))

vi.mock('../../hooks/useFlaggedSuggestions', () => ({
  useFlaggedSuggestions: () => ({ suggestions: [], suggestionCount: 0, loading: false, removeSuggestion: vi.fn() }),
}))

function renderPanel() {
  return render(
    <MemoryRouter>
      <MockAuthProvider value={{ profile: mockProfile }}>
        <CompactHomePanel />
      </MockAuthProvider>
    </MemoryRouter>,
  )
}

describe('CompactHomePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the panel with household name after loading', async () => {
    // Arrange & Act
    renderPanel()

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Smith Family')).toBeInTheDocument()
    })
  })

  it('shows user display name and XP', async () => {
    // Arrange & Act
    renderPanel()

    // Assert — "Tester" appears in the user card and the activity feed
    await waitFor(() => {
      expect(screen.getAllByText('Tester').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('250')).toBeInTheDocument()
    })
  })

  it('shows classify queue count', async () => {
    // Arrange & Act
    renderPanel()

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Classify queue')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  it('shows no idea queue when count > 0', async () => {
    // Arrange & Act
    renderPanel()

    // Assert
    await waitFor(() => {
      expect(screen.getByText('No idea queue')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('shows Reveal link', async () => {
    // Arrange & Act
    renderPanel()

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Reveal')).toBeInTheDocument()
    })
  })

  it('shows accordion toggles docked to bottom with content hidden by default', async () => {
    // Arrange & Act
    renderPanel()

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Smith Family')).toBeInTheDocument()
    })
    expect(screen.getByText('Activity today')).toBeInTheDocument()
    expect(screen.getByText('Invite code')).toBeInTheDocument()
    // Accordion content is in the DOM but CSS-hidden via grid-rows-[0fr] + overflow-hidden
    const activityText = screen.queryByText('classified 5')
    if (activityText) {
      expect(activityText.closest('[class*="overflow-hidden"]')).toBeTruthy()
    }
  })

  it('returns null when no profile', () => {
    // Arrange & Act
    const { container } = render(
      <MemoryRouter>
        <MockAuthProvider value={{ profile: null }}>
          <CompactHomePanel />
        </MockAuthProvider>
      </MemoryRouter>,
    )

    // Assert
    expect(container.innerHTML).toBe('')
  })
})
