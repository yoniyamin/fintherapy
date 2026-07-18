import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NavRail from './NavRail'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    profile: { id: 'u1', household_id: 'hh1', display_name: 'Tester', total_xp: 100, created_at: '2026-01-01' },
  }),
}))

vi.mock('../../hooks/useTransactions', () => ({
  useTransactions: () => ({
    transactions: [{ id: '1' }, { id: '2' }],
    autoClassified: [{ id: '3' }],
  }),
}))

vi.mock('../../hooks/useFlaggedCount', () => ({
  useFlaggedCount: () => 2,
}))

function renderNavRail(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <NavRail />
    </MemoryRouter>,
  )
}

describe('NavRail', () => {
  it('renders navigation with expected items excluding Home', () => {
    // Arrange & Act
    renderNavRail()

    // Assert
    expect(screen.getByTestId('nav-rail')).toBeInTheDocument()
    expect(screen.getByText('Classify')).toBeInTheDocument()
    expect(screen.getByText('Reveal')).toBeInTheDocument()
    expect(screen.getByText('Analysis')).toBeInTheDocument()
    expect(screen.getByText('Bets')).toBeInTheDocument()
    expect(screen.queryByText('Home')).not.toBeInTheDocument()
  })

  it('renders secondary items (Upload and Settings)', () => {
    // Arrange & Act
    renderNavRail()

    // Assert
    expect(screen.getByText('Upload')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('shows badge count on Classify item', () => {
    // Arrange & Act
    renderNavRail()

    // Assert — 2 pending + 1 auto + 2 flagged = 5
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('highlights the active route', () => {
    // Arrange & Act
    renderNavRail('/classify')

    // Assert
    const classifyLink = screen.getByText('Classify').closest('a')
    expect(classifyLink).toHaveClass('text-duo-green')
  })
})
