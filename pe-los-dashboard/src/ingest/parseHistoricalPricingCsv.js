import Papa from 'papaparse'
import { monthKey, monthDisp, parseDate } from './parseCsv.js'

function normalizeHeader(value) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function buildHeaderIndex(headers) {
  const out = {}
  headers.forEach((h, i) => {
    const k = normalizeHeader(h)
    if (k && out[k] === undefined) out[k] = i
  })
  return out
}

function findIndex(index, aliases) {
  for (const a of aliases) {
    const i = index[normalizeHeader(a)]
    if (i !== undefined) return i
  }
  return -1
}

function parsePricingDate(raw) {
  const text = (raw || '').toString().trim()
  if (!text) return null

  const losDate = parseDate(text)
  if (losDate) return new Date(losDate.getFullYear(), losDate.getMonth(), 1)

  const ym = text.match(/^(\d{4})-(\d{2})$/)
  if (ym) {
    const y = Number(ym[1])
    const m = Number(ym[2]) - 1
    if (m < 0 || m > 11) return null
    return new Date(y, m, 1)
  }

  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymd) {
    const y = Number(ymd[1])
    const m = Number(ymd[2]) - 1
    const d = Number(ymd[3])
    const check = new Date(y, m, d)
    if (check.getFullYear() !== y || check.getMonth() !== m || check.getDate() !== d) return null
    return new Date(y, m, 1)
  }

  if (text.includes('/')) return null

  const parsed = new Date(text)
  if (!isNaN(parsed.getTime())) return new Date(parsed.getFullYear(), parsed.getMonth(), 1)
  return null
}

function parseNum(raw) {
  if (raw == null || raw === '') return null
  const n = parseFloat(raw.toString().replace(/,/g, '').trim())
  return isNaN(n) ? null : n
}

export function parseHistoricalPricingCSVText(text) {
  const cleaned = (text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const parsed = Papa.parse(cleaned, { header: false, skipEmptyLines: true })
  const rows = parsed.data || []
  if (!rows.length) throw new Error('Historical pricing CSV appears empty.')

  const headers = rows[0]
  const headerIndex = buildHeaderIndex(headers)

  const dateIdx = findIndex(headerIndex, ['date', 'month', 'pricing date', 'price date', 'service end date'])
  const wtiIdx = findIndex(headerIndex, ['wti', 'wti price', 'wti cushing'])
  const hhIdx = findIndex(headerIndex, ['henry hub', 'henryhub', 'hh', 'hh price'])
  const mehIdx = findIndex(headerIndex, ['meh', 'meh price'])
  const hscIdx = findIndex(headerIndex, ['hsc', 'hsc price'])
  const mehBasisIdx = findIndex(headerIndex, ['meh basis', 'meh differential', 'meh diff', 'meh basis differential'])
  const hscBasisIdx = findIndex(headerIndex, ['hsc basis', 'hsc differential', 'hsc diff', 'hsc basis differential'])

  if (dateIdx === -1) {
    throw new Error('Missing date column. Add a "Date" or "Month" column.')
  }
  if (wtiIdx === -1 && hhIdx === -1 && mehIdx === -1 && hscIdx === -1 && mehBasisIdx === -1 && hscBasisIdx === -1) {
    throw new Error('No recognizable pricing columns found. Include WTI, Henry Hub, MEH/HSC, or basis columns.')
  }

  const out = []
  const warnings = []
  let skippedBadDate = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || []
    if (!row.length) continue
    const rowNumber = i + 1

    const date = parsePricingDate(row[dateIdx])
    if (!date) {
      skippedBadDate++
      continue
    }

    const wti = wtiIdx >= 0 ? parseNum(row[wtiIdx]) : null
    const henryHub = hhIdx >= 0 ? parseNum(row[hhIdx]) : null
    const mehProvided = mehIdx >= 0 ? parseNum(row[mehIdx]) : null
    const hscProvided = hscIdx >= 0 ? parseNum(row[hscIdx]) : null
    let mehBasis = mehBasisIdx >= 0 ? parseNum(row[mehBasisIdx]) : null
    let hscBasis = hscBasisIdx >= 0 ? parseNum(row[hscBasisIdx]) : null

    if (mehBasis == null && mehProvided != null && wti != null) mehBasis = mehProvided - wti
    if (hscBasis == null && hscProvided != null && henryHub != null) hscBasis = hscProvided - henryHub

    const mehImplied = (wti != null && mehBasis != null) ? (wti + mehBasis) : null
    const hscImplied = (henryHub != null && hscBasis != null) ? (henryHub + hscBasis) : null
    const meh = mehProvided != null ? mehProvided : mehImplied
    const hsc = hscProvided != null ? hscProvided : hscImplied

    const hasData = [wti, henryHub, meh, hsc, mehBasis, hscBasis].some(v => v != null)
    if (!hasData) continue

    out.push({
      rowNumber,
      date,
      monthKey: monthKey(date),
      monthDisp: monthDisp(date),
      wti,
      henryHub,
      meh,
      hsc,
      mehProvided,
      hscProvided,
      mehBasis,
      hscBasis,
      mehImplied,
      hscImplied,
    })
  }

  out.sort((a, b) => a.date - b.date)
  if (skippedBadDate > 0) {
    warnings.push(`${skippedBadDate} row(s) skipped - invalid date in historical pricing file.`)
  }
  if (!out.length) {
    throw new Error('No valid historical pricing rows found after parsing.')
  }

  return { rows: out, warnings }
}
