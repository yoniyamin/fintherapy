import { useEffect, useRef, useCallback, useState } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface PresenceUser {
  userId: string
  displayName: string
  onlineAt: string
}

export function usePresence(
  householdId: string | null | undefined,
  userId: string | null | undefined,
  displayName: string | null | undefined,
  enabled: boolean = true,
) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)

  const syncPresence = useCallback((state: Record<string, { userId: string; displayName: string; online_at: string }[]>) => {
    const users: PresenceUser[] = []
    Object.values(state).forEach((presences) => {
      presences.forEach((p) => {
        if (!users.find((u) => u.userId === p.userId)) {
          users.push({
            userId: p.userId,
            displayName: p.displayName,
            onlineAt: p.online_at,
          })
        }
      })
    })
    setOnlineUsers(users)
  }, [])

  useEffect(() => {
    if (!supabaseConfigured || !enabled || !householdId || !userId || !displayName) return

    const ch = supabase.channel(`classify:${householdId}`, {
      config: { presence: { key: userId } },
    })

    ch.on('presence', { event: 'sync' }, () => {
      syncPresence(ch.presenceState() as Record<string, { userId: string; displayName: string; online_at: string }[]>)
    })

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({
          userId,
          displayName,
          online_at: new Date().toISOString(),
        })
      }
    })

    channelRef.current = ch

    return () => {
      ch.unsubscribe()
      channelRef.current = null
    }
  }, [householdId, userId, displayName, enabled, syncPresence])

  const untrack = useCallback(async () => {
    if (channelRef.current) {
      await channelRef.current.untrack()
    }
  }, [])

  return { onlineUsers, untrack }
}
