const full = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
})

const compact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

export function formatCurrency(value: number, decimals = true): string {
  return decimals ? full.format(value) : compact.format(value)
}
