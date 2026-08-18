import { supabase, supabaseAnonKey, supabaseUrl } from './supabase'
import { sessionStats, type SessionStatsSnapshot } from './sessionStats'

/** Sends the current anonymous session snapshot to Supabase. */
export async function flushSessionStats(options?: { keepalive?: boolean }): Promise<void> {
  const snapshot = sessionStats.getSnapshot()
  if (Object.keys(snapshot.sectionSeconds).length === 0) return
  if (options?.keepalive) {
    await flushKeepalive(snapshot)
    return
  }
  const { error } = await supabase.rpc('upsert_session_statistics', {
    p_id: snapshot.id,
    p_auth_action: snapshot.authAction,
    p_section_seconds: snapshot.sectionSeconds,
  })
  if (error) console.warn('session stats flush failed:', error.message)
}

/** Uses a keepalive fetch so the last write can complete during page hide. */
async function flushKeepalive(snapshot: SessionStatsSnapshot): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) return
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return
  try {
    await fetch(`${supabaseUrl}/rest/v1/rpc/upsert_session_statistics`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_id: snapshot.id,
        p_auth_action: snapshot.authAction,
        p_section_seconds: snapshot.sectionSeconds,
      }),
    })
  } catch (err) {
    console.warn('session stats keepalive flush failed:', err)
  }
}
