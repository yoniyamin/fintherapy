import { motion, AnimatePresence } from 'framer-motion'
import { CATEGORIES } from '../../lib/constants'

interface CategoryPickerProps {
  open: boolean
  onSelect: (categoryId: string) => void
  onClose: () => void
}

export default function CategoryPicker({ open, onSelect, onClose }: CategoryPickerProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] border border-white/10 border-b-0 bg-surface-950/95 px-4 pb-10 pt-3 shadow-[0_-24px_48px_-16px_rgba(0,0,0,0.5)] backdrop-blur-xl"
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
              {CATEGORIES.map((cat, i) => (
                <motion.button
                  key={cat.id}
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
    </AnimatePresence>
  )
}
