import { supabase } from './supabase'
import type { Transaction } from '../types/database'

export interface PendingTransactionsPayload {
  pending: Transaction[]
  autoClassified: Transaction[]
}

/**
 * In-flight deduplication: multiple `useTransactions(householdId)` mounts (Home + Classify + Reveal)
 * share one pair of RPC calls instead of each firing duplicate requests.
 */
const inflightByHousehold = new Map<string, Promise<PendingTransactionsPayload>>()

async function loadPendingFromServer(householdId: string): Promise<PendingTransactionsPayload> {
  const [pendingRes, autoRes] = await Promise.all([
    supabase.rpc('get_pending_transactions', { p_household_id: householdId }),
    supabase.rpc('get_auto_classified_transactions', { p_household_id: householdId }),
  ])

  const pending =
    !pendingRes.error && pendingRes.data ? (pendingRes.data as Transaction[]) : []
  const autoClassified =
    !autoRes.error && autoRes.data ? (autoRes.data as Transaction[]) : []

  return { pending, autoClassified }
}

export function fetchPendingTransactionsShared(householdId: string): Promise<PendingTransactionsPayload> {
  let p = inflightByHousehold.get(householdId)
  if (!p) {
    p = loadPendingFromServer(householdId).finally(() => {
      if (inflightByHousehold.get(householdId) === p) {
        inflightByHousehold.delete(householdId)
      }
    })
    inflightByHousehold.set(householdId, p)
  }
  return p
}

/** Clears any in-flight promise so the next fetch starts a fresh network round-trip (e.g. after CSV upload). */
export function invalidatePendingTransactionsInflight(householdId: string): void {
  inflightByHousehold.delete(householdId)
}
