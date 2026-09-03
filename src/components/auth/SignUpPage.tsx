import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import PasswordInput from '../common/PasswordInput'
import ScreenSurface from '../layout/ScreenSurface'
import { ui } from '../../lib/uiClasses'

export default function SignUpPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { signUp, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)
    try {
      const data = await signUp(email, password, displayName) as {
        user: { id: string } | null
        session: unknown
      }
      if (data?.user && !data.session) {
        setSuccess(
          'Account created! Check your email to confirm, then sign in.',
        )
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
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
                className="mx-auto mb-4 text-5xl drop-shadow-[0_8px_24px_rgba(28,176,246,0.25)]"
                animate={{ rotate: [0, -5, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              >
                🎴
              </motion.div>
              <h1 className="bg-gradient-to-r from-surface-50 via-ice to-gem-light bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
                Financial Therapy
              </h1>
              <p className="mt-1.5 text-sm text-surface-400">Join the crew! Let&apos;s gamify your finances.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className={ui.dangerBanner}>
                  {error}
                  {error.includes('already exists') && (
                    <>
                      {' '}
                      <Link to="/login" className="underline font-semibold">
                        Sign in
                      </Link>
                    </>
                  )}
                </div>
              )}

              {success && (
                <div className="rounded-xl border border-duo-green/30 bg-duo-green/10 px-4 py-3 text-sm font-medium text-duo-green">
                  {success}{' '}
                  <Link to="/login" className="underline font-semibold">
                    Go to sign in
                  </Link>
                </div>
              )}

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-surface-300">
                  Display Name
                </label>
                <input
                  id="name"
                  type="text"
                  autoFocus
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={`mt-1.5 block w-full ${ui.input}`}
                  placeholder="Alex"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-surface-300">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`mt-1.5 block w-full ${ui.input}`}
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
                    minLength={6}
                    value={password}
                    onChange={setPassword}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !!success}
                className="w-full rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-4 py-3 text-sm font-bold text-white shadow-[0_14px_36px_-10px_rgba(88,204,2,0.45)] transition-[transform,opacity,filter] duration-150 hover:brightness-110 active:scale-[0.97] disabled:opacity-50 disabled:shadow-none disabled:active:scale-100"
              >
                {submitting ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            <p className="text-center text-sm text-surface-400">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-duo-green hover:text-duo-green-light">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </ScreenSurface>
  )
}
