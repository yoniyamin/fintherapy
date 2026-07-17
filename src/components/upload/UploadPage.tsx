import { useState, useEffect, useMemo, useCallback, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Papa from 'papaparse'
import { supabase } from '../../lib/supabase'
import { invalidatePendingTransactionsInflight } from '../../lib/pendingTransactionsCache'
import { useAuth } from '../../hooks/useAuth'
import { useMerchantKnowledge } from '../../hooks/useMerchantKnowledge'
import { useTransactions } from '../../hooks/useTransactions'
import { formatAccountLabel } from '../../lib/accountDisplay'
import type { AccountType } from '../../types/database'
import {
  getResolvedCsvColumns,
  type CsvColumnSelection,
} from '../../lib/csvColumnMap'
import Button from '../common/Button'
import { ui } from '../../lib/uiClasses'

/** Keep patterns aligned with supabase/migration_015_refund_detection_timing_and_positive_pairs.sql (pos_pairs). */
const REFUND_DESCRIPTION_RE =
  /refund|reversal|rebate|chargeback|returned payment|credit voucher|acct credit/i

/** Many banks show refunds as positive amounts; treat as outflow reversal for math and pairing. */
function amountAsSpend(merchantRaw: string, parsedAmount: number): number {
  if (parsedAmount > 0 && REFUND_DESCRIPTION_RE.test(merchantRaw.trim())) {
    return -parsedAmount
  }
  return parsedAmount
}

function parseAmount(raw: string): number {
  if (!raw) return 0
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/\u2212/g, '-')
  let negate = false
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    negate = true
    cleaned = cleaned.slice(1, -1).trim()
  }
  cleaned = cleaned.replace(/[A-Z]{3}$|^[A-Z]{3}|[€$£¥₹]/g, '').trim()
  cleaned = cleaned.replace(/^\+/, '')
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',')
    if (parts.length === 2 && parts[1].length === 2) {
      cleaned = cleaned.replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  }
  const n = parseFloat(cleaned) || 0
  return negate ? -n : n
}

function parseDate(raw: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10)
  const trimmed = raw.trim()

  const euMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (euMatch) {
    const [, d, m, y] = euMatch
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return trimmed

  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (usMatch) {
    const [, m, d, y] = usMatch
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  const parsed = new Date(trimmed)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return new Date().toISOString().slice(0, 10)
}

function detectDelimiter(text: string): string {
  const firstLine = text.split('\n')[0] ?? ''
  const semicolons = (firstLine.match(/;/g) ?? []).length
  const commas = (firstLine.match(/,/g) ?? []).length
  const tabs = (firstLine.match(/\t/g) ?? []).length
  if (semicolons > commas && semicolons > tabs) return ';'
  if (tabs > commas) return '\t'
  return ','
}

function formatMonthLabel(value: string): string {
  const [year, month] = value.split('-')
  const date = new Date(Number(year), Number(month) - 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function billingMonthFromTxDate(txDate: string): string {
  return txDate.slice(0, 7)
}

type RawRow = Record<string, string>

const STEPS = ['Select file', 'Review', 'Upload']

export default function UploadPage() {
  const { profile } = useAuth()
  const { autoClassify } = useMerchantKnowledge(profile?.household_id)
  const {
    getAccountAliases,
    getDistinctAccountLast4ForHousehold,
    detectRefunds,
    autoMarkDebitLoads,
    setAccountType,
    syncBillingMonthFromTxDate,
  } = useTransactions(profile?.household_id)
  const [accountAliases, setAccountAliases] = useState<Map<string, string>>(new Map())
  const [accountTypes, setAccountTypes] = useState<Map<string, AccountType>>(new Map())
  const [knownLast4sFromData, setKnownLast4sFromData] = useState<string[]>([])

  const refreshAccountPickers = useCallback(async () => {
    if (!profile?.household_id) return
    const [aliasRows, last4s] = await Promise.all([
      getAccountAliases(),
      getDistinctAccountLast4ForHousehold(),
    ])
    setAccountAliases(new Map(aliasRows.map((r) => [r.last4.trim(), r.label.trim()])))
    const types = new Map<string, AccountType>()
    for (const a of aliasRows) {
      if (a.account_type) types.set(a.last4.trim(), a.account_type)
    }
    setAccountTypes(types)
    setKnownLast4sFromData(last4s)
  }, [profile?.household_id, getAccountAliases, getDistinctAccountLast4ForHousehold])

  useEffect(() => {
    const householdId = profile?.household_id
    if (!householdId) return
    let cancelled = false
    void Promise.all([
      getAccountAliases(),
      getDistinctAccountLast4ForHousehold(),
    ]).then(([aliasRows, last4s]) => {
      if (cancelled) return
      setAccountAliases(new Map(aliasRows.map((r) => [r.last4.trim(), r.label.trim()])))
      const types = new Map<string, AccountType>()
      for (const a of aliasRows) {
        if (a.account_type) types.set(a.last4.trim(), a.account_type)
      }
      setAccountTypes(types)
      setKnownLast4sFromData(last4s)
    })
    return () => {
      cancelled = true
    }
  }, [profile?.household_id, getAccountAliases, getDistinctAccountLast4ForHousehold])

  /** Saved names ∪ any last-4 present in transactions (new cards show without naming first). */
  const accountPicklist = useMemo(() => {
    const s = new Set<string>()
    for (const x of knownLast4sFromData) {
      const t = String(x).trim()
      if (t) s.add(t)
    }
    for (const k of accountAliases.keys()) {
      const t = k.trim()
      if (t) s.add(t)
    }
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [knownLast4sFromData, accountAliases])
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<RawRow[]>([])
  const [forcedColumns, setForcedColumns] = useState<CsvColumnSelection | null>(null)
  const [columnMapOpen, setColumnMapOpen] = useState(false)
  const [columnMapDraft, setColumnMapDraft] = useState<CsvColumnSelection>({
    merchant: '',
    amount: '',
    date: '',
  })
  const [accountLast4, setAccountLast4] = useState('')
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<
    {
      count: number
      inserted: number
      autoCount: number
      loadCount: number
      monthsTouched: string[]
    } | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingTypePrompt, setPendingTypePrompt] = useState<string | null>(null)
  const [bucketSyncBusy, setBucketSyncBusy] = useState(false)
  const [bucketSyncFeedback, setBucketSyncFeedback] = useState<{ text: string; ok: boolean } | null>(null)

  const handleSyncBillingBuckets = useCallback(async () => {
    if (!profile?.household_id) return
    if (
      !window.confirm(
        'Update all transactions so each row’s month bucket matches its transaction date? Use this if totals appeared under the wrong month.',
      )
    ) {
      return
    }
    setBucketSyncBusy(true)
    setBucketSyncFeedback(null)
    const { error, updatedCount } = await syncBillingMonthFromTxDate()
    setBucketSyncBusy(false)
    if (error) {
      setBucketSyncFeedback({ text: error.message, ok: false })
      return
    }
    invalidatePendingTransactionsInflight(profile.household_id)
    setBucketSyncFeedback({
      text:
        updatedCount === 0
          ? 'Month buckets already match transaction dates.'
          : `Updated ${updatedCount} transaction${updatedCount !== 1 ? 's' : ''}. Refresh reveal/classify if already open.`,
      ok: true,
    })
  }, [profile, syncBillingMonthFromTxDate])

  const currentStep = result ? 2 : file ? 1 : 0

  const previewSample = preview[0]
  const headerList = previewSample ? Object.keys(previewSample) : []
  const resolvedColumns = previewSample
    ? getResolvedCsvColumns(previewSample, forcedColumns)
    : {}

  const openColumnMapModal = useCallback(() => {
    if (!previewSample) return
    const r = getResolvedCsvColumns(previewSample, forcedColumns)
    const cols = Object.keys(previewSample)
    const fallbackMerchant = r.merchant ?? cols[0] ?? ''
    const fallbackAmount =
      r.amount ?? cols.find((c) => c !== fallbackMerchant) ?? cols[1] ?? cols[0] ?? ''
    setColumnMapDraft({
      merchant: fallbackMerchant,
      amount: fallbackAmount,
      date: r.date ?? '',
    })
    setColumnMapOpen(true)
  }, [previewSample, forcedColumns])

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setResult(null)
    setError(null)
    setForcedColumns(null)
    setColumnMapOpen(false)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const delimiter = detectDelimiter(text)

      Papa.parse<RawRow>(text, {
        header: true,
        delimiter,
        preview: 5,
        complete: (results) => {
          setPreview(results.data)
          const sample = results.data[0]
          if (!sample) return
          const auto = getResolvedCsvColumns(sample, null)
          if (!auto.merchant || !auto.amount) {
            const cols = Object.keys(sample)
            const fbM = auto.merchant ?? cols[0] ?? ''
            const fbA = auto.amount ?? cols.find((c) => c !== fbM) ?? cols[1] ?? cols[0] ?? ''
            setColumnMapDraft({
              merchant: fbM,
              amount: fbA,
              date: auto.date ?? '',
            })
            setColumnMapOpen(true)
          }
        },
      })
    }
    reader.readAsText(selected)
  }

  const handleUpload = async () => {
    if (!file || !profile?.household_id) {
      setError('You need to be in a household to upload transactions.')
      return
    }

    setUploading(true)
    setError(null)

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target?.result as string
      const delimiter = detectDelimiter(text)

      Papa.parse<RawRow>(text, {
        header: true,
        delimiter,
        complete: async (results) => {
          if (results.data.length === 0) {
            setError('CSV is empty.')
            setUploading(false)
            return
          }

          const sample = results.data[0]
          const { merchant: merchantKey, date: dateKey, amount: amountKey } = getResolvedCsvColumns(
            sample,
            forcedColumns,
          )

          if (!merchantKey || !amountKey) {
            setError(
              `Could not detect columns. Found: ${Object.keys(sample).join(', ')}. ` +
                'Use “Choose columns” to map merchant and amount.',
            )
            setUploading(false)
            return
          }

          const rows = results.data
            .map((row) => {
              const merchant_raw = (row[merchantKey] ?? '').trim()
              const tx_date = parseDate(dateKey ? row[dateKey] ?? '' : '')
              return {
                merchant_raw,
                amount: amountAsSpend(merchant_raw, parseAmount(row[amountKey] ?? '')),
                tx_date,
                billing_month: billingMonthFromTxDate(tx_date),
                account_last4: accountLast4 || null,
              }
            })
            .filter((r) => r.merchant_raw && r.amount !== 0)

          if (rows.length === 0) {
            setError('No valid transactions found after parsing. Check that amount values are non-zero.')
            setUploading(false)
            return
          }

          const { data: inserted, error: insertError } = await supabase.rpc('insert_transactions', {
            p_household_id: profile.household_id!,
            p_rows: rows,
          })

          if (insertError) {
            setError(insertError.message)
          } else {
            invalidatePendingTransactionsInflight(profile.household_id!)
            const insertedCount = (inserted as number) ?? rows.length
            if (insertedCount > 0) {
              await detectRefunds()
            }
            const autoCount = insertedCount > 0 ? await autoClassify() : 0
            const last4 = accountLast4.trim()
            const isDebit = !!last4 && accountTypes.get(last4) === 'debit'
            const monthsTouched = Array.from(new Set(rows.map((r) => r.billing_month))).sort()
            let loadCount = 0
            if (insertedCount > 0 && isDebit) {
              for (const bm of monthsTouched) {
                loadCount += await autoMarkDebitLoads(last4, bm)
              }
            }
            if (loadCount > 0) {
              invalidatePendingTransactionsInflight(profile.household_id!)
            }
            setResult({
              count: rows.length,
              inserted: insertedCount,
              autoCount,
              loadCount,
              monthsTouched,
            })
            void refreshAccountPickers()
            setFile(null)
            setPreview([])
            setForcedColumns(null)
          }
          setUploading(false)
        },
      })
    }
    reader.readAsText(file)
  }

  return (
    <div className={`${ui.screen} ${ui.pageNoBottomPad}`}>
      <h1 className={ui.heroTitle}>Upload Transactions</h1>
      <p className={ui.heroSub}>
        Import a CSV from your bank. We auto-detect columns (EN / ES / CA); you can map them manually if
        needed.
      </p>

      <div className="mt-4 rounded-xl border border-white/[0.08] bg-surface-950/40 px-4 py-3">
        <p className="text-xs text-surface-400">
          If imported rows show under the wrong calendar month (bucket disagrees with each row’s date), run a
          one-time repair for this household.
        </p>
        <button
          type="button"
          disabled={!profile?.household_id || bucketSyncBusy}
          onClick={() => void handleSyncBillingBuckets()}
          className="mt-2 text-xs font-semibold text-ice underline decoration-ice/40 underline-offset-2 hover:decoration-ice disabled:pointer-events-none disabled:opacity-40"
        >
          {bucketSyncBusy ? 'Aligning…' : 'Align month buckets from transaction dates'}
        </button>
        {bucketSyncFeedback && (
          <p
            className={`mt-2 text-xs ${bucketSyncFeedback.ok ? 'text-duo-green' : 'text-danger'}`}
          >
            {bucketSyncFeedback.text}
          </p>
        )}
      </div>

      {/* Step indicator */}
      <div className={`${ui.glassFlat} mt-6 flex items-center gap-2 p-3`}>
        {STEPS.map((step, i) => (
          <div key={step} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                i <= currentStep
                  ? 'bg-duo-green text-white shadow-[0_6px_16px_-4px_rgba(88,204,2,0.5)]'
                  : 'bg-surface-900/80 text-surface-500 ring-1 ring-white/[0.06]'
              }`}
            >
              {i < currentStep ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium ${i <= currentStep ? 'text-duo-green' : 'text-surface-500'}`}>
              {step}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`h-px flex-1 ${i < currentStep ? 'bg-duo-green/40' : 'bg-white/[0.08]'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Account field — billing month is derived from each row's tx_date */}
      <div className="mt-6">
        <div>
          <label htmlFor="account-last4" className="block text-sm font-medium text-surface-300">
            Account (last 4)
          </label>
          {accountPicklist.length > 0 && (
            <select
              aria-label="Pick a saved card"
              value=""
              onChange={(e) => {
                const v = e.target.value
                if (v) setAccountLast4(v)
              }}
              className={`mt-1.5 mb-1.5 block w-full ${ui.select}`}
            >
              <option value="">Or choose a card…</option>
              {accountPicklist.map((last4) => (
                <option key={last4} value={last4}>
                  {formatAccountLabel(last4, accountAliases)}
                </option>
              ))}
            </select>
          )}
          <input
            id="account-last4"
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={accountLast4}
            onChange={(e) => setAccountLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className={`mt-1.5 block w-full ${ui.input} px-3 py-2.5`}
            placeholder="1234"
            list={accountPicklist.length > 0 ? 'saved-accounts-datalist' : undefined}
            autoComplete="off"
          />
          {accountPicklist.length > 0 && (
            <datalist id="saved-accounts-datalist">
              {accountPicklist.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          )}
          {accountLast4.length === 4 && (
            <p className="mt-1 text-[11px] text-surface-500">
              {formatAccountLabel(accountLast4, accountAliases)}
            </p>
          )}
        </div>
      </div>

      {/* File picker */}
      <label className="mt-4 flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-white/[0.12] bg-surface-950/40 px-6 py-10 shadow-[0_20px_48px_-28px_rgba(28,176,246,0.2)] transition-all hover:border-ice/40 hover:bg-ice/[0.04]">
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-surface-400">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
          </svg>
        </motion.div>
        <span className="text-sm text-surface-300">
          {file ? file.name : 'Tap to choose a CSV file'}
        </span>
        <input
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileChange}
        />
      </label>

      {/* Detected columns + manual map */}
      {previewSample && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {resolvedColumns.merchant && (
              <span className="rounded-full bg-duo-green/10 px-2.5 py-1 font-medium text-duo-green">
                Merchant: {resolvedColumns.merchant}
              </span>
            )}
            {resolvedColumns.date && (
              <span className="rounded-full bg-duo-green/10 px-2.5 py-1 font-medium text-duo-green">
                Date: {resolvedColumns.date}
              </span>
            )}
            {resolvedColumns.amount && (
              <span className="rounded-full bg-duo-green/10 px-2.5 py-1 font-medium text-duo-green">
                Amount: {resolvedColumns.amount}
              </span>
            )}
            {!resolvedColumns.merchant && (
              <span className="rounded-full bg-danger/10 px-2.5 py-1 font-medium text-danger">
                Merchant not mapped
              </span>
            )}
            {!resolvedColumns.amount && (
              <span className="rounded-full bg-danger/10 px-2.5 py-1 font-medium text-danger">
                Amount not mapped
              </span>
            )}
            {forcedColumns && (
              <span className="rounded-full bg-ice/10 px-2.5 py-1 font-medium text-ice">Custom mapping</span>
            )}
          </div>
          <button
            type="button"
            onClick={openColumnMapModal}
            className="self-start text-xs font-semibold text-ice underline decoration-ice/40 underline-offset-2 hover:decoration-ice"
          >
            Choose columns…
          </button>
        </div>
      )}

      {/* Upload context pills */}
      {file && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full bg-surface-800 px-2.5 py-1 font-medium text-surface-400">
            Months auto-detected from dates
          </span>
          {accountLast4 && (
            <span className="rounded-full bg-surface-800 px-2.5 py-1 font-medium text-surface-400">
              {formatAccountLabel(accountLast4, accountAliases)}
            </span>
          )}
          {accountLast4 && accountTypes.get(accountLast4.trim()) === 'debit' && (
            <span className="rounded-full bg-ice/15 px-2.5 py-1 font-semibold text-ice">
              Debit · loads auto-classified
            </span>
          )}
          {accountLast4 && accountTypes.get(accountLast4.trim()) === 'credit' && (
            <span className="rounded-full bg-duo-green/10 px-2.5 py-1 font-semibold text-duo-green">
              Credit
            </span>
          )}
          {accountLast4.length === 4 && !accountTypes.has(accountLast4.trim()) && (
            <button
              type="button"
              onClick={() => setPendingTypePrompt(accountLast4.trim())}
              className="rounded-full border border-dashed border-white/20 bg-transparent px-2.5 py-1 font-medium text-surface-400 hover:border-ice/40 hover:text-ice"
            >
              Set card type…
            </button>
          )}
        </div>
      )}

      {/* CSV Preview */}
      {preview.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/[0.08] bg-surface-950/35 backdrop-blur-sm">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/[0.06] bg-surface-900/60">
              <tr>
                {Object.keys(preview[0]).map((key) => (
                  <th key={key} className="px-3 py-2 font-semibold text-surface-300">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} className="border-b border-white/[0.05] last:border-0">
                  {Object.values(row).map((val, j) => (
                    <td key={j} className="px-3 py-2 text-surface-200">
                      {String(val)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-surface-500">Showing first 5 rows</p>
        </div>
      )}

      {error && <div className={`mt-4 ${ui.dangerBanner}`}>{error}</div>}

      <AnimatePresence>
        {result && (
          <motion.div
            className={`${ui.glassFlat} mt-4 border border-duo-green/25 bg-duo-green/[0.08] p-6 text-center`}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            <motion.div
              className="text-4xl"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 0.4 }}
            >
              ✅
            </motion.div>
            <p className="mt-3 text-base font-bold text-duo-green">
              {result.inserted} transaction{result.inserted !== 1 ? 's' : ''} uploaded!
            </p>
            {result.inserted < result.count && (
              <p className="mt-1 text-sm text-surface-400">
                {result.count - result.inserted} duplicate{result.count - result.inserted !== 1 ? 's' : ''} skipped
              </p>
            )}
            {result.inserted === 0 && (
              <p className="mt-1 text-sm font-medium text-flame">
                All transactions already exist — nothing new to add
              </p>
            )}
            {result.autoCount > 0 && (
              <p className="mt-1 text-sm font-bold text-gem">
                {result.autoCount} auto-classified from memory
              </p>
            )}
            {result.loadCount > 0 && (
              <p className="mt-1 text-sm font-bold text-ice">
                {result.loadCount} debit load{result.loadCount !== 1 ? 's' : ''} marked as own transfers
              </p>
            )}
            <p className="mt-1 text-sm text-surface-400">
              {result.monthsTouched.length === 0
                ? 'No months detected'
                : result.monthsTouched.length === 1
                  ? formatMonthLabel(result.monthsTouched[0]!)
                  : `${result.monthsTouched.length} months · ${formatMonthLabel(result.monthsTouched[0]!)} – ${formatMonthLabel(result.monthsTouched[result.monthsTouched.length - 1]!)}`}
              {accountLast4 ? ` · ${formatAccountLabel(accountLast4, accountAliases)}` : ''}
            </p>
            <Link
              to="/classify"
              className="mt-4 inline-block rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-6 py-2.5 text-sm font-bold text-white shadow-[0_12px_32px_-10px_rgba(88,204,2,0.45)] active:translate-y-[1px] active:border-b"
            >
              Go classify
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {file && !result && (
        <Button
          className="mt-4 w-full"
          onClick={handleUpload}
          disabled={uploading || !resolvedColumns.merchant || !resolvedColumns.amount}
        >
          {uploading ? 'Uploading...' : `Upload ${file.name}`}
        </Button>
      )}

      {pendingTypePrompt &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
            role="dialog"
            aria-modal="true"
            onClick={() => setPendingTypePrompt(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface-950 p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs text-surface-500">Card ···{pendingTypePrompt}</p>
              <p className="mt-1 text-sm text-surface-200">Is this a credit or debit card?</p>
              <p className="mt-1 text-[11px] leading-snug text-surface-500">
                Debit cards must be loaded before spending — we’ll auto-mark those loads as own-account transfers so they don’t skew your spending.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(['credit', 'debit'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={async () => {
                      const last4 = pendingTypePrompt
                      setPendingTypePrompt(null)
                      const { error: typeErr } = await setAccountType(last4, opt)
                      if (typeErr) {
                        console.error('set_account_type', typeErr.message)
                        return
                      }
                      setAccountTypes((m) => new Map(m).set(last4, opt))
                    }}
                    className={`rounded-xl border-b-[3px] px-3 py-2.5 text-sm font-bold ${
                      opt === 'debit'
                        ? 'border-ice/40 bg-ice/15 text-ice'
                        : 'border-duo-green-dark bg-duo-green/15 text-duo-green'
                    }`}
                  >
                    {opt === 'debit' ? 'Debit' : 'Credit'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPendingTypePrompt(null)}
                className="mt-2 w-full rounded-lg px-3 py-2 text-xs text-surface-400 hover:bg-white/[0.04]"
              >
                Skip for now
              </button>
            </div>
          </div>,
          document.body,
        )}

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {columnMapOpen && previewSample && (
              <>
                <motion.div
                  className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setColumnMapOpen(false)}
                />
                <motion.div
                  className="fixed inset-x-0 bottom-0 z-[101] max-h-[85vh] overflow-y-auto rounded-t-[28px] border border-white/10 border-b-0 bg-surface-950/95 px-4 pt-3 shadow-[0_-24px_48px_-16px_rgba(0,0,0,0.5)] backdrop-blur-xl pb-[max(2.5rem,env(safe-area-inset-bottom))]"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
                  <h3 className="mb-1 text-center text-base font-bold text-surface-50">CSV columns</h3>
                  <p className="mb-4 text-center text-[11px] text-surface-500">
                    Pick which column is the description, the amount, and optionally the date. Works with
                    English, Spanish, and Catalan bank exports.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-surface-400">Merchant / description</label>
                      <select
                        value={columnMapDraft.merchant}
                        onChange={(e) => setColumnMapDraft((d) => ({ ...d, merchant: e.target.value }))}
                        className={`mt-1 block w-full ${ui.select}`}
                      >
                        {headerList.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-surface-400">Amount</label>
                      <select
                        value={columnMapDraft.amount}
                        onChange={(e) => setColumnMapDraft((d) => ({ ...d, amount: e.target.value }))}
                        className={`mt-1 block w-full ${ui.select}`}
                      >
                        {headerList.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-surface-400">Date (optional)</label>
                      <select
                        value={columnMapDraft.date}
                        onChange={(e) => setColumnMapDraft((d) => ({ ...d, date: e.target.value }))}
                        className={`mt-1 block w-full ${ui.select}`}
                      >
                        <option value="">Auto-detect or omit</option>
                        {headerList.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setForcedColumns(null)
                        setColumnMapOpen(false)
                      }}
                      className="flex-1 rounded-xl border border-white/[0.1] bg-surface-800/80 py-2.5 text-sm font-semibold text-surface-300 transition-colors hover:bg-surface-700"
                    >
                      Use auto-detect
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const keys = new Set(headerList)
                        if (
                          !keys.has(columnMapDraft.merchant) ||
                          !keys.has(columnMapDraft.amount) ||
                          columnMapDraft.merchant === columnMapDraft.amount
                        ) {
                          return
                        }
                        setForcedColumns({
                          merchant: columnMapDraft.merchant,
                          amount: columnMapDraft.amount,
                          date: columnMapDraft.date,
                        })
                        setColumnMapOpen(false)
                      }}
                      disabled={
                        !headerList.includes(columnMapDraft.merchant) ||
                        !headerList.includes(columnMapDraft.amount) ||
                        columnMapDraft.merchant === columnMapDraft.amount
                      }
                      className="flex-1 rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_-8px_rgba(88,204,2,0.4)] active:translate-y-[1px] active:border-b disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Apply mapping
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  )
}
