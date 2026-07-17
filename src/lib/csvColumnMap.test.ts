import { describe, it, expect } from 'vitest'
import {
  normalizeCsvHeader,
  findHeaderKey,
  getResolvedCsvColumns,
  MERCHANT_HEADER_SYNONYMS,
  DATE_HEADER_SYNONYMS,
  AMOUNT_HEADER_SYNONYMS,
} from './csvColumnMap'

describe('normalizeCsvHeader', () => {
  it('trims, lowercases, and strips accents', () => {
    expect(normalizeCsvHeader('  Descripción  ')).toBe('descripcion')
  })

  it('strips BOM', () => {
    expect(normalizeCsvHeader('\uFEFFDate')).toBe('date')
  })

  it('handles already-clean headers', () => {
    expect(normalizeCsvHeader('amount')).toBe('amount')
  })
})

describe('findHeaderKey', () => {
  it('returns the original key for a matching synonym', () => {
    const row = { 'Concepto': 'foo', 'Importe': '42', 'Fecha': '2024-01-01' }
    expect(findHeaderKey(row, MERCHANT_HEADER_SYNONYMS)).toBe('Concepto')
  })

  it('returns undefined when no synonym matches', () => {
    const row = { 'Foo': 'bar' }
    expect(findHeaderKey(row, MERCHANT_HEADER_SYNONYMS)).toBeUndefined()
  })

  it('matches accent-insensitive (Descripción → descripcion)', () => {
    const row = { 'Descripción': 'x' }
    expect(findHeaderKey(row, MERCHANT_HEADER_SYNONYMS)).toBe('Descripción')
  })

  it('returns the first matching synonym in priority order', () => {
    const row = { 'description': 'a', 'merchant': 'b' }
    expect(findHeaderKey(row, MERCHANT_HEADER_SYNONYMS)).toBe('description')
  })
})

describe('getResolvedCsvColumns', () => {
  const sample = {
    'Date': '2024-01-01',
    'Description': 'Shop',
    'Amount': '42.50',
    'Balance': '1000',
  }

  it('auto-detects all three columns without forced mapping', () => {
    const result = getResolvedCsvColumns(sample, null)
    expect(result).toEqual({
      merchant: 'Description',
      amount: 'Amount',
      date: 'Date',
    })
  })

  it('uses forced mapping when keys exist in sample', () => {
    const result = getResolvedCsvColumns(sample, {
      merchant: 'Balance',
      amount: 'Amount',
      date: 'Date',
    })
    expect(result.merchant).toBe('Balance')
  })

  it('falls back to auto-detect when forced key is missing from sample', () => {
    const result = getResolvedCsvColumns(sample, {
      merchant: 'NonExistent',
      amount: 'Amount',
      date: 'Date',
    })
    expect(result.merchant).toBe('Description')
  })

  it('handles Spanish bank headers', () => {
    const spanishSample = {
      'Concepto': 'Supermercado',
      'Importe': '-23.40',
      'Fecha valor': '15/03/2024',
    }
    const result = getResolvedCsvColumns(spanishSample, null)
    expect(result.merchant).toBe('Concepto')
    expect(result.amount).toBe('Importe')
    expect(result.date).toBe('Fecha valor')
  })
})

describe('synonym list sanity', () => {
  it('merchant synonyms are all lowercase', () => {
    for (const s of MERCHANT_HEADER_SYNONYMS) {
      expect(s).toBe(s.toLowerCase())
    }
  })

  it('date synonyms are all lowercase', () => {
    for (const s of DATE_HEADER_SYNONYMS) {
      expect(s).toBe(s.toLowerCase())
    }
  })

  it('amount synonyms are all lowercase', () => {
    for (const s of AMOUNT_HEADER_SYNONYMS) {
      expect(s).toBe(s.toLowerCase())
    }
  })
})
