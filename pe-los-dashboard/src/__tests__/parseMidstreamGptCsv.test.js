import { describe, it, expect } from 'vitest'
import { parseMidstreamGptCSVText, parseMidstreamGptCSVWithMapping } from '../ingest/parseMidstreamGptCsv.js'

describe('parseMidstreamGptCSVText', () => {
  it('parses canonical columns with comma delimiter', () => {
    const csv = [
      'Date,Meter Name,Inlet Volume (Mcf),NGL Volume (BBL),Gas Shrink (%),Residue Gas Sales,Residue Gas Volume (Mcf),WTI,Gathering & Treatment Fees',
      '2025-01-01,Rangel Behrens,100000,2400,4.2,245000,98000,72,185000',
    ].join('\n')

    const out = parseMidstreamGptCSVText(csv)
    expect(out.rows).toHaveLength(1)
    expect(out.rows[0].meterName).toBe('Rangel Behrens')
    expect(out.rows[0].inletVolumeMcf).toBe(100000)
    expect(out.rows[0].totalMidstreamFee).toBe(185000)
    expect(out.warnings).toEqual([])
  })

  it('supports alias headers and derives total fee from parts', () => {
    const csv = [
      'Month,Plant,Gross WH Plant,NGL Prod (BBL),Shrink,Henry Hub,Residue Gas Sales,Post-Pop Net Residue Gas,Gathering Fee,Processing Fee,Compression Fee',
      '2025-02,Birnbaum + Mitschke,90000,2100,5.1,2.70,180000,86000,60000,45000,15000',
    ].join('\n')

    const out = parseMidstreamGptCSVText(csv)
    expect(out.rows).toHaveLength(1)
    expect(out.rows[0].meterName).toBe('Birnbaum + Mitschke')
    expect(out.rows[0].totalMidstreamFee).toBe(120000)
    expect(out.rows[0].hhubPrice).toBe(2.7)
  })

  it('warns when inlet volume is missing and skips bad dates', () => {
    const csv = [
      'Date,Meter,Gas Differential ($/Mcf)',
      'bad-date,Rangel Behrens,-0.2',
      '2025-03-01,Rangel Behrens,-0.1',
    ].join('\n')

    const out = parseMidstreamGptCSVText(csv)
    expect(out.rows).toHaveLength(1)
    expect(out.warnings.join(' ')).toMatch(/invalid date/i)
    expect(out.warnings.join(' ')).toMatch(/missing inlet volume/i)
  })

  it('throws when required columns are missing', () => {
    const csv = [
      'Foo,Bar,Baz',
      '1,2,3',
    ].join('\n')
    expect(() => parseMidstreamGptCSVText(csv)).toThrow(/missing required columns/i)
  })
})

// ─── parseMidstreamGptCSVWithMapping ──────────────────────────────────────────

describe('parseMidstreamGptCSVWithMapping', () => {
  const CSV_HEADER = 'Month,Plant,Gross Inlet (MCF),NGL (BBL),Fee 1 Amount,Fee 2 Amount,Fee 3 Amount,Fee 4 Amount'
  const CSV_ROW    = '2025-01,Rangel Behrens,100000,2400,80000,45000,35000,25000'
  const CSV        = [CSV_HEADER, CSV_ROW].join('\n')

  // columnMap: header index positions for the CSV above
  const MAP = { serviceDate: 0, meterName: 1, inletVolumeMcf: 2, nglVolumeBbl: 3, fee1Amount: 4, fee2Amount: 5, fee3Amount: 6, fee4Amount: 7 }

  it('parses a row with an explicit column map', () => {
    const out = parseMidstreamGptCSVWithMapping(CSV, MAP)
    expect(out.rows).toHaveLength(1)
    expect(out.rows[0].meterName).toBe('Rangel Behrens')
    expect(out.rows[0].inletVolumeMcf).toBe(100000)
    expect(out.rows[0].totalMidstreamFee).toBe(185000)
    expect(out.warnings).toEqual([])
  })

  it('assigns monthKey correctly from YYYY-MM date format', () => {
    const out = parseMidstreamGptCSVWithMapping(CSV, MAP)
    expect(out.rows[0].monthKey).toBe('2025-01')
  })

  it('derives totalMidstreamFee from Fee 1-4 amount fields', () => {
    const csv = [
      'Date,Meter,Inlet,Fee 1 Amount,Fee 2 Amount',
      '2025-02-01,Well A,80000,60000,45000',
    ].join('\n')
    const map = { serviceDate: 0, meterName: 1, inletVolumeMcf: 2, fee1Amount: 3, fee2Amount: 4 }
    const out = parseMidstreamGptCSVWithMapping(csv, map)
    expect(out.rows[0].totalMidstreamFee).toBe(105000)
  })

  it('converts NGL volume from gallons to BBL when unitOverrides.nglVolumeBbl = gallons', () => {
    const csv = [
      'Date,Meter,Inlet,NGL Gallons,Total Fee',
      '2025-03-01,Well A,90000,42000,100000',
    ].join('\n')
    const map = { serviceDate: 0, meterName: 1, inletVolumeMcf: 2, nglVolumeBbl: 3, totalMidstreamFee: 4 }
    const out = parseMidstreamGptCSVWithMapping(csv, map, { nglVolumeBbl: 'gallons' })
    expect(out.rows[0].nglVolumeBbl).toBeCloseTo(1000)
  })

  it('warns about bad dates and skips those rows', () => {
    const csv = [
      'Date,Meter,Inlet,Total Fee',
      'bad-date,Well A,50000,80000',
      '2025-04-01,Well A,50000,80000',
    ].join('\n')
    const map = { serviceDate: 0, meterName: 1, inletVolumeMcf: 2, totalMidstreamFee: 3 }
    const out = parseMidstreamGptCSVWithMapping(csv, map)
    expect(out.rows).toHaveLength(1)
    expect(out.warnings.join(' ')).toMatch(/invalid date/i)
  })

  it('throws when the date column is not mapped', () => {
    const map = { meterName: 0, inletVolumeMcf: 1, totalMidstreamFee: 2 }
    expect(() => parseMidstreamGptCSVWithMapping(CSV, map)).toThrow(/date column not mapped/i)
  })

  it('throws when no valid rows are produced', () => {
    const csv = [
      'Date,Meter,Inlet,Total Fee',
      'bad-date,Well A,50000,80000',
    ].join('\n')
    const map = { serviceDate: 0, meterName: 1, inletVolumeMcf: 2, totalMidstreamFee: 3 }
    expect(() => parseMidstreamGptCSVWithMapping(csv, map)).toThrow(/no valid midstream gpt rows/i)
  })

  it('defaults meterName to "Statement Meter" when meter column is not in map', () => {
    const csv = [
      'Date,Inlet,Total Fee',
      '2025-05-01,70000,90000',
    ].join('\n')
    const map = { serviceDate: 0, inletVolumeMcf: 1, totalMidstreamFee: 2 }
    const out = parseMidstreamGptCSVWithMapping(csv, map)
    expect(out.rows[0].meterName).toBe('Statement Meter')
  })

  it('warns about missing inlet volume but still includes the row', () => {
    const csv = [
      'Date,Meter,Inlet,Fee 1 Amount',
      '2025-06-01,Well A,,90000',
    ].join('\n')
    const map = { serviceDate: 0, meterName: 1, inletVolumeMcf: 2, fee1Amount: 3 }
    const out = parseMidstreamGptCSVWithMapping(csv, map)
    expect(out.rows).toHaveLength(1)
    expect(out.rows[0].inletVolumeMcf).toBeNull()
    expect(out.warnings.join(' ')).toMatch(/missing inlet volume/i)
  })
})
