import { render, screen } from '@testing-library/react'
import CategorySelect from './CategorySelect'
import type { CategoryDef } from '../../lib/constants'

const base = { color: '', expenseType: 'discretionary', spendingFrequency: 'monthly' } as const

const categories: CategoryDef[] = [
  { ...base, id: 'transport', label: 'Transport', icon: 'gif:transport' },
  { ...base, id: 'taxi', label: 'Taxi', icon: 'fluent:taxi', parentCategoryId: 'transport' },
  { ...base, id: 'pizza', label: 'Pizza', icon: '🍕' },
]

describe('CategorySelect', () => {
  it('shows an emoji instead of the raw icon token in every option', () => {
    // Arrange & Act
    render(
      <CategorySelect categories={categories} value={null} onChange={() => undefined} emptyLabel="Pick" ariaLabel="Category" />,
    )

    // Assert
    const optionTexts = screen.getAllByRole('option').map((o) => o.textContent)
    expect(optionTexts).toContain('🚗 Transport')
    expect(optionTexts).toContain('🚕 Taxi')
    expect(optionTexts).toContain('🍕 Pizza')
    expect(optionTexts.some((t) => t?.includes('gif:') || t?.includes('fluent:'))).toBe(false)
  })
})
