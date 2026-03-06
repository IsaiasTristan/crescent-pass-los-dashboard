import Papa from 'papaparse'
import { LOS_BUCKETS, COST_CATEGORY_BUCKETS } from '../constants/losMapping'

// Column indices (0-based) for the 22-column tab-delimited LOS file
const COL = {
  WELL_NAME:        0,
  COST_CATEGORY:    1,
  GROSS_UP_BY:      2,
  NRI:              3,
  WI:               4,
  GROSS_AMOUNT:     5,
  GROSS_VOLUME:     6,
  // NET_AMOUNT_1:  7  <- not used
  JP_RP:            8,
  // X:             9
  // COMP:          10
  SERVICE_END_DATE: 11,
  PROPERTY_NUM:     12,
  PROPERTY_NAME:    13,
  // JP_RP_2:       14
  OP_OBO:           15,
  LOS_CATEGORY:     16,
  // MAIN:          17
  // SUB:           18
  // ALLOC_LOE:     19
  NET_VOLUME:       20,
  NET_AMOUNT:       21,  // USE THIS — last column
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parseDate(raw) {
  if (!raw) return null
  const s = raw.toString().trim()
  const parts = s.split('/')
  if (parts.length !== 3) return null
  const m = parseInt(parts[0], 10) - 1
  const d = parseInt(parts[1], 10)
  const y = 2000 + parseInt(parts[2], 10)
  if (isNaN(m) || isNaN(d) || isNaN(y)) return null
  return new Date(y, m, d)
}

function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function toMonthDisplay(date) {
  return `${MONTH_NAMES[date.getMonth()]} '${String(date.getFullYear()).slice(2)}`
}

function parseNum(raw) {
  if (raw == null || raw === '') return 0
  const s = raw.toString().replace(/,/g, '').trim()
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

function resolveBucket(losCategory, costCategory) {
  if (losCategory && LOS_BUCKETS[losCategory] !== undefined) {
    return LOS_BUCKETS[losCategory]
  }
  return COST_CATEGORY_BUCKETS[costCategory] || null
}

export function parseCSVText(csvText) {
  const result = Papa.parse(csvText, {
    delimiter: '\t',
    header: false,
    skipEmptyLines: true,
  })

  if (!result.data || result.data.length === 0) {
    throw new Error('CSV file appears to be empty or could not be parsed.')
  }

  const rows = result.data

  // Skip header row if present (check if first cell looks like a label)
  let startIdx = 0
  const firstCell = (rows[0][COL.WELL_NAME] || '').toString().toLowerCase().trim()
  if (firstCell === 'well name' || firstCell === 'well' || firstCell === 'wellname') {
    startIdx = 1
  }

  // Validate we have enough columns
  const sampleRow = rows[startIdx]
  if (!sampleRow || sampleRow.length < 17) {
    throw new Error(
      `Expected at least 17 tab-delimited columns; found ${sampleRow?.length ?? 0}. ` +
      'Ensure the file uses tab delimiters, not commas.'
    )
  }

  const parsed = []
  let skipped = 0

  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 17) { skipped++; continue }

    const wellName = (row[COL.WELL_NAME] || '').toString().trim()
    if (!wellName) { skipped++; continue }

    const date = parseDate(row[COL.SERVICE_END_DATE])
    if (!date) { skipped++; continue }

    const losCategory = (row[COL.LOS_CATEGORY] || '').toString().trim()
    const costCategory = (row[COL.COST_CATEGORY] || '').toString().trim()
    const bucket = resolveBucket(losCategory, costCategory)

    parsed.push({
      wellName,
      costCategory,
      grossUpBy:    (row[COL.GROSS_UP_BY] || '').toString().trim(),
      nri:          parseNum(row[COL.NRI]),
      wi:           parseNum(row[COL.WI]),
      grossAmount:  parseNum(row[COL.GROSS_AMOUNT]),
      grossVolume:  parseNum(row[COL.GROSS_VOLUME]),
      jpRp:         (row[COL.JP_RP] || '').toString().trim(),
      date,
      monthKey:     toMonthKey(date),
      monthDisplay: toMonthDisplay(date),
      propertyNum:  (row[COL.PROPERTY_NUM] || '').toString().trim(),
      propertyName: (row[COL.PROPERTY_NAME] || '').toString().trim(),
      opObo:        (row[COL.OP_OBO] || '').toString().trim(),
      losCategory,
      bucket,
      netVolume:    parseNum(row[COL.NET_VOLUME]),
      netAmount:    parseNum(row[COL.NET_AMOUNT]),
    })
  }

  if (parsed.length === 0) {
    throw new Error(
      `No valid data rows found (${skipped} rows skipped). ` +
      'Check that Service End Date is in M/DD/YY format and Well Name is populated.'
    )
  }

  return parsed
}
