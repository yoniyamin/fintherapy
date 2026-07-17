import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import PasswordInput from '../common/PasswordInput'
import ScreenSurface from '../layout/ScreenSurface'
import { ui } from '../../lib/uiClasses'

/**
 * Supabase sends the user here via `redirectTo` with the recovery token in the
 * URL hash (e.g. `#access_token=...&type=recovery`).  Because our Supabase
 * client has `detectSessionInUrl: false` (PWA safety), we must manually extract
 * the tokens and exchange them so the user gets a valid session for
 * `updateUser`.
 */
async function exchangeHashTokenIfPresent(): Promise<boolean> {
  const hash = window.location.hash
  if (!hash) return false

  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (!accessToken || !refreshToken) return false

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  // Clean hash from URL without reload
  window.history.replaceState(null, '', window.location.pathname + window.location.search)

  return !error
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [ready, setReady] = useState(false)
  const [noToken, setNoToken] = useState(false)
  const { passwordRecoveryActive } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    exchangeHashTokenIfPresent().then((ok) => {
      if (cancelled) return
      if (ok || passwordRecoveryActive) {
        setReady(true)
      } else {
        setNoToken(true)
      }
    })
    return () => { cancelled = true }
  }, [passwordRecoveryActive])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setSubmitting(true)
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password })
      if (updateErr) throw updateErr
      await supabase.auth.signOut()
      navigate('/login?password_reset=success', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
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
              <div className="mx-auto mb-4 text-5xl">🔐</div>
              <h1 className="bg-gradient-to-r from-surface-50 via-ice to-gem-light bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
                New Password
              </h1>
              <p className="mt-1.5 text-sm text-surface-400">
                Choose a new password for your account.
              </p>
            </div>

            {noToken ? (
              <div className="space-y-4">
                <div className={ui.dangerBanner}>
                  This reset link is invalid or has expired. Please request a new one.
                </div>
                <p className="text-center text-sm text-surface-400">
                  <Link
                    to="/forgot-password"
                    className="font-semibold text-duo-green hover:text-duo-green-light"
                  >
                    Request new reset link
                  </Link>
                </p>
              </div>
            ) : !ready ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-duo-green/30 border-t-duo-green" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className={ui.dangerBanner}>{error}</div>}

                <div>
                  <label
                    htmlFor="new-password"
                    className="block text-sm font-medium text-surface-300"
                  >
                    New Password
                  </label>
                  <div className="mt-1.5">
                    <PasswordInput
                      id="new-password"
                      autoFocus
                      required
                      minLength={6}
                      value={password}
                      onChange={setPassword}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-sm font-medium text-surface-300"
                  >
                    Confirm Password
                  </label>
                  <div className="mt-1.5">
                    <PasswordInput
                      id="confirm-password"
                      required
                      minLength={6}
                      value={confirm}
                      onChange={(v) => setConfirm(v)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-4 py-3 text-sm font-bold text-white shadow-[0_14px_36px_-10px_rgba(88,204,2,0.45)] transition-all hover:brightness-110 active:translate-y-[1px] active:border-b disabled:opacity-50 disabled:shadow-none disabled:active:translate-y-0"
                >
                  {submitting ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </ScreenSurface>
  )
}
