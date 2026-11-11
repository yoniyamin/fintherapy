import { useMemo } from 'react'
import { buildCategoryHierarchy } from '../../lib/categoryHierarchy'
import type { CategoryDef } from '../../lib/constants'

interface CategorySelectProps {
  categories: readonly CategoryDef[]
  value: string | null
  onChange: (categoryId: string | null) => void
  emptyLabel: string | null
  ariaLabel: string
  className?: string
}

/** Native category dropdown: subcategories are grouped under their parent. `emptyLabel` null removes the empty choice. */
export default function CategorySelect({
  categories,
  value,
  onChange,
  emptyLabel,
  ariaLabel,
  className,
}: CategorySelectProps) {
  const groups = useMemo(() => buildCategoryHierarchy([...categories], {}), [categories])
  const isKnown = value == null || categories.some((c) => c.id === value)

  return (
    <select
      aria-label={ariaLabel}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
      className={className}
    >
      {emptyLabel != null && <option value="">{emptyLabel}</option>}
      {!isKnown && <option value={value}>{value}</option>}
      {groups.map(({ parent, children }) =>
        children.length === 0 ? (
          <option key={parent.id} value={parent.id}>
            {parent.icon} {parent.label}
          </option>
        ) : (
          <optgroup key={parent.id} label={parent.label}>
            <option value={parent.id}>
              {parent.icon} {parent.label}
            </option>
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.icon} {child.label}
              </option>
            ))}
          </optgroup>
        ),
      )}
    </select>
  )
}
