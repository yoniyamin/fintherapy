import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Profile } from '../../types/database'
import ScreenSurface from '../layout/ScreenSurface'
import { ui } from '../../lib/uiClasses'

type Mode = 'choice' | 'create' | 'join'

export default function HouseholdSetupPage() {
  const [mode, setMode] = useState<Mode>('choice')
  const { user, signOut, refreshProfile } = useAuth()

  return (
    <ScreenSurface>
      <div className="flex min-h-full items-center justify-center px-6 py-12">
        <motion.div
          className="w-full max-w-sm space-y-8"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 20 }}
        >
          <div className={`${ui.glass} space-y-6 px-7 py-8`}>
            <div className="text-center">
              <div className="mx-auto mb-4 text-5xl drop-shadow-[0_10px_28px_rgba(88,204,2,0.2)]">🏠</div>
              <h1 className="bg-gradient-to-r from-surface-50 via-ice to-gem-light bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
                Financial Therapy
              </h1>
              <p className="mt-1.5 text-sm text-surface-400">Set up your household to start playing</p>
            </div>

            {mode === 'choice' && (
              <div className="space-y-3">
                <motion.button
                  onClick={() => setMode('create')}
                  className="flex w-full items-center gap-4 rounded-2xl border border-white/[0.08] bg-surface-950/50 p-4 text-left shadow-[0_16px_40px_-18px_rgba(88,204,2,0.25)] transition-[transform,opacity,background-color] duration-150 hover:bg-surface-900/55 active:scale-[0.98]"
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-duo-green/15 text-2xl">
                    🏠
                  </span>
                  <div>
                    <p className="text-sm font-bold text-surface-50">Create a Household</p>
                    <p className="text-xs text-surface-400">
                      Start fresh and invite your partner
                    </p>
                  </div>
                </motion.button>

                <motion.button
                  onClick={() => setMode('join')}
                  className="flex w-full items-center gap-4 rounded-2xl border border-white/[0.08] bg-surface-950/50 p-4 text-left shadow-[0_16px_40px_-18px_rgba(165,96,232,0.28)] transition-[transform,opacity,background-color] duration-150 hover:bg-surface-900/55 active:scale-[0.98]"
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gem/15 text-2xl">
                    🔗
                  </span>
                  <div>
                    <p className="text-sm font-bold text-surface-50">Join a Household</p>
                    <p className="text-xs text-surface-400">
                      Enter an invite code from your partner
                    </p>
                  </div>
                </motion.button>
              </div>
            )}

            {mode === 'create' && user && (
              <CreateHouseholdForm
                onBack={() => setMode('choice')}
                refreshProfile={refreshProfile}
              />
            )}

            {mode === 'join' && user && (
              <JoinHouseholdForm
                onBack={() => setMode('choice')}
                refreshProfile={refreshProfile}
              />
            )}
          </div>

          <button
            type="button"
            onClick={signOut}
            className="block w-full text-center text-xs font-medium text-surface-500 transition-colors hover:text-surface-300"
          >
            Sign out
          </button>
        </motion.div>
      </div>
    </ScreenSurface>
  )
}

function CreateHouseholdForm({
  onBack,
  refreshProfile,
}: {
  onBack: () => void
  refreshProfile: (options?: { untilHouseholdId?: boolean }) => Promise<unknown>
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const { error: rpcErr } = await supabase.rpc('create_household', {
        p_name: name.trim(),
      })

      if (rpcErr) throw new Error(rpcErr.message)

      const profile = (await refreshProfile({ untilHouseholdId: true })) as Profile | null
      if (!profile?.household_id) {
        setError(
          'Household was created, but your profile did not update yet. Refresh the page and try again.',
        )
        return
      }
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className={ui.dangerBanner}>{error}</div>}

      <div>
        <label htmlFor="hh-name" className="block text-sm font-medium text-surface-300">
          Household Name
        </label>
        <input
          id="hh-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`mt-1.5 block w-full ${ui.input}`}
          placeholder="The Johnsons"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-white/[0.08] bg-surface-800/80 px-5 py-2.5 text-sm font-bold text-surface-50 transition-colors hover:bg-surface-700/90"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_32px_-10px_rgba(88,204,2,0.4)] transition-[transform,opacity,filter] duration-150 active:scale-[0.97] disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create'}
        </button>
      </div>
    </form>
  )
}

function JoinHouseholdForm({
  onBack,
  refreshProfile,
}: {
  onBack: () => void
  refreshProfile: (options?: { untilHouseholdId?: boolean }) => Promise<unknown>
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const { error: rpcErr } = await supabase.rpc('join_household_by_code', {
        p_invite_code: code.trim(),
      })

      if (rpcErr) throw new Error(rpcErr.message)

      const profile = (await refreshProfile({ untilHouseholdId: true })) as Profile | null
      if (!profile?.household_id) {
        setError(
          'Joined successfully, but your profile did not update yet. Refresh the page and try again.',
        )
        return
      }
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className={ui.dangerBanner}>{error}</div>}

      <div>
        <label htmlFor="invite-code" className="block text-sm font-medium text-surface-300">
          Invite Code
        </label>
        <input
          id="invite-code"
          type="text"
          required
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className={`mt-1.5 block w-full text-center font-mono text-lg font-bold tracking-[0.3em] ${ui.input}`}
          placeholder="ABC123"
          maxLength={8}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-white/[0.08] bg-surface-800/80 px-5 py-2.5 text-sm font-bold text-surface-50 transition-colors hover:bg-surface-700/90"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={submitting || code.trim().length === 0}
          className="flex-1 rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_32px_-10px_rgba(88,204,2,0.4)] transition-[transform,opacity,filter] duration-150 active:scale-[0.97] disabled:opacity-50"
        >
          {submitting ? 'Joining...' : 'Join'}
        </button>
      </div>
    </form>
  )
}
