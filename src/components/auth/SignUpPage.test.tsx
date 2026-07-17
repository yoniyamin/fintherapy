import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignUpPage from './SignUpPage'
import { MockAuthProvider, defaultAuthContext } from '../../test/mock-auth'
import { MockRouter } from '../../test/mock-router'

vi.mock('../layout/ScreenSurface', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('../layout/OrganicBackdrop', () => ({
  default: () => null,
}))

function renderSignUp(authOverrides: Partial<typeof defaultAuthContext> = {}) {
  return render(
    <MockRouter initialEntries={['/signup']}>
      <MockAuthProvider value={authOverrides}>
        <SignUpPage />
      </MockAuthProvider>
    </MockRouter>,
  )
}

describe('SignUpPage', () => {
  it('renders display name, email, and password fields', () => {
    // Arrange & Act
    renderSignUp()

    // Assert
    expect(screen.getByLabelText('Display Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('shows sign in link', () => {
    // Arrange & Act
    renderSignUp()

    // Assert
    expect(screen.getByText(/sign in/i)).toBeInTheDocument()
  })

  it('calls signUp with display name, email and password', async () => {
    // Arrange
    const signUp = vi.fn().mockResolvedValue({ user: { id: '1' }, session: {} })
    renderSignUp({ signUp })
    const user = userEvent.setup()

    // Act
    await user.type(screen.getByLabelText('Display Name'), 'Alex')
    await user.type(screen.getByLabelText('Email'), 'alex@example.com')
    await user.type(screen.getByLabelText('Password'), 'secure123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    // Assert
    expect(signUp).toHaveBeenCalledWith('alex@example.com', 'secure123', 'Alex')
  })

  it('shows email confirmation message when user created without session', async () => {
    // Arrange
    const signUp = vi.fn().mockResolvedValue({ user: { id: '1' }, session: null })
    renderSignUp({ signUp })
    const user = userEvent.setup()

    // Act
    await user.type(screen.getByLabelText('Display Name'), 'Alex')
    await user.type(screen.getByLabelText('Email'), 'alex@example.com')
    await user.type(screen.getByLabelText('Password'), 'secure123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument()
    })
  })

  it('shows submitting state while creating account', async () => {
    // Arrange
    let resolveSignUp: () => void
    const signUp = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => { resolveSignUp = resolve }),
    )
    renderSignUp({ signUp })
    const user = userEvent.setup()

    // Act
    await user.type(screen.getByLabelText('Display Name'), 'Test')
    await user.type(screen.getByLabelText('Email'), 'a@b.com')
    await user.type(screen.getByLabelText('Password'), '123456')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    // Assert
    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled()

    // Cleanup
    resolveSignUp!()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create account/i })).not.toBeDisabled()
    })
  })

  it('displays error when signUp rejects', async () => {
    // Arrange
    const signUp = vi.fn().mockRejectedValue(new Error('Email already exists'))
    renderSignUp({ signUp })
    const user = userEvent.setup()

    // Act
    await user.type(screen.getByLabelText('Display Name'), 'Test')
    await user.type(screen.getByLabelText('Email'), 'existing@example.com')
    await user.type(screen.getByLabelText('Password'), 'pass123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument()
    })
  })

  it('shows sign in link alongside "already exists" error', async () => {
    // Arrange
    const signUp = vi.fn().mockRejectedValue(new Error('Email already exists'))
    renderSignUp({ signUp })
    const user = userEvent.setup()

    // Act
    await user.type(screen.getByLabelText('Display Name'), 'Test')
    await user.type(screen.getByLabelText('Email'), 'existing@example.com')
    await user.type(screen.getByLabelText('Password'), 'pass123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    // Assert
    await waitFor(() => {
      const errorBanner = screen.getByText(/email already exists/i).closest('div')
      expect(errorBanner?.querySelector('a[href="/login"]')).toBeInTheDocument()
    })
  })
})
