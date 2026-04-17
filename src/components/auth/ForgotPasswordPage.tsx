import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import ScreenSurface from '../layout/ScreenSurface'
import { ui } from '../../lib/uiClasses'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo: `${window.location.origin}/reset-password` },
      )
      if (resetErr) throw resetErr
      setSent(true)
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
              <div className="mx-auto mb-4 text-5xl">🔑</div>
              <h1 className="bg-gradient-to-r from-surface-50 via-ice to-gem-light bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
                Reset Password
              </h1>
              <p className="mt-1.5 text-sm text-surface-400">
                Enter your email and we&apos;ll send a reset link.
              </p>
            </div>

            {sent ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-duo-green/30 bg-duo-green/10 px-4 py-3 text-sm font-medium text-duo-green">
                  If an account exists with that email, you&apos;ll receive a password reset link
                  shortly. Check your inbox (and spam folder).
                </div>
                <p className="text-center text-sm text-surface-400">
                  <Link
                    to="/login"
                    className="font-semibold text-duo-green hover:text-duo-green-light"
                  >
                    Back to sign in
                  </Link>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className={ui.dangerBanner}>{error}</div>}

                <div>
                  <label
                    htmlFor="reset-email"
                    className="block text-sm font-medium text-surface-300"
                  >
                    Email
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`mt-1.5 block w-full ${ui.input}`}
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-4 py-3 text-sm font-bold text-white shadow-[0_14px_36px_-10px_rgba(88,204,2,0.45)] transition-all hover:brightness-110 active:translate-y-[1px] active:border-b disabled:opacity-50 disabled:shadow-none disabled:active:translate-y-0"
                >
                  {submitting ? 'Sending...' : 'Send Reset Link'}
                </button>

                <p className="text-center text-sm text-surface-400">
                  <Link
                    to="/login"
                    className="font-semibold text-duo-green hover:text-duo-green-light"
                  >
                    Back to sign in
                  </Link>
                </p>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </ScreenSurface>
  )
}
