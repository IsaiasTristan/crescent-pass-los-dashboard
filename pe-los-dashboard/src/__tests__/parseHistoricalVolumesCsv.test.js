import { describe, it, expect } from 'vitest'
import { parseHistoricalVolumesCSVText } from '../ingest/parseHistoricalVolumesCsv.js'

describe('parseHistoricalVolumesCSVText', () => {
  it('parses comma-delimited gross-volume rows keyed by well name', () => {
    const csv = [
      'Month,Well Name,Gross Oil,Gross Gas,Gross NGL,Gross Water',
      '2024-01,Well A,100,200,30,400',
      '2024-02,Well A,110,210,31,410',
    ].join('\n')

    const out = parseHistoricalVolumesCSVText(csv)
    expect(out.rows).toHaveLength(2)
    expect(out.rows[0].monthKey).toBe('2024-01')
    expect(out.rows[0].wellName).toBe('Well A')
    expect(out.rows[0].grossWaterVolume).toBe(400)
    expect(out.warnings).toEqual([])
  })

  it('parses tab-delimited rows keyed by applicable tag', () => {
    const csv = [
      'Date\tApplicable Tag\tOp Status\tGross Water Volume',
      '1/31/24\t12345\tOPERATED\t800',
    ].join('\n')

    const out = parseHistoricalVolumesCSVText(csv)
    expect(out.rows).toHaveLength(1)
    expect(out.rows[0].applicableTag).toBe('12345')
    expect(out.rows[0].opStatus).toBe('op')
    expect(out.rows[0].grossWaterVolume).toBe(800)
  })

  it('warns on invalid dates and keeps valid rows', () => {
    const csv = [
      'Date,Well Name,Gross Water',
      '2/31/24,Well A,100',
      '3/31/24,Well A,200',
    ].join('\n')

    const out = parseHistoricalVolumesCSVText(csv)
    expect(out.rows).toHaveLength(1)
    expect(out.warnings[0]).toContain('invalid date')
  })

  it('throws when no identifier column exists', () => {
    const csv = [
      'Date,Gross Water',
      '2024-01,100',
    ].join('\n')

    expect(() => parseHistoricalVolumesCSVText(csv)).toThrow(/Missing required columns/i)
  })
})
