import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import PasswordInput from '../common/PasswordInput'
import ScreenSurface from '../layout/ScreenSurface'
import { ui } from '../../lib/uiClasses'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { signIn, user, sessionExpiredReason, clearSessionExpired } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const passwordReset = searchParams.get('password_reset') === 'success'

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    return () => { clearSessionExpired() }
  }, [clearSessionExpired])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    clearSessionExpired()
    setSubmitting(true)
    try {
      await signIn(email, password)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScreenSurface>
      <div className="flex min-h-full items-center justify-center px-6 py-12">
        <motion.div
          className="w-full max-w-sm"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 20 }}
        >
          <div className={`${ui.glass} space-y-8 px-7 py-9`}>
            <div className="text-center">
              <motion.div
                className="mx-auto mb-4 text-5xl drop-shadow-[0_8px_24px_rgba(165,96,232,0.25)]"
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
              >
                🃏
              </motion.div>
              <h1 className="bg-gradient-to-r from-surface-50 via-ice to-gem-light bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
                Financial Therapy
              </h1>
              <p className="mt-1.5 text-sm text-surface-400">Welcome back! Time for your session.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {sessionExpiredReason && (
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-300">
                  {sessionExpiredReason}
                </div>
              )}

              {passwordReset && (
                <div className="rounded-xl border border-duo-green/30 bg-duo-green/10 px-4 py-3 text-sm font-medium text-duo-green">
                  Password updated successfully. Sign in with your new password.
                </div>
              )}

              {error && <div className={ui.dangerBanner}>{error}</div>}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-surface-300">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoFocus
                  required
                  disabled={submitting}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`mt-1.5 block w-full disabled:opacity-60 ${ui.input}`}
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-surface-300">
                  Password
                </label>
                <div className="mt-1.5">
                  <PasswordInput
                    id="password"
                    required
                    disabled={submitting}
                    value={password}
                    onChange={setPassword}
                  />
                </div>
                <div className="mt-1.5 text-right">
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-surface-400 transition-colors hover:text-surface-200"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-4 py-3 text-sm font-bold text-white shadow-[0_14px_36px_-10px_rgba(88,204,2,0.45)] transition-all hover:brightness-110 active:translate-y-[1px] active:border-b disabled:opacity-50 disabled:shadow-none disabled:active:translate-y-0"
              >
                {submitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-sm text-surface-400">
              Don&apos;t have an account?{' '}
              <Link to="/signup" className="font-semibold text-duo-green hover:text-duo-green-light">
                Sign up
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </ScreenSurface>
  )
}
