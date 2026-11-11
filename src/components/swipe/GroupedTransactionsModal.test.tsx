import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GroupedTransactionsModal from './GroupedTransactionsModal'
import type { CategoryDef } from '../../lib/constants'
import type { CategoryAssignments } from '../../lib/groupAssignments'
import type { Transaction } from '../../types/database'

const categories: CategoryDef[] = [
  { id: 'food', label: 'Food', icon: '🛒', color: '', expenseType: 'discretionary', spendingFrequency: 'frequent' },
  { id: 'transport', label: 'Transport', icon: '🚗', color: '', expenseType: 'discretionary', spendingFrequency: 'frequent' },
]

function makeTx(id: string, amount: number, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    merchant_raw: 'AMAZON',
    merchant_clean: 'Amazon',
    amount,
    tx_date: '2026-06-15',
    billing_month: '2026-06',
    account_last4: '1234',
    category: null,
    status: 'pending',
    classified_by: null,
    batch_id: null,
    created_at: '2026-06-15T10:00:00Z',
    uploaded_by: null,
    ...overrides,
  } as Transaction
}

const transactions = [makeTx('a', 10), makeTx('b', 20), makeTx('c', 30)]

function renderModal(
  initialAssignments: CategoryAssignments,
  overrides: Partial<React.ComponentProps<typeof GroupedTransactionsModal>> = {},
) {
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(
    <GroupedTransactionsModal
      open
      merchantLabel="Amazon"
      transactions={transactions}
      initialAssignments={initialAssignments}
      categories={categories}
      allowLeaveInDeck
      accountAliases={new Map()}
      saving={false}
      onSave={onSave}
      onClose={onClose}
      {...overrides}
    />,
  )
  return { onSave, onClose }
}

const rowSelects = () => screen.getAllByRole('combobox', { name: /^Category for/ })
const saveButton = () => screen.getByRole('button', { name: /^Save|Saving/ })

describe('GroupedTransactionsModal', () => {
  it('starts every row on the group category when the stack was already classified', () => {
    // Arrange & Act
    renderModal({ a: 'food', b: 'food', c: 'food' })

    // Assert
    expect(rowSelects().map((s) => (s as HTMLSelectElement).value)).toEqual(['food', 'food', 'food'])
    expect(saveButton()).toHaveTextContent('Save 3 transactions')
  })

  it('shows an "Unassigned" start and disables save until something is chosen', () => {
    // Arrange & Act
    renderModal({ a: null, b: null, c: null })

    // Assert
    expect(rowSelects().every((s) => (s as HTMLSelectElement).value === '')).toBe(true)
    expect(saveButton()).toBeDisabled()
  })

  it('changes a single row and reports exactly that mix on save', async () => {
    // Arrange
    const { onSave } = renderModal({ a: 'food', b: 'food', c: 'food' })

    // Act
    await userEvent.selectOptions(rowSelects()[1]!, 'transport')
    await userEvent.click(saveButton())

    // Assert
    expect(onSave).toHaveBeenCalledWith({ a: 'food', b: 'transport', c: 'food' })
  })

  it('summarizes the current mix by category in the footer', async () => {
    // Arrange
    renderModal({ a: 'food', b: 'food', c: 'food' })

    // Act
    await userEvent.selectOptions(rowSelects()[2]!, 'transport')

    // Assert
    const summary = screen.getByLabelText('Summary by category')
    expect(within(summary).getByText(/2 × Food/)).toBeInTheDocument()
    expect(within(summary).getByText(/1 × Transport/)).toBeInTheDocument()
  })

  it('sets every row at once with the bulk control when nothing is selected', async () => {
    // Arrange
    const { onSave } = renderModal({ a: null, b: null, c: null })

    // Act
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Set category for selected transactions' }),
      'food',
    )
    await userEvent.click(saveButton())

    // Assert
    expect(onSave).toHaveBeenCalledWith({ a: 'food', b: 'food', c: 'food' })
  })

  it('applies the bulk category only to the selected rows', async () => {
    // Arrange
    const { onSave } = renderModal({ a: 'food', b: 'food', c: 'food' })

    // Act
    await userEvent.click(screen.getAllByRole('checkbox', { name: /^Select (?!all)/ })[0]!)
    await userEvent.click(screen.getAllByRole('checkbox', { name: /^Select (?!all)/ })[2]!)
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Set category for selected transactions' }),
      'transport',
    )
    await userEvent.click(saveButton())

    // Assert
    expect(onSave).toHaveBeenCalledWith({ a: 'transport', b: 'food', c: 'transport' })
  })

  it('lets rows stay in the deck and says how many', async () => {
    // Arrange
    renderModal({ a: null, b: null, c: null })

    // Act
    await userEvent.selectOptions(rowSelects()[0]!, 'food')

    // Assert
    expect(saveButton()).toHaveTextContent('Save 1, leave 2 in deck')
    expect(saveButton()).toBeEnabled()
  })

  it('requires every row to have a category and at least one change when leaving rows is not allowed', async () => {
    // Arrange
    const { onSave } = renderModal(
      { a: 'food', b: 'food', c: 'food' },
      { allowLeaveInDeck: false },
    )
    expect(saveButton()).toBeDisabled()

    // Act
    await userEvent.selectOptions(rowSelects()[0]!, 'transport')
    await userEvent.click(saveButton())

    // Assert
    expect(onSave).toHaveBeenCalledWith({ a: 'transport', b: 'food', c: 'food' })
  })

  it('does not offer "leave in deck" when leaving rows is not allowed', () => {
    // Arrange & Act
    renderModal({ a: 'food', b: 'food', c: 'food' }, { allowLeaveInDeck: false })

    // Assert
    expect(within(rowSelects()[0]!).queryByRole('option', { name: 'Leave in deck' })).not.toBeInTheDocument()
  })

  it('disables save while saving', () => {
    // Arrange & Act
    renderModal({ a: 'food', b: 'food', c: 'food' }, { saving: true })

    // Assert
    expect(saveButton()).toBeDisabled()
    expect(saveButton()).toHaveTextContent('Saving…')
  })

  it('closes from Cancel and Escape without saving', async () => {
    // Arrange
    const { onSave, onClose } = renderModal({ a: 'food', b: 'food', c: 'food' })

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.keyboard('{Escape}')

    // Assert
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('renders nothing when closed', () => {
    // Arrange & Act
    renderModal({ a: 'food', b: 'food', c: 'food' }, { open: false })

    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
