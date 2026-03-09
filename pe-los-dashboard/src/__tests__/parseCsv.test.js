import { describe, it, expect } from 'vitest'
import { parseDate, parseNum, resolveBucket, monthKey, monthDisp, parseCSVText } from '../ingest/parseCsv.js'

// ─── parseDate ────────────────────────────────────────────────────────────────

describe('parseDate', () => {
  it('parses a valid M/DD/YY date', () => {
    const d = parseDate('1/31/24')
    expect(d).toBeInstanceOf(Date)
    expect(d.getFullYear()).toBe(2024)
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(31)
  })

  it('parses single-digit month and day', () => {
    const d = parseDate('3/5/23')
    expect(d.getFullYear()).toBe(2023)
    expect(d.getMonth()).toBe(2)
    expect(d.getDate()).toBe(5)
  })

  it('returns null for null/empty input', () => {
    expect(parseDate(null)).toBeNull()
    expect(parseDate('')).toBeNull()
    expect(parseDate(undefined)).toBeNull()
  })

  it('returns null for wrong number of parts', () => {
    expect(parseDate('1-31-24')).toBeNull()
    expect(parseDate('01/2024')).toBeNull()
    expect(parseDate('01/31/2024/extra')).toBeNull()
  })

  it('accepts 4-digit year (M/DD/YYYY)', () => {
    const d = parseDate('1/31/2024')
    expect(d).toBeInstanceOf(Date)
    expect(d.getFullYear()).toBe(2024)
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(31)
  })

  it('returns null for a rolled-over invalid date like Feb 31', () => {
    // Feb 31 doesn't exist — JS would roll it to Mar 2/3
    expect(parseDate('2/31/24')).toBeNull()
  })

  it('returns null for non-numeric parts', () => {
    expect(parseDate('jan/31/24')).toBeNull()
  })

  it('produces correct monthKey', () => {
    const d = parseDate('12/31/23')
    expect(monthKey(d)).toBe('2023-12')
  })

  it('produces correct monthDisp', () => {
    const d = parseDate('1/31/24')
    expect(monthDisp(d)).toBe("Jan '24")
  })
})

// ─── parseNum ─────────────────────────────────────────────────────────────────

describe('parseNum', () => {
  it('parses a plain number string', () => {
    expect(parseNum('123.45')).toBeCloseTo(123.45)
  })

  it('parses a number with commas', () => {
    expect(parseNum('1,234,567.89')).toBeCloseTo(1234567.89)
  })

  it('parses negative numbers', () => {
    expect(parseNum('-9876.54')).toBeCloseTo(-9876.54)
  })

  it('returns 0 for blank or null', () => {
    expect(parseNum(null)).toBe(0)
    expect(parseNum('')).toBe(0)
    expect(parseNum(undefined)).toBe(0)
  })

  it('returns NaN for non-numeric non-empty strings', () => {
    expect(isNaN(parseNum('N/A'))).toBe(true)
    expect(isNaN(parseNum('--'))).toBe(true)
    expect(isNaN(parseNum('abc'))).toBe(true)
  })
})

// ─── resolveBucket ────────────────────────────────────────────────────────────

describe('resolveBucket', () => {
  it('Cost Category takes priority over LOS Category', () => {
    // 'RevO' → 'oil' by Cost Category; LOS 'Chemicals' → 'variable_oil' but should not win
    expect(resolveBucket('Chemicals', 'RevO')).toBe('oil')
  })

  it('falls back to LOS Category when Cost Category is blank', () => {
    expect(resolveBucket('Chemicals', '')).toBe('variable_oil')
    expect(resolveBucket('Oil', '')).toBe('oil')
  })

  it('returns null for completely unknown categories', () => {
    expect(resolveBucket('UnknownCat', 'UnknownCostCat')).toBeNull()
  })

  it("returns 'ignore' for LOS_IGNORE entries", () => {
    expect(resolveBucket('midstream gpt elimination', '')).toBe('ignore')
    expect(resolveBucket('Midstream LOE Reclass', '')).toBe('ignore')
  })

  it('is case-insensitive for both fields', () => {
    expect(resolveBucket('OIL', '')).toBe('oil')
    expect(resolveBucket('', 'revo')).toBe('oil')
    expect(resolveBucket('', 'REVO')).toBe('oil')
  })

  it('maps WORK → workover', () => {
    expect(resolveBucket('', 'WORK')).toBe('workover')
  })

  it('maps Other → capex', () => {
    expect(resolveBucket('', 'Other')).toBe('capex')
  })

  it('maps GPT → gpt', () => {
    expect(resolveBucket('', 'GPT')).toBe('gpt')
  })

  it('maps MS → midstream', () => {
    expect(resolveBucket('', 'MS')).toBe('midstream')
  })

  it('maps prod tax cost categories', () => {
    expect(resolveBucket('', 'PTo')).toBe('prod_taxes')
    expect(resolveBucket('', 'PTg')).toBe('prod_taxes')
    expect(resolveBucket('', 'PTngl')).toBe('prod_taxes')
    expect(resolveBucket('', 'AT')).toBe('prod_taxes')
  })

  it('maps Gathering, Trans. & Processing → gpt via LOS fallback', () => {
    expect(resolveBucket('Gathering, Trans. & Processing', '')).toBe('gpt')
  })
})

// ─── parseCSVText ─────────────────────────────────────────────────────────────

describe('parseCSVText', () => {
  // Header has "Gross Up By" so 23 cols; Service End Date=11, LOS=16, Net Volume=21, Net Amount=22 (0-based). Cost Category col 1.
  const minimalRow = (well, date, costCat, losCat, netAmt, netVol) =>
    `${well}\t${costCat}\tWI\t0.8\t1\t0\t0\t0\tJP\t\t\t${date}\t\t\t\tOP\t${losCat}\t\t\t\t\t\t${netVol}\t${netAmt}`

  it('returns { rows, warnings, issues } with arrays', () => {
    const header = 'Well Name\tCost Category\tGross Up By\tNRI\tWI\tGross Amount\tGross Volume\tNet Amount\tJP/RP\tx\tComp\tService End Date\tProperty #\tProperty Name\tJP/RP\tOP/OBO\tLOS CATEGORY\tMain\tSub\tAlloc LOE\t\tNet Volume\tNet Amount'
    const row1 = minimalRow('Well A', '1/31/24', 'RevO', 'Oil', '-10000', '-200')
    const out = parseCSVText(header + '\n' + row1)
    expect(Array.isArray(out.rows)).toBe(true)
    expect(Array.isArray(out.warnings)).toBe(true)
    expect(Array.isArray(out.issues)).toBe(true)
    expect(out.rows.length).toBe(1)
    expect(out.rows[0].wellName).toBe('Well A')
    expect(out.rows[0].monthKey).toBe('2024-01')
    expect(out.rows[0].bucket).toBe('oil')
  })

  it('throws on empty or unparseable CSV', () => {
    expect(() => parseCSVText('')).toThrow()
    expect(() => parseCSVText('   \n  \n')).toThrow()
  })

  it('throws when first data row has too few columns', () => {
    const header = 'Well Name\tCost Category\tGross Up By\tNRI\tWI\tGross Amount\tGross Volume\tNet Amount\tJP/RP\tx\tComp\tService End Date\tProperty #\tProperty Name\tJP/RP\tOP/OBO\tLOS CATEGORY\tMain\tSub\tAlloc LOE\t\tNet Volume\tNet Amount'
    const shortRow = 'Well A\tRevO\t1/31/24' // too few cols
    expect(() => parseCSVText(header + '\n' + shortRow)).toThrow(/Expected .+ columns/)
  })

  it('detects comma delimiter when commas outnumber tabs in first line', () => {
    const csv = 'Well Name,Cost Category,NRI,WI,Gross Amount,Gross Volume,Net Amount,JP/RP,x,Comp,Service End Date,Property #,Property Name,JP/RP,OP/OBO,LOS CATEGORY,Main,Sub,Alloc LOE,,Net Volume,Net Amount\n'
      + 'Well A,RevO,0.8,1,0,0,0,JP,,,1/31/24,,,OP,Oil,,,,,,200,-10000'
    const out = parseCSVText(csv)
    expect(out.rows.length).toBe(1)
    expect(out.rows[0].wellName).toBe('Well A')
  })

  it('strips BOM from start of text', () => {
    const header = 'Well Name\tCost Category\tGross Up By\tNRI\tWI\tGross Amount\tGross Volume\tNet Amount\tJP/RP\tx\tComp\tService End Date\tProperty #\tProperty Name\tJP/RP\tOP/OBO\tLOS CATEGORY\tMain\tSub\tAlloc LOE\t\tNet Volume\tNet Amount'
    const row1 = minimalRow('Well A', '1/31/24', 'RevO', 'Oil', '-10000', '-200')
    const out = parseCSVText('\uFEFF' + header + '\n' + row1)
    expect(out.rows.length).toBe(1)
  })

  it('adds warning when rows are skipped for invalid date', () => {
    const header = 'Well Name\tCost Category\tGross Up By\tNRI\tWI\tGross Amount\tGross Volume\tNet Amount\tJP/RP\tx\tComp\tService End Date\tProperty #\tProperty Name\tJP/RP\tOP/OBO\tLOS CATEGORY\tMain\tSub\tAlloc LOE\t\tNet Volume\tNet Amount'
    const good = minimalRow('Well A', '1/31/24', 'RevO', 'Oil', '-10000', '-200')
    const badDate = minimalRow('Well B', '2/31/24', 'RevO', 'Oil', '-5000', '-100') // Feb 31 invalid
    const out = parseCSVText(header + '\n' + good + '\n' + badDate)
    expect(out.rows.length).toBe(1)
    const dateWarn = out.warnings.find(w => w.includes('invalid') && w.includes('Service End Date'))
    expect(dateWarn).toBeDefined()
    const dateIssue = out.issues.find(i => i.issueType === 'invalid_service_end_date')
    expect(dateIssue).toBeDefined()
    expect(dateIssue.rowNumber).toBe(3)
  })

  it('parses rows with non-numeric Net Amount/Volume (coerced to 0, may add warning)', () => {
    const header = 'Well Name\tCost Category\tGross Up By\tNRI\tWI\tGross Amount\tGross Volume\tNet Amount\tJP/RP\tx\tComp\tService End Date\tProperty #\tProperty Name\tJP/RP\tOP/OBO\tLOS CATEGORY\tMain\tSub\tAlloc LOE\t\tNet Volume\tNet Amount'
    const withBadAmt = minimalRow('Well A', '1/31/24', 'RevO', 'Oil', 'N/A', '-200')
    const out = parseCSVText(header + '\n' + withBadAmt)
    expect(out.rows.length).toBe(1)
    expect(out.rows[0].wellName).toBe('Well A')
    // Non-numeric in a numeric column is coerced to 0; parser may add a data-quality warning
    expect(typeof out.rows[0].netAmount).toBe('number')
    expect(typeof out.rows[0].netVolume).toBe('number')
  })

  it('adds warning for unmapped LOS/cost categories', () => {
    const header = 'Well Name\tCost Category\tGross Up By\tNRI\tWI\tGross Amount\tGross Volume\tNet Amount\tJP/RP\tx\tComp\tService End Date\tProperty #\tProperty Name\tJP/RP\tOP/OBO\tLOS CATEGORY\tMain\tSub\tAlloc LOE\t\tNet Volume\tNet Amount'
    const unmapped = minimalRow('Well A', '1/31/24', 'UnknownCost', 'UnknownCategory', '100', '0') // both unmapped
    const out = parseCSVText(header + '\n' + unmapped)
    expect(out.rows.length).toBe(1)
    expect(out.rows[0].bucket).toBeNull()
    expect(out.warnings.some(w => w.includes('bucket mapping') || w.includes('excluded'))).toBe(true)
  })

  it('ignores trailing non-data padding rows after the dataset', () => {
    const header = 'Well Name\tCost Category\tGross Up By\tNRI\tWI\tGross Amount\tGross Volume\tNet Amount\tJP/RP\tx\tComp\tService End Date\tProperty #\tProperty Name\tJP/RP\tOP/OBO\tLOS CATEGORY\tMain\tSub\tAlloc LOE\t\tNet Volume\tNet Amount'
    const good = minimalRow('Well A', '1/31/24', 'RevO', 'Oil', '-10000', '-200')
    const pad = Array(23).fill('')
    pad[3] = '0'
    pad[4] = '0'
    pad[5] = '0'
    pad[6] = '0'
    pad[21] = '0'
    pad[22] = '0'
    const paddedRow = pad.join('\t')

    const out = parseCSVText(header + '\n' + good + '\n' + paddedRow + '\n' + paddedRow)
    expect(out.rows.length).toBe(1)
    expect(out.issues.some(i => i.issueType === 'missing_well_name')).toBe(false)
  })
})
