import { renderHook, act } from '@testing-library/react'
import { useIsDesktop } from './useIsDesktop'

let changeListeners: Array<() => void> = []
let currentMatches = false

function mockMatchMedia(matches: boolean) {
  changeListeners = []
  currentMatches = matches
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      get matches() {
        return currentMatches
      },
      addEventListener: (_: string, cb: () => void) => {
        changeListeners.push(cb)
      },
      removeEventListener: (_: string, cb: () => void) => {
        changeListeners = changeListeners.filter(l => l !== cb)
      },
    })),
  })
}

describe('useIsDesktop', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false when viewport is below 1280px', () => {
    // Arrange
    mockMatchMedia(false)

    // Act
    const { result } = renderHook(() => useIsDesktop())

    // Assert
    expect(result.current).toBe(false)
  })

  it('returns true when viewport is at least 1280px', () => {
    // Arrange
    mockMatchMedia(true)

    // Act
    const { result } = renderHook(() => useIsDesktop())

    // Assert
    expect(result.current).toBe(true)
  })

  it('updates when media query changes', () => {
    // Arrange
    mockMatchMedia(false)
    const { result } = renderHook(() => useIsDesktop())
    expect(result.current).toBe(false)

    // Act
    act(() => {
      currentMatches = true
      for (const cb of changeListeners) cb()
    })

    // Assert
    expect(result.current).toBe(true)
  })

  it('cleans up listener on unmount', () => {
    // Arrange
    mockMatchMedia(false)
    const { unmount } = renderHook(() => useIsDesktop())
    expect(changeListeners).toHaveLength(1)

    // Act
    unmount()

    // Assert
    expect(changeListeners).toHaveLength(0)
  })
})
