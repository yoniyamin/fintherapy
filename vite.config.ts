import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import mkcert from 'vite-plugin-mkcert'

/** Dev-only middleware that proxies /api/search to Brave Search so the
 *  Vercel serverless function isn't needed during local development. */
function braveSearchDevProxy(braveKey: string | undefined): Plugin {
  return {
    name: 'brave-search-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/search', async (req, res) => {
        const key = braveKey
        if (!key) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'BRAVE_SEARCH_KEY not set in .env' }))
          return
        }
        const url = new URL(req.url ?? '/', 'http://localhost')
        const q = url.searchParams.get('q') ?? ''
        const count = url.searchParams.get('count') ?? '5'
        if (!q) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Missing ?q= parameter' }))
          return
        }
        try {
          const braveUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=${count}`
          const braveRes = await fetch(braveUrl, {
            headers: {
              'Accept': 'application/json',
              'Accept-Encoding': 'gzip',
              'X-Subscription-Token': key,
            },
          })
          const data = await braveRes.json()
          res.writeHead(braveRes.status, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(data))
        } catch (err) {
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: String(err) }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const devTlsHosts =
    env.VITE_DEV_TLS_HOSTS?.split(',')
      .map((h: string) => h.trim())
      .filter(Boolean) ?? []

  return {
  server: {
    host: true,
  },
  plugins: [
    braveSearchDevProxy(env.BRAVE_SEARCH_KEY),
    react(),
    tailwindcss(),
    mkcert(
      devTlsHosts.length > 0
        ? { hosts: ['localhost', '127.0.0.1', '::1', ...devTlsHosts] }
        : {},
    ),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: 'Financial Therapy',
        short_name: 'FinTherapy',
        description: 'Gamified household expense categorization',
        theme_color: '#6366f1',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-180.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
  }
})
