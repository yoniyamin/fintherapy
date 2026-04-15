/** Display last-4 with optional household alias: `5007 (Yonatan)` */
export function formatAccountLabel(
  last4: string | null | undefined,
  aliases: ReadonlyMap<string, string> | Map<string, string>,
): string {
  if (last4 == null || String(last4).trim() === '') return '—'
  const t = String(last4).trim()
  const a = aliases.get(t)
  return a ? `${t} (${a})` : t
}
