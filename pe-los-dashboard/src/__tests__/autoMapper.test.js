import { describe, it, expect } from 'vitest'
import { autoMapColumns, detectSourceType, applyUnitConversion, normalizeHeader } from '../ingest/autoMapper.js'

// ─── normalizeHeader ──────────────────────────────────────────────────────────

describe('normalizeHeader', () => {
  it('lowercases and strips non-alphanumeric characters', () => {
    expect(normalizeHeader('Well Name')).toBe('wellname')
    expect(normalizeHeader('GP&T ($/Mcf)')).toBe('gptmcf')
    expect(normalizeHeader('  WTI  ')).toBe('wti')
  })

  it('handles null / undefined gracefully', () => {
    expect(normalizeHeader(null)).toBe('')
    expect(normalizeHeader(undefined)).toBe('')
    expect(normalizeHeader('')).toBe('')
  })
})

// ─── detectSourceType ─────────────────────────────────────────────────────────

describe('detectSourceType', () => {
  it('detects LOS from cost-category and net-amount headers', () => {
    const headers = ['Well Name', 'Cost Category', 'LOS Category', 'Net Amount', 'Net Volume']
    expect(detectSourceType(headers)).toBe('los')
  })

  it('detects volumes from gross-oil and gross-water headers', () => {
    const headers = ['Date', 'Well Name', 'Gross Oil', 'Gross Gas', 'Gross Water']
    expect(detectSourceType(headers)).toBe('volumes')
  })

  it('detects pricing from WTI and Henry Hub headers', () => {
    const headers = ['Date', 'WTI', 'Henry Hub', 'MEH', 'HSC']
    expect(detectSourceType(headers)).toBe('pricing')
  })

  it('detects GPT from gathering fee and processing fee headers', () => {
    const headers = ['Date', 'Meter Name', 'Inlet Volume (MCF)', 'Gathering Fee', 'Processing Fee', 'Total Midstream Fee']
    expect(detectSourceType(headers)).toBe('gpt')
  })

  it('returns null when no signals match', () => {
    const headers = ['Foo', 'Bar', 'Baz']
    expect(detectSourceType(headers)).toBeNull()
  })
})

// ─── autoMapColumns ───────────────────────────────────────────────────────────

describe('autoMapColumns', () => {
  it('exact-matches canonical aliases with high confidence', () => {
    const headers = ['Well Name', 'Service End Date', 'Cost Category', 'Net Amount']
    const result = autoMapColumns(headers, [], 'los')
    const fieldIds = result.map(m => m.canonicalFieldId)
    expect(fieldIds).toContain('wellName')
    expect(fieldIds).toContain('serviceDate')
    expect(fieldIds).toContain('costCategory')
    expect(fieldIds).toContain('netAmount')
  })

  it('assigns confidence=exact for exact alias matches', () => {
    const headers = ['Well Name']
    const [m] = autoMapColumns(headers, [], 'los')
    expect(m.canonicalFieldId).toBe('wellName')
    expect(m.confidence).toBe('exact')
  })

  it('assigns confidence=high for contains-matches', () => {
    const headers = ['My Gross Oil Volume (BBL)']
    const [m] = autoMapColumns(headers, [], 'volumes')
    expect(m.canonicalFieldId).toBe('grossOilVolume')
    expect(m.confidence).toBe('high')
  })

  it('assigns confidence=null for completely unrecognized headers', () => {
    const headers = ['ZZZXXX123']
    const [m] = autoMapColumns(headers, [], 'los')
    expect(m.canonicalFieldId).toBeNull()
    expect(m.confidence).toBeNull()
  })

  it('returns headerIdx matching the column position', () => {
    const headers = ['Date', 'WTI', 'Henry Hub']
    const result = autoMapColumns(headers, [], 'pricing')
    expect(result[0].headerIdx).toBe(0)
    expect(result[1].headerIdx).toBe(1)
    expect(result[2].headerIdx).toBe(2)
  })

  it('includes sample values from sampleRows', () => {
    const headers = ['Well Name', 'Net Amount']
    const sampleRows = [['Well A', '-45231'], ['Well B', '-32100']]
    const result = autoMapColumns(headers, sampleRows, 'los')
    expect(result[0].sampleValues).toEqual(['Well A', 'Well B'])
    expect(result[1].sampleValues).toEqual(['-45231', '-32100'])
  })

  it('filters to source-appropriate fields only', () => {
    // 'gathering fee' should map to gatheringFee, which is gpt-only
    // When sourceType=los, it should NOT match to any gpt field
    const headers = ['Gathering Fee']
    const resultLos = autoMapColumns(headers, [], 'los')
    const resultGpt = autoMapColumns(headers, [], 'gpt')
    // When filtering to los, gathering fee should not map (it's gpt-only)
    // When filtering to gpt, it should map
    expect(resultGpt[0].canonicalFieldId).toBe('gatheringFee')
    // For los, gathering fee is not in the los field set, so no exact match
    expect(resultLos[0].canonicalFieldId).not.toBe('gatheringFee')
  })

  it('handles GPT-specific headers when source type is gpt', () => {
    const headers = ['Date', 'Meter Name', 'Inlet Volume (MCF)', 'Total Midstream Fee']
    const result = autoMapColumns(headers, [], 'gpt')
    const byLabel = Object.fromEntries(result.map(m => [m.rawLabel, m.canonicalFieldId]))
    expect(byLabel['Date']).toBe('serviceDate')
    expect(byLabel['Meter Name']).toBe('meterName')
    expect(byLabel['Total Midstream Fee']).toBe('totalMidstreamFee')
  })

  it('infers gas unit from explicit header unit suffix', () => {
    const [volumeCol] = autoMapColumns(['Gross Gas Volume (MCF)'], [], 'volumes')
    const [gptCol] = autoMapColumns(['Inlet Volume (MMBTU)'], [], 'gpt')
    expect(volumeCol.suggestedUnit).toBe('MCF')
    expect(gptCol.suggestedUnit).toBe('MMBTU')
  })

  it('defaults gas unit suggestion to MMBTU when header omits unit', () => {
    const headers = ['Gross Gas Volume']
    const [m] = autoMapColumns(headers, [], 'volumes')
    expect(m.canonicalFieldId).toBe('grossGasVolume')
    expect(m.suggestedUnit).toBe('MMBTU')
  })
})

// ─── applyUnitConversion ──────────────────────────────────────────────────────

describe('applyUnitConversion', () => {
  it('converts percent to decimal', () => {
    expect(applyUnitConversion(75, 'decimal', 'percent')).toBeCloseTo(0.75)
  })

  it('converts gallons to BBL (÷42)', () => {
    expect(applyUnitConversion(420, 'BBL', 'gallons')).toBeCloseTo(10)
  })

  it('converts CF to MCF (÷1000)', () => {
    expect(applyUnitConversion(5000, 'MCF', 'CF')).toBeCloseTo(5)
  })

  it('converts MMBTU to MCF (÷1.02)', () => {
    expect(applyUnitConversion(10.2, 'MCF', 'MMBTU')).toBeCloseTo(10)
  })

  it('returns value unchanged when unitOverride matches canonicalUnit', () => {
    expect(applyUnitConversion(100, 'BBL', 'BBL')).toBe(100)
  })

  it('returns value unchanged when no unitOverride', () => {
    expect(applyUnitConversion(100, 'BBL', null)).toBe(100)
  })

  it('returns null for null input', () => {
    expect(applyUnitConversion(null, 'BBL', 'gallons')).toBeNull()
  })

  it('returns value unchanged for non-finite input', () => {
    expect(applyUnitConversion(NaN, 'decimal', 'percent')).toBeNaN()
  })
})
