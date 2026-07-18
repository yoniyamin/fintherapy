import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BetsRoute from './BetsRoute'

let mockIsDesktop = false

vi.mock('../../hooks/useIsDesktop', () => ({
  useIsDesktop: () => mockIsDesktop,
}))

vi.mock('./BetsPage', () => ({
  default: () => <div data-testid="bets-mobile">BetsPage</div>,
}))

vi.mock('./BetsDesktopPage', () => ({
  default: () => <div data-testid="bets-desktop">BetsDesktopPage</div>,
}))

function renderRoute() {
  return render(
    <MemoryRouter>
      <BetsRoute />
    </MemoryRouter>,
  )
}

describe('BetsRoute', () => {
  afterEach(() => {
    mockIsDesktop = false
  })

  it('renders BetsPage on mobile', () => {
    // Arrange
    mockIsDesktop = false

    // Act
    renderRoute()

    // Assert
    expect(screen.getByTestId('bets-mobile')).toBeInTheDocument()
    expect(screen.queryByTestId('bets-desktop')).not.toBeInTheDocument()
  })

  it('renders BetsDesktopPage on desktop', () => {
    // Arrange
    mockIsDesktop = true

    // Act
    renderRoute()

    // Assert
    expect(screen.queryByTestId('bets-mobile')).not.toBeInTheDocument()
    expect(screen.getByTestId('bets-desktop')).toBeInTheDocument()
  })
})
