/**
 * Cleans a raw bank merchant string for search and fetches results
 * via Google Custom Search API so the user can identify the business.
 */

const PAYMENT_PREFIXES = [
  /^SQ \*/i,        // Square
  /^MGP\*/i,        // MangoPay (Wallapop etc.)
  /^JG \*/i,        // JustGiving / payment processor
  /^WP\*/i,         // payment processor wrapper
  /^TST\*/i,        // Toast POS
  /^PAY\*/i,        // various
  /^PP\*/i,         // PayPal
  /^PAYPAL \*/i,    // PayPal
  /^GOOGLE \*/i,    // Google Pay
  /^GOOG\*/i,       // Google
  /^AMZN MKTP\b/i,  // Amazon Marketplace (keep as search term)
  /^CKO\*/i,        // Checkout.com
  /^SP \*/i,        // Shopify
  /^IN \*/i,        // invoice prefix
]

/**
 * Trailing reference / booking codes that contain BOTH letters AND digits
 * (e.g. HME343T5, 1A2B3C). Pure-alpha words like BUSTILLO are kept.
 */
const TRAILING_MIXED_REF = /[\s*]+(?=.*[A-Z])(?=.*\d)[A-Z0-9]{5,}$/i

/** Trailing country codes that banks sometimes append. */
const TRAILING_COUNTRY = /\s+(ES|US|UK|GB|DE|FR|IT|NL|PT|IE)\s*$/i

export function cleanMerchantForSearch(raw: string): string {
  let q = raw.trim()

  for (const prefix of PAYMENT_PREFIXES) {
    q = q.replace(prefix, '')
  }

  q = q.replace(TRAILING_MIXED_REF, '')
  q = q.replace(TRAILING_COUNTRY, '')

  q = q.replace(/[*]+/g, ' ')
  q = q.replace(/,\s*$/, '')
  q = q.replace(/\s{2,}/g, ' ')

  return q.trim()
}

export function buildMerchantSearchUrl(merchantRaw: string): string {
  const query = cleanMerchantForSearch(merchantRaw)
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

// ---------------------------------------------------------------------------
// Google Custom Search API
// ---------------------------------------------------------------------------

export interface SearchResult {
  title: string
  link: string
  snippet: string
  displayLink: string
}

const CSE_KEY = import.meta.env.VITE_GOOGLE_CSE_KEY as string | undefined
const CSE_CX = import.meta.env.VITE_GOOGLE_CSE_CX as string | undefined

export function isSearchConfigured(): boolean {
  return Boolean(CSE_KEY && CSE_CX)
}

/**
 * Fetches up to `num` search results for the cleaned merchant query.
 * Returns an empty array if the API is not configured or the call fails.
 */
export async function searchMerchant(
  merchantRaw: string,
  num = 5,
): Promise<SearchResult[]> {
  if (!CSE_KEY || !CSE_CX) return []

  const query = cleanMerchantForSearch(merchantRaw)
  if (!query) return []

  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('key', CSE_KEY)
  url.searchParams.set('cx', CSE_CX)
  url.searchParams.set('q', query)
  url.searchParams.set('num', String(num))

  const res = await fetch(url)
  if (!res.ok) return []

  const data = await res.json()
  const items: Array<{ title?: string; link?: string; snippet?: string; displayLink?: string }> =
    data.items ?? []

  return items.map((item) => ({
    title: item.title ?? '',
    link: item.link ?? '',
    snippet: item.snippet ?? '',
    displayLink: item.displayLink ?? '',
  }))
}
