import { useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { APP_VERSION } from '../../lib/appVersion'
import { ui } from '../../lib/uiClasses'
import PasswordInput from '../common/PasswordInput'

export default function SettingsPage() {
  const { profile, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [savingName, setSavingName] = useState(false)
  const [nameSuccess, setNameSuccess] = useState(false)

  const [householdName, setHouseholdName] = useState('')
  const [householdNameLoaded, setHouseholdNameLoaded] = useState(false)
  const [savingHousehold, setSavingHousehold] = useState(false)
  const [householdSuccess, setHouseholdSuccess] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!householdNameLoaded && profile?.household_id) {
    void supabase
      .rpc('get_household_info', { p_household_id: profile.household_id })
      .then(({ data }) => {
        const rows = data as { name: string }[] | null
        if (rows?.[0]) setHouseholdName(rows[0].name)
        setHouseholdNameLoaded(true)
      })
  }

  const handleSaveName = async (e: FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) return
    setSavingName(true)
    setError(null)
    const { error: rpcErr } = await supabase.rpc('update_display_name', {
      p_name: displayName.trim(),
    })
    setSavingName(false)
    if (rpcErr) {
      setError(rpcErr.message)
      return
    }
    await refreshProfile()
    setNameSuccess(true)
    setTimeout(() => setNameSuccess(false), 2000)
  }

  const handleSaveHouseholdName = async (e: FormEvent) => {
    e.preventDefault()
    if (!householdName.trim() || !profile?.household_id) return
    setSavingHousehold(true)
    setError(null)
    const { error: rpcErr } = await supabase.rpc('update_household_name', {
      p_household_id: profile.household_id,
      p_name: householdName.trim(),
    })
    setSavingHousehold(false)
    if (rpcErr) {
      setError(rpcErr.message)
      return
    }
    setHouseholdSuccess(true)
    setTimeout(() => setHouseholdSuccess(false), 2000)
  }

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }
    setSavingPassword(true)
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (updateErr) {
      setPasswordError(updateErr.message)
      return
    }
    setNewPassword('')
    setConfirmPassword('')
    setPasswordSuccess(true)
    setTimeout(() => setPasswordSuccess(false), 3000)
  }

  const handleLeave = async () => {
    if (!profile?.household_id) return
    setError(null)
    const { error: rpcErr } = await supabase.rpc('leave_household', {
      p_household_id: profile.household_id,
    })
    if (rpcErr) {
      setError(rpcErr.message)
      return
    }
    await refreshProfile()
    navigate('/household', { replace: true })
  }

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className={`${ui.screen} ${ui.page}`}>
      <h1 className={ui.heroTitle}>
        Settings
      </h1>

      <AnimatePresence>
        {error && (
          <motion.div
            className="mt-4 rounded-xl border border-flame/20 bg-flame/10 p-3 text-center text-sm font-semibold text-flame"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <section
        className="mt-6 space-y-6"
      >
        <form onSubmit={handleSaveName} className={`space-y-3 p-4 ${ui.glassFlat}`}>
          <h2 className="text-sm font-semibold text-surface-300">Display Name</h2>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={`w-full ${ui.input}`}
            required
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingName || !displayName.trim()}
              className="rounded-xl bg-duo-green px-4 py-2 text-sm font-bold text-white transition-[transform,opacity,filter] duration-150 hover:brightness-110 disabled:opacity-50"
            >
              {savingName ? 'Saving...' : 'Save'}
            </button>
            {nameSuccess && <span className="text-xs font-medium text-duo-green">Saved!</span>}
          </div>
        </form>

        {profile?.household_id && (
          <form onSubmit={handleSaveHouseholdName} className={`space-y-3 p-4 ${ui.glassFlat}`}>
            <h2 className="text-sm font-semibold text-surface-300">Household Name</h2>
            <input
              type="text"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              className={`w-full ${ui.input}`}
              required
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={savingHousehold || !householdName.trim()}
                className="rounded-xl bg-duo-green px-4 py-2 text-sm font-bold text-white transition-[transform,opacity,filter] duration-150 hover:brightness-110 disabled:opacity-50"
              >
                {savingHousehold ? 'Saving...' : 'Save'}
              </button>
              {householdSuccess && <span className="text-xs font-medium text-duo-green">Saved!</span>}
            </div>
          </form>
        )}

        <form onSubmit={handleChangePassword} className={`space-y-3 p-4 ${ui.glassFlat}`}>
          <h2 className="text-sm font-semibold text-surface-300">Change Password</h2>
          <PasswordInput
            id="settings-new-pw"
            value={newPassword}
            onChange={setNewPassword}
            placeholder="New password"
            minLength={6}
          />
          <PasswordInput
            id="settings-confirm-pw"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Confirm password"
            minLength={6}
          />
          <AnimatePresence>
            {passwordError && (
              <motion.p
                className="text-xs font-medium text-flame"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {passwordError}
              </motion.p>
            )}
            {passwordSuccess && (
              <motion.p
                className="text-xs font-medium text-duo-green"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Password updated!
              </motion.p>
            )}
          </AnimatePresence>
          <button
            type="submit"
            disabled={savingPassword || !newPassword || !confirmPassword}
            className="rounded-xl bg-duo-green px-4 py-2 text-sm font-bold text-white transition-[transform,opacity,filter] duration-150 hover:brightness-110 disabled:opacity-50"
          >
            {savingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        {profile?.household_id && (
          <div className={`space-y-3 p-4 ${ui.glassFlat}`}>
            <h2 className="text-sm font-semibold text-surface-300">Leave Household</h2>
            <p className="text-xs text-surface-500">
              Your data will remain in the household. You can rejoin with an invite code.
            </p>
            {!confirmLeave ? (
              <button
                type="button"
                onClick={() => setConfirmLeave(true)}
                className="rounded-xl border border-flame/30 bg-flame/10 px-4 py-2 text-sm font-bold text-flame transition-[transform,opacity,background-color] duration-150 hover:bg-flame/20"
              >
                Leave Household
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleLeave}
                  className="rounded-xl bg-flame px-4 py-2 text-sm font-bold text-white"
                >
                  Confirm Leave
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmLeave(false)}
                  className="rounded-xl border border-surface-600/60 bg-surface-800/50 px-4 py-2 text-sm font-semibold text-surface-300"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        <div className={`space-y-3 p-4 ${ui.glassFlat}`}>
          {!confirmSignOut ? (
            <button
              type="button"
              onClick={() => setConfirmSignOut(true)}
              className="w-full rounded-xl border border-surface-600/60 bg-surface-800/50 px-4 py-2.5 text-sm font-semibold text-surface-300 transition-colors hover:bg-surface-800"
            >
              Sign Out
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-center text-xs text-surface-400">Sign out of your account?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex-1 rounded-xl bg-flame px-4 py-2 text-sm font-bold text-white"
                >
                  Sign Out
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmSignOut(false)}
                  className="flex-1 rounded-xl border border-surface-600/60 bg-surface-800/50 px-4 py-2 text-sm font-semibold text-surface-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-surface-500">Version {APP_VERSION}</p>
      </section>
    </div>
  )
}
