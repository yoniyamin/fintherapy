import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AppShell from './AppShell'

let mockIsDesktop = false

vi.mock('../../hooks/useIsDesktop', () => ({
  useIsDesktop: () => mockIsDesktop,
}))

vi.mock('./OrganicBackdrop', () => ({
  default: () => <div data-testid="organic-backdrop" />,
}))

vi.mock('./InstallPrompt', () => ({
  default: () => null,
}))

vi.mock('./CompactHomePanel', () => ({
  default: () => <div data-testid="compact-home-panel">CompactHome</div>,
}))

vi.mock('./NavRail', () => ({
  default: () => <nav data-testid="nav-rail">NavRail</nav>,
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    profile: { id: 'u1', household_id: 'hh1', display_name: 'Test', total_xp: 0, created_at: '2026-01-01' },
  }),
}))

vi.mock('../../hooks/useTransactions', () => ({
  useTransactions: () => ({ transactions: [], autoClassified: [] }),
}))

vi.mock('../../hooks/useFlaggedCount', () => ({
  useFlaggedCount: () => 0,
}))

function renderShell(route = '/test') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/test" element={<div data-testid="test-page">Test Page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppShell', () => {
  afterEach(() => {
    mockIsDesktop = false
  })

  it('renders mobile layout with bottom tab bar when not desktop', () => {
    // Arrange
    mockIsDesktop = false

    // Act
    renderShell()

    // Assert
    expect(screen.getByText('Test Page')).toBeInTheDocument()
    expect(screen.getByLabelText('Main navigation')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-rail')).not.toBeInTheDocument()
    expect(screen.queryByTestId('compact-home-panel')).not.toBeInTheDocument()
  })

  it('renders desktop layout with nav rail and compact home panel', () => {
    // Arrange
    mockIsDesktop = true

    // Act
    renderShell()

    // Assert
    expect(screen.getByText('Test Page')).toBeInTheDocument()
    expect(screen.getByTestId('nav-rail')).toBeInTheDocument()
    expect(screen.getByTestId('compact-home-panel')).toBeInTheDocument()
    expect(screen.queryByLabelText('Main navigation')).not.toBeInTheDocument()
  })

  it('renders organic backdrop in both modes', () => {
    // Arrange & Act — mobile
    mockIsDesktop = false
    const { unmount } = renderShell()
    expect(screen.getByTestId('organic-backdrop')).toBeInTheDocument()
    unmount()

    // Act — desktop
    mockIsDesktop = true
    renderShell()
    expect(screen.getByTestId('organic-backdrop')).toBeInTheDocument()
  })
})
