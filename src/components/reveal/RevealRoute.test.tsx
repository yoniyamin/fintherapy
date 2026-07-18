import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RevealRoute from './RevealRoute'

let mockIsDesktop = false

vi.mock('../../hooks/useIsDesktop', () => ({
  useIsDesktop: () => mockIsDesktop,
}))

vi.mock('./RevealPage', () => ({
  default: () => <div data-testid="reveal-mobile">RevealPage</div>,
}))

vi.mock('./RevealDesktopPage', () => ({
  default: () => <div data-testid="reveal-desktop">RevealDesktopPage</div>,
}))

function renderRoute() {
  return render(
    <MemoryRouter>
      <RevealRoute />
    </MemoryRouter>,
  )
}

describe('RevealRoute', () => {
  afterEach(() => {
    mockIsDesktop = false
  })

  it('renders RevealPage on mobile', () => {
    // Arrange
    mockIsDesktop = false

    // Act
    renderRoute()

    // Assert
    expect(screen.getByTestId('reveal-mobile')).toBeInTheDocument()
    expect(screen.queryByTestId('reveal-desktop')).not.toBeInTheDocument()
  })

  it('renders RevealDesktopPage on desktop', () => {
    // Arrange
    mockIsDesktop = true

    // Act
    renderRoute()

    // Assert
    expect(screen.queryByTestId('reveal-mobile')).not.toBeInTheDocument()
    expect(screen.getByTestId('reveal-desktop')).toBeInTheDocument()
  })
})
