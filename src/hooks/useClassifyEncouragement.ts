import { useCallback, useEffect, useRef, useState } from 'react'
import type { HomeLeaderboardEntry } from './useTransactions'
import {
  ENCOURAGEMENT_TIMING,
  encouragementDurationMs,
  levelUpMessage,
  milestoneAnimation,
  milestoneMessage,
  rankUpMessage,
  shouldShowConfetti,
  timeMessage,
  type EncouragementKind,
  type EncouragementPayload,
} from '../lib/classifyEncouragement'
import { xpLevelFromTotal } from '../lib/xpLevels'

export interface ClassifyEncouragementBurst extends EncouragementPayload {
  id: number
}

interface ClassifySuccessInput {
  sessionClassifiedTxCount: number
  xpBefore: number
  xpEarned: number
}

interface Options {
  householdId: string | null | undefined
  userId: string | null | undefined
  getLeaderboard: () => Promise<HomeLeaderboardEntry[]>
}

/** Sorts household members by XP descending (matches server leaderboard order). */
function sortByXp(entries: HomeLeaderboardEntry[]): HomeLeaderboardEntry[] {
  return [...entries].sort((a, b) => b.total_xp - a.total_xp)
}

/** Returns 0-based rank index for a user in an XP-sorted list. */
function rankIndex(entries: HomeLeaderboardEntry[], uid: string): number {
  return sortByXp(entries).findIndex((e) => e.user_id === uid)
}

/**
 * Session-scoped encouragement: count milestones, active time, rank/level ups.
 * Debounced so bursts stay delightful, not noisy.
 */
export function useClassifyEncouragement({ householdId, userId, getLeaderboard }: Options) {
  const [burst, setBurst] = useState<ClassifyEncouragementBurst | null>(null)
  const burstIdRef = useRef(0)
  const nextMilestoneAtRef = useRef(ENCOURAGEMENT_TIMING.FIRST_MILESTONE_TX)
  const nextIntervalRef = useRef(ENCOURAGEMENT_TIMING.FIRST_INTERVAL_TX)
  const milestoneIndexRef = useRef(0)
  const timePulseIndexRef = useRef(0)
  const lastBurstAtRef = useRef(0)
  const lastClassifyAtRef = useRef<number | null>(null)
  const activeClassifyMsRef = useRef(0)
  const leaderboardRef = useRef<HomeLeaderboardEntry[] | null>(null)

  const resetSession = useCallback(() => {
    nextMilestoneAtRef.current = ENCOURAGEMENT_TIMING.FIRST_MILESTONE_TX
    nextIntervalRef.current = ENCOURAGEMENT_TIMING.FIRST_INTERVAL_TX
    milestoneIndexRef.current = 0
    timePulseIndexRef.current = 0
    lastBurstAtRef.current = 0
    lastClassifyAtRef.current = null
    activeClassifyMsRef.current = 0
    leaderboardRef.current = null
  }, [])

  useEffect(() => {
    resetSession()
  }, [householdId, userId, resetSession])

  useEffect(() => {
    if (!householdId || !userId) return
    let cancelled = false
    void getLeaderboard().then((rows) => {
      if (!cancelled) leaderboardRef.current = rows
    })
    return () => {
      cancelled = true
    }
  }, [householdId, userId, getLeaderboard])

  const dismissBurst = useCallback(() => setBurst(null), [])

  const emitBurst = useCallback((payload: EncouragementPayload) => {
    burstIdRef.current += 1
    lastBurstAtRef.current = Date.now()
    setBurst({ ...payload, id: burstIdRef.current })
  }, [])

  const tryEmit = useCallback(
    (candidates: EncouragementPayload[]): void => {
      if (candidates.length === 0) return
      const now = Date.now()
      if (now - lastBurstAtRef.current < ENCOURAGEMENT_TIMING.MIN_GAP_MS) return

      const priority: EncouragementKind[] = ['level-up', 'rank-up', 'milestone', 'time']
      const chosen =
        priority.map((kind) => candidates.find((c) => c.kind === kind)).find(Boolean) ?? candidates[0]!
      emitBurst(chosen)
    },
    [emitBurst],
  )

  const onClassifySuccess = useCallback(
    ({ sessionClassifiedTxCount, xpBefore, xpEarned }: ClassifySuccessInput) => {
      if (!userId) return

      const now = Date.now()
      if (lastClassifyAtRef.current != null) {
        const gap = now - lastClassifyAtRef.current
        if (gap < ENCOURAGEMENT_TIMING.IDLE_GAP_MS) {
          activeClassifyMsRef.current += gap
        } else {
          activeClassifyMsRef.current = 0
        }
      }
      lastClassifyAtRef.current = now

      const xpAfter = xpBefore + xpEarned
      const candidates: EncouragementPayload[] = []
      const salt = sessionClassifiedTxCount + milestoneIndexRef.current

      const levelBefore = xpLevelFromTotal(xpBefore)
      const levelAfter = xpLevelFromTotal(xpAfter)
      if (levelAfter > levelBefore) {
        candidates.push({
          kind: 'level-up',
          message: levelUpMessage(levelAfter),
          animation: levelAfter >= 10 ? 'trophy' : 'medal',
          showConfetti: shouldShowConfetti('level-up', salt),
          durationMs: encouragementDurationMs(levelAfter >= 10 ? 'trophy' : 'medal'),
        })
      }

      if (leaderboardRef.current && leaderboardRef.current.length > 1) {
        const rankBefore = rankIndex(leaderboardRef.current, userId)
        leaderboardRef.current = leaderboardRef.current.map((row) =>
          row.user_id === userId ? { ...row, total_xp: row.total_xp + xpEarned } : row,
        )
        const sorted = sortByXp(leaderboardRef.current)
        leaderboardRef.current = sorted
        const rankAfter = sorted.findIndex((e) => e.user_id === userId)
        if (rankBefore >= 0 && rankAfter >= 0 && rankAfter < rankBefore) {
          const passed = sorted[rankAfter + 1]
          if (passed && passed.user_id !== userId) {
            candidates.push({
              kind: 'rank-up',
              message: rankUpMessage(passed.display_name),
              animation: 'medal',
              showConfetti: shouldShowConfetti('rank-up', salt),
              durationMs: encouragementDurationMs('medal'),
            })
          }
        }
      }

      if (sessionClassifiedTxCount >= nextMilestoneAtRef.current) {
        const animation = milestoneAnimation(milestoneIndexRef.current)
        candidates.push({
          kind: 'milestone',
          message: milestoneMessage(sessionClassifiedTxCount, milestoneIndexRef.current),
          animation,
          showConfetti: shouldShowConfetti('milestone', salt),
          durationMs: encouragementDurationMs(animation),
        })
        nextMilestoneAtRef.current += nextIntervalRef.current
        nextIntervalRef.current += ENCOURAGEMENT_TIMING.INTERVAL_GROWTH_TX
        milestoneIndexRef.current += 1
      }

      if (activeClassifyMsRef.current >= ENCOURAGEMENT_TIMING.ACTIVE_TIME_MS) {
        candidates.push({
          kind: 'time',
          message: timeMessage(timePulseIndexRef.current),
          animation: 'star',
          showConfetti: shouldShowConfetti('time', salt),
          durationMs: encouragementDurationMs('star'),
        })
        timePulseIndexRef.current += 1
        activeClassifyMsRef.current = 0
      }

      tryEmit(candidates)
    },
    [tryEmit, userId],
  )

  return { burst, dismissBurst, onClassifySuccess, resetSession }
}
