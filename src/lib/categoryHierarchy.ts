import type { CategoryDef } from './constants'

export interface CategoryGroup {
  parent: CategoryDef
  children: CategoryDef[]
  totalAmount: number
}

/**
 * Groups categories by their `parentCategoryId`.
 * Includes a runtime cycle guard: any chain > depth 2 or self-referencing
 * entries are treated as roots to prevent infinite recursion.
 */
export function buildCategoryHierarchy(
  categories: CategoryDef[],
  amountByCategory: Record<string, number>,
): CategoryGroup[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const childrenMap = new Map<string, CategoryDef[]>()
  const roots: CategoryDef[] = []

  for (const cat of categories) {
    const parentId = cat.parentCategoryId
    if (parentId && parentId !== cat.id && byId.has(parentId)) {
      const proposedParent = byId.get(parentId)!
      if (proposedParent.parentCategoryId) {
        roots.push(cat)
      } else {
        const list = childrenMap.get(parentId) ?? []
        list.push(cat)
        childrenMap.set(parentId, list)
      }
    } else {
      roots.push(cat)
    }
  }

  return roots.map((parent) => {
    const children = childrenMap.get(parent.id) ?? []
    const parentAmount = amountByCategory[parent.id] ?? 0
    const childTotal = children.reduce((sum, c) => sum + (amountByCategory[c.id] ?? 0), 0)
    return { parent, children, totalAmount: parentAmount + childTotal }
  })
}

/**
 * Rolls up subcategory amounts to their parent category.
 * Returns a new amount map where each parent's total includes its children.
 */
export function rollUpAmounts(
  categories: CategoryDef[],
  amountByCategory: Record<string, number>,
): Record<string, number> {
  const result: Record<string, number> = {}
  const byId = new Map(categories.map((c) => [c.id, c]))

  for (const cat of categories) {
    const amount = amountByCategory[cat.id] ?? 0
    const parentId = cat.parentCategoryId
    if (parentId && parentId !== cat.id && byId.has(parentId)) {
      const parent = byId.get(parentId)!
      if (!parent.parentCategoryId) {
        result[parentId] = (result[parentId] ?? 0) + amount
        continue
      }
    }
    result[cat.id] = (result[cat.id] ?? 0) + amount
  }

  return result
}

/**
 * Resolves display-level amounts: 'grouped' rolls up to parents,
 * 'detailed' keeps everything flat.
 */
export function resolveDisplayAmounts(
  categories: CategoryDef[],
  amountByCategory: Record<string, number>,
  displayLevel: 'grouped' | 'detailed' = 'grouped',
): Record<string, number> {
  if (displayLevel === 'detailed') return { ...amountByCategory }
  return rollUpAmounts(categories, amountByCategory)
}
