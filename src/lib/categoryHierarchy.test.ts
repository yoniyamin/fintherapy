import { describe, expect, it } from 'vitest'
import type { CategoryDef } from './constants'
import { buildCategoryHierarchy, resolveDisplayAmounts, rollUpAmounts } from './categoryHierarchy'

function makeCat(overrides: Partial<CategoryDef> & { id: string }): CategoryDef {
  return {
    label: overrides.id,
    icon: '📦',
    color: 'bg-slate-500/20 border-slate-500/40',
    expenseType: 'discretionary',
    spendingFrequency: 'monthly',
    ...overrides,
  }
}

describe('buildCategoryHierarchy', () => {
  it('groups children under their parent', () => {
    // Arrange
    const categories = [
      makeCat({ id: 'kids' }),
      makeCat({ id: 'kids_activities', parentCategoryId: 'kids' }),
      makeCat({ id: 'kids_toys_sub', parentCategoryId: 'kids' }),
      makeCat({ id: 'food' }),
    ]
    const amounts = { kids: 100, kids_activities: 50, kids_toys_sub: 30, food: 200 }

    // Act
    const groups = buildCategoryHierarchy(categories, amounts)

    // Assert
    const kidsGroup = groups.find(g => g.parent.id === 'kids')
    expect(kidsGroup).toBeDefined()
    expect(kidsGroup!.children).toHaveLength(2)
    expect(kidsGroup!.totalAmount).toBe(180)
    expect(groups.find(g => g.parent.id === 'food')?.totalAmount).toBe(200)
  })

  it('prevents depth > 2 by treating grandchildren as roots', () => {
    // Arrange
    const categories = [
      makeCat({ id: 'root' }),
      makeCat({ id: 'child', parentCategoryId: 'root' }),
      makeCat({ id: 'grandchild', parentCategoryId: 'child' }),
    ]
    const amounts = { root: 10, child: 20, grandchild: 30 }

    // Act
    const groups = buildCategoryHierarchy(categories, amounts)

    // Assert — grandchild should be a standalone root
    const grandchildGroup = groups.find(g => g.parent.id === 'grandchild')
    expect(grandchildGroup).toBeDefined()
    expect(grandchildGroup!.children).toHaveLength(0)
  })

  it('ignores self-referencing parentCategoryId', () => {
    // Arrange
    const categories = [makeCat({ id: 'loop', parentCategoryId: 'loop' })]
    const amounts = { loop: 50 }

    // Act
    const groups = buildCategoryHierarchy(categories, amounts)

    // Assert
    expect(groups).toHaveLength(1)
    expect(groups[0].parent.id).toBe('loop')
  })
})

describe('rollUpAmounts', () => {
  it('rolls child amounts into parent', () => {
    // Arrange
    const categories = [
      makeCat({ id: 'parent' }),
      makeCat({ id: 'child_a', parentCategoryId: 'parent' }),
      makeCat({ id: 'child_b', parentCategoryId: 'parent' }),
      makeCat({ id: 'standalone' }),
    ]
    const amounts = { parent: 10, child_a: 20, child_b: 30, standalone: 100 }

    // Act
    const rolled = rollUpAmounts(categories, amounts)

    // Assert
    expect(rolled['parent']).toBe(60)
    expect(rolled['child_a']).toBeUndefined()
    expect(rolled['child_b']).toBeUndefined()
    expect(rolled['standalone']).toBe(100)
  })
})

describe('resolveDisplayAmounts', () => {
  it('returns flat amounts in detailed mode', () => {
    // Arrange
    const categories = [
      makeCat({ id: 'parent' }),
      makeCat({ id: 'child', parentCategoryId: 'parent' }),
    ]
    const amounts = { parent: 10, child: 20 }

    // Act
    const result = resolveDisplayAmounts(categories, amounts, 'detailed')

    // Assert
    expect(result).toEqual({ parent: 10, child: 20 })
  })

  it('returns rolled-up amounts in grouped mode', () => {
    // Arrange
    const categories = [
      makeCat({ id: 'parent' }),
      makeCat({ id: 'child', parentCategoryId: 'parent' }),
    ]
    const amounts = { parent: 10, child: 20 }

    // Act
    const result = resolveDisplayAmounts(categories, amounts, 'grouped')

    // Assert
    expect(result['parent']).toBe(30)
  })
})
