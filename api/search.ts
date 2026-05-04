import type { VercelRequest, VercelResponse } from '@vercel/node'

const BRAVE_KEY = process.env.BRAVE_SEARCH_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!BRAVE_KEY) {
    return res.status(500).json({ error: 'BRAVE_SEARCH_KEY not configured on the server' })
  }

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!q) {
    return res.status(400).json({ error: 'Missing ?q= parameter' })
  }

  const count = typeof req.query.count === 'string' ? req.query.count : '5'

  const url = new URL('https://api.search.brave.com/res/v1/web/search')
  url.searchParams.set('q', q)
  url.searchParams.set('count', count)

  const braveRes = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': BRAVE_KEY,
    },
  })

  const data = await braveRes.json()

  if (!braveRes.ok) {
    return res.status(braveRes.status).json(data)
  }

  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate')
  return res.status(200).json(data)
}
