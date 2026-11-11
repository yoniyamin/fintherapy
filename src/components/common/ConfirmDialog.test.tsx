import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmDialog from './ConfirmDialog'

function renderDialog(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      open
      title="Undo split?"
      message="This discards your choices."
      confirmLabel="Undo it"
      cancelLabel="Keep it"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  )
  return { onConfirm, onCancel }
}

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    // Arrange & Act
    renderDialog({ open: false })

    // Assert
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('shows the title and message in an accessible dialog', () => {
    // Arrange & Act
    renderDialog()

    // Assert
    const dialog = screen.getByRole('alertdialog', { name: 'Undo split?' })
    expect(dialog).toHaveAccessibleDescription('This discards your choices.')
  })

  it('calls onConfirm only when the confirm button is clicked', async () => {
    // Arrange
    const { onConfirm, onCancel } = renderDialog()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Undo it' }))

    // Assert
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('cancels from the cancel button, the backdrop, and Escape', async () => {
    // Arrange
    const { onConfirm, onCancel } = renderDialog()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('alertdialog').parentElement!)

    // Assert
    expect(onCancel).toHaveBeenCalledTimes(3)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('does not cancel when clicking inside the dialog', async () => {
    // Arrange
    const { onCancel } = renderDialog()

    // Act
    await userEvent.click(screen.getByText('This discards your choices.'))

    // Assert
    expect(onCancel).not.toHaveBeenCalled()
  })
})
