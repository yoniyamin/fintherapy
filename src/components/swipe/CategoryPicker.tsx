import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { DEFAULT_CATEGORIES, type CategoryDef } from '../../lib/constants'

interface CategoryPickerProps {
  open: boolean
  onSelect: (categoryId: string) => void
  onClose: () => void
  /** Resolved categories from useCategoryConfig; falls back to hard-coded defaults. */
  categories?: readonly CategoryDef[]
}

export default function CategoryPicker({ open, onSelect, onClose, categories }: CategoryPickerProps) {
  if (typeof document === 'undefined') return null

  const cats = categories ?? DEFAULT_CATEGORIES

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-x-0 bottom-0 z-[101] max-h-[min(85vh,calc(100vh-2rem))] overflow-y-auto rounded-t-[28px] border border-white/10 border-b-0 bg-surface-950/95 px-4 pt-3 shadow-[0_-24px_48px_-16px_rgba(0,0,0,0.5)] backdrop-blur-xl pb-[max(2.5rem,env(safe-area-inset-bottom))]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />

            <h3 className="mb-4 text-center text-base font-bold text-surface-50">
              Pick a Category
            </h3>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {cats.map((cat, i) => (
                <motion.button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelect(cat.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-all active:scale-95 ${cat.color}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="text-[11px] font-semibold text-surface-200">{cat.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
