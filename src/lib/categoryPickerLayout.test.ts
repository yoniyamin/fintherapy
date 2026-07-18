import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES, type CategoryDef } from './constants'
import {
  buildCategoryPickerLayout,
  inferCategoriesFromMerchant,
  resolveSuggestedCategoryIds,
  sortCategoriesByFrequency,
} from './categoryPickerLayout'

const cats = DEFAULT_CATEGORIES as unknown as CategoryDef[]

describe('inferCategoriesFromMerchant', () => {
  it('maps grocery merchants to food & groceries', () => {
    // Arrange
    const merchantRaw = 'WHOLE FOODS MARKET'

    // Act
    const result = inferCategoriesFromMerchant(merchantRaw, 'Whole Foods')

    // Assert
    expect(result[0]).toBe('food_groceries')
  })

  it('maps fuel merchants to transport', () => {
    // Arrange
    const merchantRaw = 'SHELL GAS STATION'

    // Act
    const result = inferCategoriesFromMerchant(merchantRaw, 'Shell')

    // Assert
    expect(result[0]).toBe('transport')
  })
})

describe('resolveSuggestedCategoryIds', () => {
  it('prioritizes predicted category then merchant heuristics', () => {
    // Arrange
    const input = {
      categories: cats,
      predictedCategory: 'streaming_subs',
      merchantRaw: 'WHOLE FOODS MARKET',
      merchantClean: 'Whole Foods',
    }

    // Act
    const result = resolveSuggestedCategoryIds(input)

    // Assert
    expect(result).toEqual(['streaming_subs', 'food_groceries', 'dining'])
  })

  it('fills a single prediction with frequency fallbacks', () => {
    // Arrange
    const input = {
      categories: cats,
      merchantRaw: 'WHOLE FOODS MARKET',
      merchantClean: 'Whole Foods',
    }

    // Act
    const result = resolveSuggestedCategoryIds(input)

    // Assert
    expect(result).toEqual(['food_groceries', 'dining', 'transport'])
  })

  it('caps suggestions at three items', () => {
    // Arrange
    const input = {
      categories: cats,
      predictedCategory: 'food_groceries',
      currentCategory: 'dining',
      merchantRaw: 'NETFLIX STARBUCKS SHELL',
    }

    // Act
    const result = resolveSuggestedCategoryIds(input)

    // Assert
    expect(result.length).toBe(3)
  })
})

describe('sortCategoriesByFrequency', () => {
  it('places food and dining before rare categories', () => {
    // Arrange
    const shuffled = [cats.find((c) => c.id === 'miscellaneous')!, cats.find((c) => c.id === 'food_groceries')!]

    // Act
    const result = sortCategoriesByFrequency(shuffled)

    // Assert
    expect(result[0]!.id).toBe('food_groceries')
  })
})

describe('buildCategoryPickerLayout', () => {
  it('excludes suggested categories from the main grid', () => {
    // Arrange
    const input = {
      categories: cats,
      merchantRaw: 'WHOLE FOODS MARKET',
      merchantClean: 'Whole Foods',
    }

    // Act
    const layout = buildCategoryPickerLayout(input)

    // Assert
    expect(layout.suggested.some((c) => c.id === 'food_groceries')).toBe(true)
    expect(layout.grid.map((c) => c.id)).not.toContain('food_groceries')
  })

  it('sorts the main grid by global frequency', () => {
    // Arrange
    const input = { categories: cats }

    // Act
    const layout = buildCategoryPickerLayout(input)

    // Assert
    expect(layout.grid[0]?.id).toBe('streaming_subs')
    expect(layout.grid.at(-1)?.id).toBe('own_transfers')
  })
})
