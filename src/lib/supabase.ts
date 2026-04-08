import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!supabaseConfigured) {
  console.warn(
    'Supabase credentials missing. Copy .env.example to .env and fill in your project values. See SUPABASE_SETUP.md.',
  )
}

const noopChain = () =>
  new Proxy({} as Record<string, unknown>, {
    get: () => noopChain,
    apply: () => Promise.resolve({ data: null, error: null }),
  })

const mockClient = new Proxy({} as SupabaseClient, {
  get: (_target, prop) => {
    if (prop === 'auth') {
      return {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signUp: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        signInWithPassword: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        signOut: () => Promise.resolve({ error: null }),
      }
    }
    if (prop === 'rpc') {
      return () => Promise.resolve({ data: null, error: null })
    }
    if (prop === 'from') {
      return () => ({
        select: () => ({ eq: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }), single: () => Promise.resolve({ data: null, error: null }) }), single: () => Promise.resolve({ data: null, error: null }) }) }),
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      })
    }
    return noopChain
  },
})

export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : mockClient
