/**
 * Transfer kind detection rules.
 * Mirrors the SQL backfill logic in migration_025 for use at upload time.
 */

export type TransferKind = 'card_funding' | 'salary_in' | 'internal'

const SALARY_PATTERNS = [/NOMINA/i, /N[OÒ]MINA/i, /PAYROLL/i]

const CARD_FUNDING_PATTERNS = [
  /TRASP[AÀ]S\s*PROPI/i,
  /OWN\s*TRANSFER/i,
  /TRANSFERENCIA/i,
  /TRANSFER[EÈ]NCIA/i,
]

/**
 * Infer the transfer_kind from a transaction's merchant description and context.
 * Returns null if the transaction is not a transfer.
 */
export function inferTransferKind(
  merchantRaw: string,
  amount: number,
  accountType: string | null,
  householdMemberNames?: string[],
): TransferKind {
  const text = merchantRaw.trim()

  if (SALARY_PATTERNS.some(p => p.test(text))) {
    return 'salary_in'
  }

  if (CARD_FUNDING_PATTERNS.some(p => p.test(text))) {
    return 'card_funding'
  }

  if (householdMemberNames?.some(name =>
    text.toUpperCase().includes(name.toUpperCase())
  )) {
    return 'card_funding'
  }

  if (accountType === 'debit' && amount > 0) {
    return 'card_funding'
  }

  return 'internal'
}
