import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { DEFAULT_CATEGORIES, type CategoryDef } from '../../lib/constants'
import { buildCategoryPickerLayout } from '../../lib/categoryPickerLayout'
import CategoryIcon from '../common/CategoryIcon'
import { useBottomSheetDrag } from '../../hooks/useBottomSheetDrag'

interface CategoryPickerProps {
  open: boolean
  onSelect: (categoryId: string) => void
  onClose: () => void
  categories?: readonly CategoryDef[]
  predictedCategory?: string | null
  currentCategory?: string | null
  merchantRaw?: string | null
  merchantClean?: string | null
}

const NEUTRAL_TILE =
  'border-white/[0.08] bg-surface-800/80 hover:border-white/[0.14] hover:bg-surface-700/80'

const SELECT_FEEDBACK_MS = 90

export default function CategoryPicker({
  open,
  onSelect,
  onClose,
  categories,
  predictedCategory,
  currentCategory,
  merchantRaw,
  merchantClean,
}: CategoryPickerProps) {
  if (typeof document === 'undefined') return null

  const cats = categories ?? DEFAULT_CATEGORIES

  return createPortal(
    <AnimatePresence>
      {open && (
        <CategoryPickerInner
          cats={cats}
          onSelect={onSelect}
          onClose={onClose}
          predictedCategory={predictedCategory}
          currentCategory={currentCategory}
          merchantRaw={merchantRaw}
          merchantClean={merchantClean}
        />
      )}
    </AnimatePresence>,
    document.body,
  )
}

function CategoryPickerInner({
  cats,
  onSelect,
  onClose,
  predictedCategory,
  currentCategory,
  merchantRaw,
  merchantClean,
}: {
  cats: readonly CategoryDef[]
  onSelect: (id: string) => void
  onClose: () => void
  predictedCategory?: string | null
  currentCategory?: string | null
  merchantRaw?: string | null
  merchantClean?: string | null
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const selectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showScrollFade, setShowScrollFade] = useState(false)
  const [pressedId, setPressedId] = useState<string | null>(null)
  const { sheetDragProps, handleZoneProps } = useBottomSheetDrag(onClose)

  const layout = useMemo(
    () =>
      buildCategoryPickerLayout({
        categories: cats,
        predictedCategory,
        currentCategory,
        merchantRaw,
        merchantClean,
      }),
    [cats, predictedCategory, currentCategory, merchantRaw, merchantClean],
  )

  const updateScrollFade = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const canScroll = el.scrollHeight > el.clientHeight + 2
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 6
    setShowScrollFade(canScroll && !atBottom)
  }, [])

  useEffect(() => {
    updateScrollFade()
    const el = scrollRef.current
    if (!el) return

    el.addEventListener('scroll', updateScrollFade, { passive: true })
    const observer = new ResizeObserver(updateScrollFade)
    observer.observe(el)

    return () => {
      el.removeEventListener('scroll', updateScrollFade)
      observer.disconnect()
    }
  }, [layout, updateScrollFade])

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }

      if (e.key !== 'Tab' || !panelRef.current) return
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return

      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    requestAnimationFrame(() => {
      const firstBtn = panelRef.current?.querySelector<HTMLElement>('button')
      firstBtn?.focus()
    })

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previousFocusRef.current?.focus()
      if (selectTimerRef.current) clearTimeout(selectTimerRef.current)
      setPressedId(null)
    }
  }, [onClose])

  const handleSelect = useCallback(
    (categoryId: string) => {
      if (pressedId) return
      setPressedId(categoryId)
      if (selectTimerRef.current) clearTimeout(selectTimerRef.current)
      selectTimerRef.current = setTimeout(() => {
        onSelect(categoryId)
        setPressedId(null)
      }, SELECT_FEEDBACK_MS)
    },
    [onSelect, pressedId],
  )

  let tileIndex = 0

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden
      />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Pick a Category"
        className="fixed inset-x-0 bottom-0 z-[101] flex max-h-[min(78vh,calc(100vh-2rem))] flex-col overflow-hidden rounded-t-[28px] border border-white/10 border-b-0 bg-surface-950/95 px-3 pt-2 shadow-[0_-24px_48px_-16px_rgba(0,0,0,0.5)] backdrop-blur-xl pb-[max(1rem,env(safe-area-inset-bottom))]"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        {...sheetDragProps}
      >
        <div {...handleZoneProps()}>
          <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-white/20" />

          <h3 id="category-picker-title" className="mb-2 shrink-0 text-center text-sm font-bold text-surface-50">
            Pick a Category
          </h3>
        </div>

        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            className="h-full overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
          >
            <div className="pb-1" role="listbox" aria-labelledby="category-picker-title">
              {layout.suggested.length > 0 && (
                <section aria-label="Suggested categories" className="mb-2">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-surface-500">
                    Suggested
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {layout.suggested.map((cat) => {
                      const index = tileIndex++
                      return (
                        <CategoryTile
                          key={`suggested-${cat.id}`}
                          cat={cat}
                          onSelect={handleSelect}
                          animationIndex={index}
                          pressed={pressedId === cat.id}
                        />
                      )
                    })}
                  </div>
                  <div className="mt-2 border-t border-white/[0.08]" aria-hidden />
                </section>
              )}

              {layout.grid.length > 0 && (
                <section aria-label="All categories" className="pt-0.5">
                  <div className="grid grid-cols-3 gap-1.5">
                    {layout.grid.map((cat) => {
                      const index = tileIndex++
                      return (
                        <CategoryTile
                          key={cat.id}
                          cat={cat}
                          onSelect={handleSelect}
                          animationIndex={index}
                          pressed={pressedId === cat.id}
                        />
                      )
                    })}
                  </div>
                </section>
              )}
            </div>
          </div>

          <div
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface-950 via-surface-950/80 to-transparent transition-opacity duration-200 ${
              showScrollFade ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      </motion.div>
    </>
  )
}

function CategoryTile({
  cat,
  onSelect,
  animationIndex,
  pressed = false,
}: {
  cat: CategoryDef
  onSelect: (id: string) => void
  animationIndex: number
  pressed?: boolean
}) {
  const [highlighted, setHighlighted] = useState(false)
  const showAccent = pressed || highlighted

  const baseClass = showAccent ? cat.color : NEUTRAL_TILE
  const pressRing = pressed ? 'ring-2 ring-duo-green/50' : ''

  return (
    <motion.button
      type="button"
      role="option"
      aria-selected={false}
      onClick={() => onSelect(cat.id)}
      onPointerEnter={() => setHighlighted(true)}
      onPointerLeave={() => setHighlighted(false)}
      onPointerDown={() => setHighlighted(true)}
      onPointerUp={() => !pressed && setHighlighted(false)}
      onPointerCancel={() => setHighlighted(false)}
      disabled={pressed}
      className={`flex min-h-[3.75rem] flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1.5 transition-colors duration-100 ${baseClass} ${pressRing}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, scale: pressed ? 0.92 : 1 }}
      transition={{
        opacity: { delay: animationIndex * 0.015 },
        y: { delay: animationIndex * 0.015 },
        scale: { duration: 0.08, ease: 'easeOut' },
      }}
      whileTap={{ scale: 0.92 }}
    >
      <CategoryIcon categoryId={cat.id} emoji={cat.icon} size="md" />
      <span className="line-clamp-2 text-center text-[10px] font-semibold leading-tight text-surface-200">
        {cat.label}
      </span>
    </motion.button>
  )
}
