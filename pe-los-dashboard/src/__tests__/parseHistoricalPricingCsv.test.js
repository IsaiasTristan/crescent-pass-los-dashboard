import { describe, it, expect } from 'vitest'
import { parseHistoricalPricingCSVText } from '../ingest/parseHistoricalPricingCsv.js'

describe('parseHistoricalPricingCSVText', () => {
  it('parses benchmark + basis columns and computes local prices', () => {
    const csv = [
      'Date,WTI,Henry Hub,MEH Basis,HSC Basis',
      '2024-01,70,2.10,1.25,-0.18',
      '2024-02,72,1.95,1.40,-0.22',
    ].join('\n')

    const out = parseHistoricalPricingCSVText(csv)
    expect(out.rows).toHaveLength(2)
    expect(out.rows[0].monthKey).toBe('2024-01')
    expect(out.rows[0].meh).toBeCloseTo(71.25)
    expect(out.rows[0].hsc).toBeCloseTo(1.92)
    expect(out.warnings).toEqual([])
  })

  it('parses provided MEH/HSC and back-solves basis when benchmark exists', () => {
    const csv = [
      'Month,WTI,Henry Hub,MEH,HSC',
      '1/31/24,68,2.2,69.5,2.0',
    ].join('\n')

    const out = parseHistoricalPricingCSVText(csv)
    expect(out.rows).toHaveLength(1)
    expect(out.rows[0].mehBasis).toBeCloseTo(1.5)
    expect(out.rows[0].hscBasis).toBeCloseTo(-0.2)
  })

  it('returns warning for invalid date rows and keeps valid rows', () => {
    const csv = [
      'Date,WTI,HH,MEH Basis,HSC Basis',
      '2/31/24,68,2.2,1.0,-0.2',
      '3/31/24,70,2.4,1.1,-0.3',
    ].join('\n')

    const out = parseHistoricalPricingCSVText(csv)
    expect(out.rows).toHaveLength(1)
    expect(out.warnings.length).toBe(1)
    expect(out.warnings[0]).toContain('invalid date')
  })

  it('throws when no date column exists', () => {
    const csv = ['WTI,HH,MEH Basis', '70,2.4,1.3'].join('\n')
    expect(() => parseHistoricalPricingCSVText(csv)).toThrow(/Missing date column/i)
  })
})

