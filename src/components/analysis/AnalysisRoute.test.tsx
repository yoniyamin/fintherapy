import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AnalysisRoute from './AnalysisRoute'

let mockIsDesktop = false

vi.mock('../../hooks/useIsDesktop', () => ({
  useIsDesktop: () => mockIsDesktop,
}))

vi.mock('./AnalysisPage', () => ({
  default: () => <div data-testid="analysis-mobile">AnalysisPage</div>,
}))

vi.mock('./AnalysisDesktopPage', () => ({
  default: () => <div data-testid="analysis-desktop">AnalysisDesktopPage</div>,
}))

function renderRoute() {
  return render(
    <MemoryRouter>
      <AnalysisRoute />
    </MemoryRouter>,
  )
}

describe('AnalysisRoute', () => {
  afterEach(() => {
    mockIsDesktop = false
  })

  it('renders AnalysisPage on mobile', () => {
    // Arrange
    mockIsDesktop = false

    // Act
    renderRoute()

    // Assert
    expect(screen.getByTestId('analysis-mobile')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-desktop')).not.toBeInTheDocument()
  })

  it('renders AnalysisDesktopPage on desktop', () => {
    // Arrange
    mockIsDesktop = true

    // Act
    renderRoute()

    // Assert
    expect(screen.queryByTestId('analysis-mobile')).not.toBeInTheDocument()
    expect(screen.getByTestId('analysis-desktop')).toBeInTheDocument()
  })
})
