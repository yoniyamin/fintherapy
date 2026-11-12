import { describe, expect, it } from 'vitest'
import {
  resolveCategoryIconSrc,
  resolveCategoryTextIcon,
  toGifIconToken,
} from './categoryIconAssets'

describe('resolveCategoryIconSrc', () => {
  it('uses a custom gif token before the default category asset', () => {
    // Arrange
    const icon = toGifIconToken('health')

    // Act
    const src = resolveCategoryIconSrc('coffee_shops', icon)

    // Assert
    expect(src).toContain('1277')
  })

  it('falls back to the category id asset for built-in categories', () => {
    // Arrange & Act
    const src = resolveCategoryIconSrc('transport', '🚗')

    // Assert
    expect(src).toContain('860')
  })
})

describe('resolveCategoryTextIcon', () => {
  it('returns a plain emoji unchanged', () => {
    // Arrange & Act
    const glyph = resolveCategoryTextIcon('custom', '🍕')

    // Assert
    expect(glyph).toBe('🍕')
  })

  it('maps a gif token to the default emoji of that category', () => {
    // Arrange & Act
    const glyph = resolveCategoryTextIcon('transport', 'gif:transport')

    // Assert
    expect(glyph).toBe('🚗')
  })

  it('falls back to the category id default when the gif token key is unknown', () => {
    // Arrange & Act
    const glyph = resolveCategoryTextIcon('dining', 'gif:unknown_key')

    // Assert
    expect(glyph).toBe('🍽️')
  })

  it('uses the fallback glyph for a gif token on a custom category', () => {
    // Arrange & Act
    const glyph = resolveCategoryTextIcon('my_custom_category', 'gif:unknown_key')

    // Assert
    expect(glyph).toBe('📦')
  })

  it('maps a fluent token to its unicode glyph', () => {
    // Arrange & Act
    const glyph = resolveCategoryTextIcon('custom', 'fluent:taxi')

    // Assert
    expect(glyph).toBe('🚕')
  })

  it('uses the fallback glyph for an unknown fluent token', () => {
    // Arrange & Act
    const glyph = resolveCategoryTextIcon('custom', 'fluent:does_not_exist')

    // Assert
    expect(glyph).toBe('📦')
  })
})