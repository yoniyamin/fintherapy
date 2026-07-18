import { describe, expect, it } from 'vitest'
import {
  resolveCategoryIconSrc,
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
