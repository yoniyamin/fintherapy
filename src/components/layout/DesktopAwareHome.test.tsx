import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import DesktopAwareHome from './DesktopAwareHome'

let mockIsDesktop = false

vi.mock('../../hooks/useIsDesktop', () => ({
  useIsDesktop: () => mockIsDesktop,
}))

vi.mock('../home/HomePage', () => ({
  default: () => <div data-testid="home-page">HomePage</div>,
}))

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route index element={<DesktopAwareHome />} />
        <Route path="/reveal" element={<div data-testid="reveal-page">Reveal</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DesktopAwareHome', () => {
  afterEach(() => {
    mockIsDesktop = false
  })

  it('renders HomePage on mobile', () => {
    // Arrange
    mockIsDesktop = false

    // Act
    renderWithRouter()

    // Assert
    expect(screen.getByTestId('home-page')).toBeInTheDocument()
    expect(screen.queryByTestId('reveal-page')).not.toBeInTheDocument()
  })

  it('redirects to /reveal on desktop', () => {
    // Arrange
    mockIsDesktop = true

    // Act
    renderWithRouter()

    // Assert
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
    expect(screen.getByTestId('reveal-page')).toBeInTheDocument()
  })
})
