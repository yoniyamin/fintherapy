import { useCallback, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { useCategoryConfig } from '../../hooks/useCategoryConfig'
import { formatBillingMonthLabel } from '../../lib/classifyDeckScope'
import type { MerchantGroup } from '../../stores/classificationStore'
import type { Transaction } from '../../types/database'
import ProgressBar from '../common/ProgressBar'
import CategoryIcon from '../common/CategoryIcon'
import CategoryEditorModal from '../settings/CategoryEditorModal'
import CategoryPicker from '../swipe/CategoryPicker'
import SwipeCard from '../swipe/SwipeCard'

type DeckMode = 'pending' | 'no-idea'

const MOCK_USER_ID = 'dev-user'
const MOCK_BILLING_MONTH = '2026-06'
const MOCK_PREDICTION = 'food_groceries'

/** Builds a mock transaction row for the classify sandbox. */
function makeMockTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: crypto.randomUUID(),
    uploaded_by: MOCK_USER_ID,
    merchant_raw: 'WHOLE FOODS MARKET',
    merchant_clean: 'Whole Foods',
    amount: -87.42,
    tx_date: '2026-06-12',
    billing_month: MOCK_BILLING_MONTH,
    account_last4: '4242',
    category: null,
    status: 'pending',
    classified_by: null,
    batch_id: 'dev-batch',
    created_at: '2026-06-12T10:00:00Z',
    ...overrides,
  }
}

/** Builds mock merchant groups for the dev classify deck. */
function buildMockGroups(simulatePrediction: boolean): MerchantGroup[] {
  const primaryTx = simulatePrediction
    ? makeMockTx({ status: 'auto', category: MOCK_PREDICTION })
    : makeMockTx()

  const primary: MerchantGroup = {
    key: 'whole-foods',
    merchantRaw: primaryTx.merchant_raw,
    merchantClean: primaryTx.merchant_clean,
    predictedCategory: simulatePrediction ? MOCK_PREDICTION : null,
    transactions: [primaryTx],
    totalAmount: primaryTx.amount,
    count: 1,
  }

  const secondaryTx = makeMockTx({
    merchant_raw: 'SHELL GAS STATION',
    merchant_clean: 'Shell',
    amount: -54.2,
    tx_date: '2026-06-10',
  })

  const secondary: MerchantGroup = {
    key: 'shell',
    merchantRaw: secondaryTx.merchant_raw,
    merchantClean: secondaryTx.merchant_clean,
    predictedCategory: null,
    transactions: [secondaryTx],
    totalAmount: secondaryTx.amount,
    count: 1,
  }

  return [primary, secondary]
}

/**
 * Dev sandbox for the classify category picker — mirrors SwipeDeck layout with mock cards.
 * URL: /dev/category-picker
 */
export default function CategoryPickerTestPage() {
  const { profile } = useAuth()
  const catConfig = useCategoryConfig(profile?.household_id)
  const { categories } = catConfig
  const [deckMode, setDeckMode] = useState<DeckMode>('pending')
  const [simulatePrediction, setSimulatePrediction] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [catEditorOpen, setCatEditorOpen] = useState(false)
  const [pickerCancelTick, setPickerCancelTick] = useState(0)
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)

  const groups = useMemo(
    () => buildMockGroups(deckMode === 'pending' && simulatePrediction),
    [deckMode, simulatePrediction],
  )
  const activeGroup = groups[0]!

  const openPicker = useCallback(() => setPickerOpen(true), [])

  const handlePickerCancel = useCallback(() => {
    setPickerOpen(false)
    setPickerCancelTick((v) => v + 1)
  }, [])

  const handleCategorySelect = useCallback((categoryId: string) => {
    setPickerOpen(false)
    setLastSelectedId(categoryId)
  }, [])

  const lastSelected = categories.find((c) => c.id === lastSelectedId)

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/[0.08] px-4 py-2 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-200/80">Dev sandbox</p>
        <p className="text-xs text-surface-300">
          Category picker lab ·{' '}
          <span className="font-mono text-amber-100/90">/dev/category-picker</span>
        </p>
      </div>

      <div className="shrink-0 px-5 pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-[13px] font-semibold">
          <button
            type="button"
            onClick={() => setDeckMode('pending')}
            className={`rounded-full px-3 py-1.5 transition-colors ${
              deckMode === 'pending' ? 'bg-duo-green/20 text-duo-green' : 'text-surface-500 hover:text-surface-300'
            }`}
          >
            Classify
          </button>
          <button
            type="button"
            onClick={() => setDeckMode('no-idea')}
            className={`rounded-full px-3 py-1.5 transition-colors ${
              deckMode === 'no-idea' ? 'bg-flame/25 text-flame' : 'text-surface-500 hover:text-surface-300'
            }`}
          >
            No idea
          </button>
          {deckMode === 'pending' && (
            <button
              type="button"
              onClick={() => setSimulatePrediction((v) => !v)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                simulatePrediction
                  ? 'bg-gem/20 text-gem'
                  : 'border border-white/[0.08] text-surface-500 hover:bg-white/[0.06] hover:text-surface-300'
              }`}
            >
              Auto-predicted
            </button>
          )}
          <button
            type="button"
            onClick={openPicker}
            className="ml-auto rounded-full border border-white/[0.08] bg-surface-900/80 px-3 py-1.5 text-[11px] font-semibold text-surface-200 hover:bg-surface-800"
          >
            Open picker
          </button>
          <button
            type="button"
            onClick={() => setCatEditorOpen(true)}
            className="rounded-full p-1.5 text-surface-500 transition-colors hover:bg-white/[0.06] hover:text-surface-300"
            title="Edit categories"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>

        <div className="mb-2 rounded-2xl border border-white/[0.06] bg-surface-950/35 px-3 py-2.5 backdrop-blur-sm">
          <ProgressBar current={3} total={12} label="This session" />
          <p className="mt-1 text-center text-[10px] text-surface-500">Mock progress — not live data</p>
        </div>

        {deckMode === 'pending' && (
          <p className="mt-2 text-center text-[11px] leading-snug text-surface-500">
            Swipe right to categorize, or left if you have no idea — those go to the No idea tab.
            {simulatePrediction && ' Top card has an auto-prediction bonus — swipe right to confirm.'}
          </p>
        )}
        {deckMode === 'no-idea' && (
          <p className="mt-2 text-center text-[11px] leading-snug text-surface-500">
            Swipe right to pick a category. Swipe left to skip for now (this card moves to the back).
          </p>
        )}

        {lastSelected && (
          <p className="mt-2 text-center text-[11px] text-surface-400">
            Last picked:{' '}
            <span className="inline-flex items-center gap-1 font-semibold text-duo-green">
              <CategoryIcon categoryId={lastSelected.id} emoji={lastSelected.icon} size="sm" />
              {lastSelected.label}
            </span>
          </p>
        )}
      </div>

      <div className="relative flex-1 px-4 py-3">
        <div className="relative mx-auto h-full max-w-sm">
          <AnimatePresence>
            {groups
              .map((group, i) => (
                <SwipeCard
                  key={`${deckMode}-${simulatePrediction}-${group.key}`}
                  group={group}
                  stackIndex={i}
                  onSwipeRight={openPicker}
                  onSwipeLeft={() => undefined}
                  onSwipeUp={i === 0 && !!group.predictedCategory ? openPicker : undefined}
                  onTransfer={() => undefined}
                  rightLabel={
                    deckMode === 'no-idea'
                      ? 'Pick category'
                      : group.predictedCategory
                        ? 'Confirm'
                        : 'Categorize'
                  }
                  leftLabel={deckMode === 'no-idea' ? 'Later' : 'No idea'}
                  showTransferButton={deckMode === 'pending'}
                  categories={categories}
                  pickerCancelTick={i === 0 ? pickerCancelTick : undefined}
                  billingMonthLabel={formatBillingMonthLabel(MOCK_BILLING_MONTH)}
                  sessionStackIndex={i === 0 ? 4 : undefined}
                  sessionStackTotal={i === 0 ? 12 : undefined}
                />
              ))
              .reverse()}
          </AnimatePresence>
        </div>
      </div>

      <CategoryPicker
        open={pickerOpen}
        onSelect={handleCategorySelect}
        onClose={handlePickerCancel}
        categories={categories}
        predictedCategory={activeGroup.predictedCategory}
        merchantRaw={activeGroup.merchantRaw}
        merchantClean={activeGroup.merchantClean}
      />

      <CategoryEditorModal
        open={catEditorOpen}
        onClose={() => setCatEditorOpen(false)}
        config={catConfig}
      />
    </div>
  )
}
