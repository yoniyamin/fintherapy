/** Normalized bank CSV header synonyms (English, Spanish, Catalan). Matching is accent-insensitive. */

export const MERCHANT_HEADER_SYNONYMS = [
  'item',
  'description',
  'merchant',
  'merchant name',
  'payee',
  'name',
  'details',
  'concept',
  'concepto',
  'concepte',
  'descripcion',
  'descripción',
  'detalle',
  'detall',
  'movimiento',
  'moviment',
  'beneficiario',
  'beneficiari',
  'establecimiento',
  'establiment',
  'comercio',
  'comerç',
]

export const DATE_HEADER_SYNONYMS = [
  'date',
  'transaction date',
  'posting date',
  'booking date',
  'value date',
  'fecha',
  'fecha valor',
  'fecha operacion',
  'fecha operación',
  'data',
  'data valor',
  'data operacio',
  'data operación',
]

export const AMOUNT_HEADER_SYNONYMS = [
  'amount',
  'debit',
  'credit',
  'value',
  'importe',
  'import',
  'cantidad',
  'quantitat',
]

export type CsvColumnSelection = {
  merchant: string
  amount: string
  date: string
}

export function normalizeCsvHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function findHeaderKey(row: Record<string, string>, candidates: string[]): string | undefined {
  const normalizedToOriginal = new Map<string, string>()
  for (const k of Object.keys(row)) {
    const n = normalizeCsvHeader(k)
    if (!normalizedToOriginal.has(n)) normalizedToOriginal.set(n, k)
  }
  for (const candidate of candidates) {
    const orig = normalizedToOriginal.get(normalizeCsvHeader(candidate))
    if (orig) return orig
  }
  return undefined
}

export function getResolvedCsvColumns(
  sample: Record<string, string>,
  forced: CsvColumnSelection | null,
): { merchant?: string; amount?: string; date?: string } {
  const keys = new Set(Object.keys(sample))
  const autoMerchant = findHeaderKey(sample, MERCHANT_HEADER_SYNONYMS)
  const autoAmount = findHeaderKey(sample, AMOUNT_HEADER_SYNONYMS)
  const autoDate = findHeaderKey(sample, DATE_HEADER_SYNONYMS)

  if (!forced) {
    return { merchant: autoMerchant, amount: autoAmount, date: autoDate }
  }

  const merchant =
    forced.merchant && keys.has(forced.merchant) ? forced.merchant : autoMerchant
  const amount = forced.amount && keys.has(forced.amount) ? forced.amount : autoAmount
  let date: string | undefined
  if (forced.date && keys.has(forced.date)) date = forced.date
  else date = autoDate

  return { merchant, amount, date }
}
