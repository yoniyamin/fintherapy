import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from './LoginPage'
import { MockAuthProvider, defaultAuthContext } from '../../test/mock-auth'
import { MockRouter } from '../../test/mock-router'

vi.mock('../layout/ScreenSurface', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('../layout/OrganicBackdrop', () => ({
  default: () => null,
}))

function renderLogin(authOverrides: Partial<typeof defaultAuthContext> = {}) {
  return render(
    <MockRouter initialEntries={['/login']}>
      <MockAuthProvider value={authOverrides}>
        <LoginPage />
      </MockAuthProvider>
    </MockRouter>,
  )
}

describe('LoginPage', () => {
  it('renders email and password fields', () => {
    // Arrange & Act
    renderLogin()

    // Assert
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows forgot password link', () => {
    // Arrange & Act
    renderLogin()

    // Assert
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument()
  })

  it('shows sign up link', () => {
    // Arrange & Act
    renderLogin()

    // Assert
    expect(screen.getByText(/sign up/i)).toBeInTheDocument()
  })

  it('calls signIn with email and password on submit', async () => {
    // Arrange
    const signIn = vi.fn().mockResolvedValue({})
    renderLogin({ signIn })
    const user = userEvent.setup()

    // Act
    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'mypassword')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    // Assert
    expect(signIn).toHaveBeenCalledWith('test@example.com', 'mypassword')
  })

  it('shows submitting state while signing in', async () => {
    // Arrange
    let resolveSignIn: () => void
    const signIn = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => { resolveSignIn = resolve }),
    )
    renderLogin({ signIn })
    const user = userEvent.setup()

    // Act
    await user.type(screen.getByLabelText('Email'), 'a@b.com')
    await user.type(screen.getByLabelText('Password'), '123456')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    // Assert
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()

    // Cleanup
    resolveSignIn!()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
    })
  })

  it('displays error when signIn rejects', async () => {
    // Arrange
    const signIn = vi.fn().mockRejectedValue(new Error('Invalid credentials'))
    renderLogin({ signIn })
    const user = userEvent.setup()

    // Act
    await user.type(screen.getByLabelText('Email'), 'bad@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('shows session expired banner when sessionExpiredReason is set', () => {
    // Arrange & Act
    renderLogin({ sessionExpiredReason: 'Your session has expired' })

    // Assert
    expect(screen.getByText('Your session has expired')).toBeInTheDocument()
  })

  it('shows password reset success banner via search params', () => {
    // Arrange & Act
    render(
      <MockRouter initialEntries={['/login?password_reset=success']}>
        <MockAuthProvider>
          <LoginPage />
        </MockAuthProvider>
      </MockRouter>,
    )

    // Assert
    expect(screen.getByText(/password updated successfully/i)).toBeInTheDocument()
  })
})
