import { describe, it, expect } from 'vitest'
import { parseMidstreamGptCSVText } from '../ingest/parseMidstreamGptCsv.js'

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
