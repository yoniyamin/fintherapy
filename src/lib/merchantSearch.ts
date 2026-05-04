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
// Brave Search API — https://brave.com/search/api
// Free tier: 2 000 queries / month (1 query / second)
// ---------------------------------------------------------------------------

export interface SearchResult {
  title: string
  link: string
  snippet: string
  displayLink: string
}

const BRAVE_KEY = import.meta.env.VITE_BRAVE_SEARCH_KEY as string | undefined

export function isSearchConfigured(): boolean {
  return Boolean(BRAVE_KEY)
}

export type SearchResponse =
  | { ok: true; results: SearchResult[] }
  | { ok: false; error: string }

/**
 * Fetches up to `count` web results for the cleaned merchant query via Brave Search.
 */
export async function searchMerchant(
  merchantRaw: string,
  count = 5,
): Promise<SearchResponse> {
  if (!BRAVE_KEY) {
    return { ok: false, error: 'Search not configured — add VITE_BRAVE_SEARCH_KEY to .env' }
  }

  const query = cleanMerchantForSearch(merchantRaw)
  if (!query) {
    return { ok: false, error: 'Could not build a search query from this merchant name' }
  }

  const url = new URL('https://api.search.brave.com/res/v1/web/search')
  url.searchParams.set('q', query)
  url.searchParams.set('count', String(count))

  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': BRAVE_KEY,
    },
  })

  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const body = await res.json()
      msg = body?.message ?? body?.error ?? msg
    } catch { /* ignore parse errors */ }
    return { ok: false, error: msg }
  }

  const data = await res.json()
  const items: Array<{ title?: string; url?: string; description?: string }> =
    data?.web?.results ?? []

  if (items.length === 0) {
    return { ok: true, results: [] }
  }

  return {
    ok: true,
    results: items.map((item) => {
      let domain = ''
      try { domain = new URL(item.url ?? '').hostname } catch { /* */ }
      return {
        title: item.title ?? '',
        link: item.url ?? '',
        snippet: item.description ?? '',
        displayLink: domain,
      }
    }),
  }
}
