import { createPortal } from 'react-dom'
import { ui } from '../../lib/uiClasses'
import type { AccountType } from '../../types/database'

export type AccountCardEditDraft = {
  last4: string
  label: string
  accountType: AccountType | null
}

type Props = {
  draft: AccountCardEditDraft | null
  onChange: (next: AccountCardEditDraft) => void
  onClose: () => void
  onSave: () => void
}

export function AccountCardEditModal({ draft, onChange, onClose, onSave }: Props) {
  if (!draft) return null

  return createPortal(
    <div
      className="fixed inset-0 left-[var(--shell-nav-offset)] z-[10000] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-card-edit-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface-950 p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="account-card-edit-title" className="text-xs text-surface-500">
          Edit card ···{draft.last4}
        </p>
        <input
          value={draft.label}
          onChange={(e) => onChange({ ...draft, label: e.target.value })}
          placeholder="Display name (e.g. Yonatan)"
          className={`mt-2 w-full ${ui.input}`}
          autoFocus
        />
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-surface-400">Card type</p>
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-surface-900/60 p-1 ring-1 ring-white/[0.06]">
            {(['credit', 'debit', null] as const).map((opt) => {
              const active = draft.accountType === opt
              const label = opt === null ? 'Unknown' : opt === 'credit' ? 'Credit' : 'Debit'
              return (
                <button
                  key={String(opt)}
                  type="button"
                  onClick={() => onChange({ ...draft, accountType: opt })}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? opt === 'debit'
                        ? 'bg-ice/20 text-ice'
                        : opt === 'credit'
                          ? 'bg-duo-green/15 text-duo-green'
                          : 'bg-surface-700/70 text-surface-200'
                      : 'text-surface-500 hover:bg-white/[0.04]'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {draft.accountType === 'debit' && (
            <p className="mt-2 text-[11px] leading-snug text-surface-500">
              Future uploads on this card will auto-mark positive-amount loads as own-account transfers.
            </p>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-lg px-3 py-2 text-sm text-surface-400" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-duo-green px-4 py-2 text-sm font-bold text-white"
            onClick={() => onSave()}
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
