import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDialogFocus } from '../../hooks/useDialogFocus'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/** Centered confirmation modal for destructive actions; Escape and backdrop click cancel. */
export default function ConfirmDialog({ open, ...rest }: ConfirmDialogProps) {
  if (!open || typeof document === 'undefined') return null
  return createPortal(<ConfirmDialogInner {...rest} />, document.body)
}

function ConfirmDialogInner({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: Omit<ConfirmDialogProps, 'open'>) {
  const panelRef = useRef<HTMLDivElement>(null)
  useDialogFocus(panelRef, onCancel)

  return (
    <div
      className="fixed inset-0 left-[var(--shell-nav-offset)] z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface-950 p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="text-sm font-bold text-surface-50">
          {title}
        </h3>
        <p id="confirm-dialog-message" className="mt-2 text-xs leading-relaxed text-surface-400">
          {message}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-lg px-3 py-2 text-sm text-surface-400" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="rounded-lg border border-flame/40 bg-flame/15 px-3 py-2 text-sm font-semibold text-flame hover:bg-flame/25"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
