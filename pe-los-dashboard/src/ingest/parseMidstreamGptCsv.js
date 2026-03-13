import Papa from 'papaparse'
import { GPT_COLUMN_ALIASES } from '../constants/gptMapping.js'
import { NGL_COMPONENTS, NGL_FORMULAS } from '../constants/gptConfig.js'
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
  headers.forEach((header, idx) => {
    const key = normalizeHeader(header)
    if (key && out[key] === undefined) out[key] = idx
  })
  return out
}

function findIndex(index, aliases) {
  for (const alias of aliases || []) {
    const idx = index[normalizeHeader(alias)]
    if (idx !== undefined) return idx
  }
  return -1
}

function parseMidstreamDate(raw) {
  const text = (raw || '').toString().trim()
  if (!text) return null

  const losDate = parseDate(text)
  if (losDate) return new Date(losDate.getFullYear(), losDate.getMonth(), 1)

  const ym = text.match(/^(\d{4})-(\d{2})$/)
  if (ym) {
    const year = Number(ym[1])
    const month = Number(ym[2]) - 1
    if (month < 0 || month > 11) return null
    return new Date(year, month, 1)
  }

  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymd) {
    const year = Number(ymd[1])
    const month = Number(ymd[2]) - 1
    const day = Number(ymd[3])
    const check = new Date(year, month, day)
    if (check.getFullYear() !== year || check.getMonth() !== month || check.getDate() !== day) return null
    return new Date(year, month, 1)
  }

  if (text.includes('/')) return null

  const parsed = new Date(text)
  if (isNaN(parsed.getTime())) return null
  return new Date(parsed.getFullYear(), parsed.getMonth(), 1)
}

function parseNum(raw) {
  if (raw == null || raw === '') return null
  const cleaned = raw
    .toString()
    .trim()
    .replace(/[$,%]/g, '')
    .replace(/[()]/g, match => (match === '(' ? '-' : ''))
    .replace(/,/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function parseText(raw) {
  return (raw || '').toString().trim()
}

function parseField(row, fieldIdx) {
  const idx = fieldIdx
  if (idx == null || idx < 0) return null
  return parseNum(row[idx])
}

function parseWithDelimiter(text, delimiter) {
  const parsed = Papa.parse(text, { delimiter, header: false, skipEmptyLines: true })
  const rows = parsed.data || []
  if (!rows.length) return null

  const headers = rows[0] || []
  const index = buildHeaderIndex(headers)
  const dateIdx = findIndex(index, GPT_COLUMN_ALIASES.date)
  if (dateIdx === -1) return null

  return { rows, headers, index }
}

function detectDelimiter(text) {
  for (const delimiter of ['\t', ',', ';']) {
    const attempt = parseWithDelimiter(text, delimiter)
    if (attempt) return { ...attempt, delimiter }
  }
  const fallback = Papa.parse(text, { header: false, skipEmptyLines: true })
  const rows = fallback.data || []
  if (!rows.length) throw new Error('Midstream GPT statement appears empty.')
  throw new Error('Missing required columns. Include at least Date and Meter columns.')
}

function hasAtLeastOneComputableInput(row) {
  const keys = [
    'inletVolumeMcf', 'nglVolumeBbl', 'gasShrinkPct', 'gasShrinkMcf',
    'nglYield',
    'btuFactor', 'gasDifferential', 'residueGasSales', 'residueGasVolumeMcf',
    'wtiPrice', 'nglRealizedPrice', 'nglSales', 'totalMidstreamFee',
  ]
  return keys.some(k => row[k] != null)
}

export function parseMidstreamGptCSVText(text) {
  const cleaned = (text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const { rows, index, headers } = detectDelimiter(cleaned)

  const fieldIdx = {}
  Object.entries(GPT_COLUMN_ALIASES).forEach(([key, aliases]) => {
    fieldIdx[key] = findIndex(index, aliases)
  })

  const warnings = []
  const out = []
  let badDateRows = 0
  let blankMeterRows = 0
  let noSignalRows = 0
  let missingInletRows = 0
  const meterIdx = fieldIdx.meterName

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || []
    if (!row.length) continue

    const date = parseMidstreamDate(row[fieldIdx.date])
    if (!date) {
      badDateRows++
      continue
    }

    const meterName = parseText(row[meterIdx]) || 'Statement Meter'
    if (!parseText(row[meterIdx])) blankMeterRows++

    const parsed = {
      rowNumber: i + 1,
      date,
      monthKey: monthKey(date),
      monthDisp: monthDisp(date),
      meterName,
      inletVolumeMcf: parseField(row, fieldIdx.inletVolumeMcf),
      nglVolumeBbl: parseField(row, fieldIdx.nglVolumeBbl),
      nglYield: parseField(row, fieldIdx.nglYield),
      gasShrinkPct: parseField(row, fieldIdx.gasShrinkPct),
      gasShrinkMcf: parseField(row, fieldIdx.gasShrinkMcf),
      btuFactor: parseField(row, fieldIdx.btuFactor),
      residueGasVolumeMcf: parseField(row, fieldIdx.residueGasVolumeMcf),
      residueGasSales: parseField(row, fieldIdx.residueGasSales),
      gasDifferential: parseField(row, fieldIdx.gasDifferential),
      hhubPrice: parseField(row, fieldIdx.hhubPrice),
      benchmarkGasPrice: parseField(row, fieldIdx.benchmarkGasPrice),
      wtiPrice: parseField(row, fieldIdx.wtiPrice),
      nglRealizedPrice: parseField(row, fieldIdx.nglRealizedPrice),
      nglSales: parseField(row, fieldIdx.nglSales),
      nglDifferentialPct: parseField(row, fieldIdx.nglDifferentialPct),
      totalMidstreamFee: parseField(row, fieldIdx.totalMidstreamFee),
      gatheringFee: parseField(row, fieldIdx.gatheringFee),
      processingFee: parseField(row, fieldIdx.processingFee),
      compressionFee: parseField(row, fieldIdx.compressionFee),
      treatingFee: parseField(row, fieldIdx.treatingFee),
      otherMidstreamFee: parseField(row, fieldIdx.otherMidstreamFee),
    }

    if (parsed.totalMidstreamFee == null) {
      const feeParts = [
        parsed.gatheringFee,
        parsed.processingFee,
        parsed.compressionFee,
        parsed.treatingFee,
        parsed.otherMidstreamFee,
      ].filter(v => v != null)
      if (feeParts.length > 0) {
        parsed.totalMidstreamFee = feeParts.reduce((sum, val) => sum + val, 0)
      }
    }

    const nglHeader = (headers[fieldIdx.nglVolumeBbl] || '').toString().toLowerCase()
    if (parsed.nglVolumeBbl != null && nglHeader.includes('gallon')) {
      parsed.nglVolumeBbl = parsed.nglVolumeBbl / 42
    }

    // Derive residue BTU factor: Post-POP Residue MMBtu / Post-POP Residue Mcf.
    // Distinct from the inlet BTU factor — residue gas is dry (NGL removed), so
    // its heat content per Mcf is lower than the wet wellhead gas.
    if (parsed.settlementResWithContract != null && parsed.residueGasVolumeMcf != null && parsed.residueGasVolumeMcf > 0) {
      parsed.residueBtuFactor = parsed.settlementResWithContract / parsed.residueGasVolumeMcf
    }

    if (!hasAtLeastOneComputableInput(parsed)) {
      noSignalRows++
      continue
    }
    if (parsed.inletVolumeMcf == null || parsed.inletVolumeMcf <= 0) {
      missingInletRows++
    }

    out.push(parsed)
  }

  out.sort((a, b) => a.date - b.date || a.meterName.localeCompare(b.meterName))

  if (badDateRows > 0) warnings.push(`${badDateRows} row(s) skipped - invalid date in midstream GPT file.`)
  if (blankMeterRows > 0) warnings.push(`${blankMeterRows} row(s) had no meter column/value; defaulted to "Statement Meter".`)
  if (noSignalRows > 0) warnings.push(`${noSignalRows} row(s) skipped - no recognizable GPT metrics were found.`)
  if (missingInletRows > 0) warnings.push(`${missingInletRows} row(s) are missing inlet volume; GPT $/Mcf cannot be computed for those rows.`)

  if (!out.length) {
    throw new Error('No valid midstream GPT rows found after parsing.')
  }

  return { rows: out, warnings }
}

/**
 * Parse midstream GPT statement CSV using a pre-confirmed column mapping from DataSourceMapper.
 * The columnMap uses canonical field IDs from fieldRegistry.js, which align with
 * GPT_COLUMN_ALIASES keys (e.g. inletVolumeMcf, nglVolumeBbl, totalMidstreamFee).
 *
 * @param {string} text - Raw CSV text.
 * @param {{ [canonicalFieldId: string]: number }} columnMap
 * @param {{ [canonicalFieldId: string]: string }} [unitOverrides]
 * @returns {{ rows: object[], warnings: string[] }}
 */
export function parseMidstreamGptCSVWithMapping(text, columnMap, unitOverrides = {}) {
  const cleaned = (text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const { rows, headers } = detectDelimiter(cleaned)

  const cm = columnMap || {}
  // serviceDate is the DataSourceMapper canonical ID; GPT parser internally uses 'date'
  const fieldIdx = {
    date:                     cm.serviceDate             ?? cm.date          ?? -1,
    meterName:                cm.meterName               ?? -1,
    // Inlet gas — MCF column or MMBtu column (unit conversion applied below)
    inletVolumeMcf:           cm.inletVolumeMcf          ?? -1,
    inletVolumeMmBtu:         cm.inletVolumeMmBtu        ?? -1,
    fieldFuelMcf:             cm.fieldFuelMcf            ?? -1,
    fieldFuelMmBtu:           cm.fieldFuelMmBtu          ?? -1,
    netDeliveredMcf:          cm.netDeliveredMcf         ?? -1,
    netDeliveredMmBtu:        cm.netDeliveredMmBtu       ?? -1,
    totalShrinkMmBtu:         cm.totalShrinkMmBtu        ?? -1,
    plantFuelLossMmBtu:       cm.plantFuelLossMmBtu      ?? -1,
    gasShrinkPct:             cm.gasShrinkPct            ?? -1,
    gasShrinkMcf:             cm.gasShrinkMcf            ?? -1,
    btuFactor:                cm.btuFactor               ?? -1,
    // Residue gas settlement
    settlementResidueMmBtu:   cm.settlementResidueMmBtu  ?? -1,
    globalContractPct:        cm.globalContractPct       ?? -1,
    settlementResWithContract: cm.settlementResWithContract ?? -1,
    residuePricePerMmBtu:     cm.residuePricePerMmBtu    ?? -1,
    residueGasVolumeMcf:      cm.residueGasVolumeMcf     ?? -1,
    residueGasSales:          cm.residueGasSales         ?? cm.producersResidueValue ?? -1,
    gasDifferential:          cm.gasDifferential         ?? -1,
    hhubPrice:                cm.hhubPrice               ?? -1,
    benchmarkGasPrice:        cm.benchmarkGasPrice       ?? -1,
    // NGL aggregate
    nglVolumeBbl:             cm.nglVolumeBbl            ?? -1,
    nglYield:                 cm.nglYield                ?? -1,
    nglSales:                 cm.nglSales                ?? -1,
    nglRealizedPrice:         cm.nglRealizedPrice        ?? -1,
    nglDifferentialPct:       cm.nglDifferentialPct      ?? -1,
    wtiPrice:                 cm.wtiPrice                ?? -1,
    // Midstream fees (current workflow): Fee 1-4 only.
    // Legacy named/total fields are retained for backward compatibility.
    totalMidstreamFee:        cm.totalMidstreamFee       ?? -1,
    gatheringFee:             cm.gatheringFee            ?? -1,
    processingFee:            cm.processingFee           ?? -1,
    compressionFee:           cm.compressionFee          ?? -1,
    treatingFee:              cm.treatingFee             ?? -1,
    otherMidstreamFee:        cm.otherMidstreamFee       ?? -1,
    // Generic fee amount slots
    fee1Amount:               cm.fee1Amount              ?? -1,
    fee2Amount:               cm.fee2Amount              ?? -1,
    fee3Amount:               cm.fee3Amount              ?? -1,
    fee4Amount:               cm.fee4Amount              ?? -1,
  }

  if (fieldIdx.date < 0) throw new Error('Date column not mapped. Please assign a Date / Month column in the field mapper.')

  // Build per-component column index map.
  // popGal and productValue may be directly provided in the statement (preferred over computed).
  const compFieldIdx = {}
  for (const comp of NGL_COMPONENTS) {
    const id = comp.id
    compFieldIdx[id] = {
      theoreticalGal: cm[`${id}TheoreticalGal`] ?? -1,
      allocatedGal:   cm[`${id}AllocatedGal`]   ?? -1,
      contractPct:    cm[`${id}ContractPct`]     ?? -1,
      popGal:         cm[`${id}PopGal`]          ?? -1,  // PRODUCT GALLONS WITH CONTRACT % APPLIED
      price:          cm[`${id}Price`]           ?? -1,
      productValue:   cm[`${id}ProductValue`]    ?? -1,  // directly provided product value
    }
  }
  const hasComponentData = NGL_COMPONENTS.some(c => {
    const cf = compFieldIdx[c.id]
    return cf.theoreticalGal >= 0 || cf.allocatedGal >= 0 || cf.popGal >= 0
  })

  const nglUnit = unitOverrides.nglVolumeBbl || null

  const warnings = []
  const out = []
  let badDateRows = 0, blankMeterRows = 0, noSignalRows = 0, missingInletRows = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || []
    if (!row.length) continue

    const date = parseMidstreamDate(row[fieldIdx.date])
    if (!date) { badDateRows++; continue }

    const meterRaw = fieldIdx.meterName >= 0 ? parseText(row[fieldIdx.meterName]) : ''
    const meterName = meterRaw || 'Statement Meter'
    if (!meterRaw) blankMeterRows++

    // ── Inlet volume and BTU factor ────────────────────────────────────────────
    // Priority order for btuFactor: (1) explicit column, (2) derived from ratio
    //   of MMBtu column ÷ MCF column, (3) default 1.025 (typical residue gas).
    const rawBtuFactor       = parseField(row, fieldIdx.btuFactor)
    const rawInletMcf        = parseField(row, fieldIdx.inletVolumeMcf)
    const rawInletMmBtu      = fieldIdx.inletVolumeMmBtu >= 0
      ? parseField(row, fieldIdx.inletVolumeMmBtu) : null

    // Derive BTU factor from the two gas-volume columns when available
    const derivedBtuFactor = (rawInletMmBtu != null && rawInletMcf != null && rawInletMcf > 0)
      ? rawInletMmBtu / rawInletMcf : null

    const btuFactor = rawBtuFactor ?? derivedBtuFactor ?? 1.025

    let inletVolumeMcf = rawInletMcf
    if (inletVolumeMcf == null && rawInletMmBtu != null) {
      inletVolumeMcf = rawInletMmBtu / btuFactor
    }

    const parsed = {
      rowNumber: i + 1,
      date,
      monthKey: monthKey(date),
      monthDisp: monthDisp(date),
      meterName,
      inletVolumeMcf,
      inletVolumeMmBtu:          rawInletMmBtu,
      btuFactor:                 rawBtuFactor ?? derivedBtuFactor,  // persisted for display/formulas
      nglVolumeBbl:              parseField(row, fieldIdx.nglVolumeBbl),
      nglYield:                  parseField(row, fieldIdx.nglYield),
      gasShrinkPct:              parseField(row, fieldIdx.gasShrinkPct),
      gasShrinkMcf:              parseField(row, fieldIdx.gasShrinkMcf),
      fieldFuelMcf:              parseField(row, fieldIdx.fieldFuelMcf) ??
        (parseField(row, fieldIdx.fieldFuelMmBtu) != null
          ? parseField(row, fieldIdx.fieldFuelMmBtu) / btuFactor : null),
      netDeliveredMcf:           parseField(row, fieldIdx.netDeliveredMcf) ??
        (parseField(row, fieldIdx.netDeliveredMmBtu) != null
          ? parseField(row, fieldIdx.netDeliveredMmBtu) / btuFactor : null),
      totalShrinkMmBtu:          parseField(row, fieldIdx.totalShrinkMmBtu),
      plantFuelLossMmBtu:        parseField(row, fieldIdx.plantFuelLossMmBtu),
      settlementResidueMmBtu:    parseField(row, fieldIdx.settlementResidueMmBtu),
      globalContractPct:         parseField(row, fieldIdx.globalContractPct),
      settlementResWithContract: parseField(row, fieldIdx.settlementResWithContract),
      residuePricePerMmBtu:      parseField(row, fieldIdx.residuePricePerMmBtu),
      residueGasVolumeMcf:       parseField(row, fieldIdx.residueGasVolumeMcf),
      residueGasSales:           parseField(row, fieldIdx.residueGasSales),
      gasDifferential:           parseField(row, fieldIdx.gasDifferential),
      hhubPrice:                 parseField(row, fieldIdx.hhubPrice),
      benchmarkGasPrice:         parseField(row, fieldIdx.benchmarkGasPrice),
      wtiPrice:                  parseField(row, fieldIdx.wtiPrice),
      nglRealizedPrice:          parseField(row, fieldIdx.nglRealizedPrice),
      nglSales:                  parseField(row, fieldIdx.nglSales),
      nglDifferentialPct:        parseField(row, fieldIdx.nglDifferentialPct),
      totalMidstreamFee:         parseField(row, fieldIdx.totalMidstreamFee),
      gatheringFee:              parseField(row, fieldIdx.gatheringFee),
      processingFee:             parseField(row, fieldIdx.processingFee),
      compressionFee:            parseField(row, fieldIdx.compressionFee),
      treatingFee:               parseField(row, fieldIdx.treatingFee),
      otherMidstreamFee:         parseField(row, fieldIdx.otherMidstreamFee),
      fee1Amount:                parseField(row, fieldIdx.fee1Amount),
      fee2Amount:                parseField(row, fieldIdx.fee2Amount),
      fee3Amount:                parseField(row, fieldIdx.fee3Amount),
      fee4Amount:                parseField(row, fieldIdx.fee4Amount),
    }

    // Current GPT fee policy: total fee is strictly Fee1 + Fee2 + Fee3 + Fee4.
    const feeParts = [
      parsed.fee1Amount,
      parsed.fee2Amount,
      parsed.fee3Amount,
      parsed.fee4Amount,
    ].filter(v => v != null)
    if (feeParts.length > 0) {
      parsed.totalMidstreamFee = feeParts.reduce((sum, value) => sum + value, 0)
    } else {
      parsed.totalMidstreamFee = null
    }

    if (parsed.nglVolumeBbl != null && nglUnit === 'gallons') {
      parsed.nglVolumeBbl = parsed.nglVolumeBbl / 42
    } else if (parsed.nglVolumeBbl != null && !nglUnit) {
      // Fallback: detect gallons from header keyword (preserve original auto behavior)
      const nglHeader = (headers[fieldIdx.nglVolumeBbl] || '').toString().toLowerCase()
      if (nglHeader.includes('gallon')) parsed.nglVolumeBbl = parsed.nglVolumeBbl / 42
    }

    // Derive residue BTU factor: Post-POP Residue MMBtu / Post-POP Residue Mcf.
    // Distinct from the inlet BTU factor — residue gas is dry (NGL removed).
    if (parsed.settlementResWithContract != null && parsed.residueGasVolumeMcf != null && parsed.residueGasVolumeMcf > 0) {
      parsed.residueBtuFactor = parsed.settlementResWithContract / parsed.residueGasVolumeMcf
    }

    // ── NGL component-level framework ─────────────────────────────────────────
    // For each component: theoretical × recovery % × POP % × price → product value.
    // popGal and productValue may be directly provided in the statement (preferred).
    // See NGL_FORMULAS in src/constants/gptConfig.js for all formula definitions.
    if (hasComponentData) {
      const nglComps = {}
      let nglTotalGal = 0

      for (const comp of NGL_COMPONENTS) {
        const cf = compFieldIdx[comp.id]
        const hasSomeData = cf.theoreticalGal >= 0 || cf.allocatedGal >= 0 || cf.popGal >= 0
        if (!hasSomeData) continue

        const theoreticalGal    = parseField(row, cf.theoreticalGal)
        const allocatedGal      = parseField(row, cf.allocatedGal)
        const rawContractPct    = cf.contractPct >= 0 ? parseField(row, cf.contractPct) : null
        const directPopGal      = cf.popGal >= 0 ? parseField(row, cf.popGal) : null
        const price             = cf.price >= 0 ? parseField(row, cf.price) : null
        const directProductValue = cf.productValue >= 0 ? parseField(row, cf.productValue) : null

        const recoveryPct    = NGL_FORMULAS.recoveryPct(allocatedGal, theoreticalGal)
        const contractFrac   = NGL_FORMULAS.contractFraction(rawContractPct ?? 100)
        const contractPctDisplay = (rawContractPct ?? 100) > 1
          ? (rawContractPct ?? 100)
          : (rawContractPct ?? 1) * 100

        // Prefer direct CSV value over computed; formulas are in gptConfig.js
        const popGal      = NGL_FORMULAS.popGal(allocatedGal, rawContractPct ?? 100, directPopGal)
        const productValue = NGL_FORMULAS.productValue(popGal, price, directProductValue)

        if (popGal != null) nglTotalGal += popGal

        nglComps[comp.id] = { theoreticalGal, allocatedGal, recoveryPct, contractPct: contractPctDisplay, popGal, price, productValue, hasData: true }
      }

      parsed.nglComponents = nglComps
      parsed.nglTotalGal = nglTotalGal > 0 ? nglTotalGal : null
      parsed.nglTotalBbl = nglTotalGal > 0 ? nglTotalGal / 42 : null
      // Component-derived yield takes precedence in formulas if available
      if (parsed.nglTotalBbl != null && parsed.inletVolumeMcf != null && parsed.inletVolumeMcf > 0) {
        parsed.nglYieldFromComponents = parsed.nglTotalBbl / parsed.inletVolumeMcf
        // Override nglVolumeBbl with component-derived total if not already set from a direct column
        if (parsed.nglVolumeBbl == null) parsed.nglVolumeBbl = parsed.nglTotalBbl
      }
    }

    if (!hasAtLeastOneComputableInput(parsed)) { noSignalRows++; continue }
    if (parsed.inletVolumeMcf == null || parsed.inletVolumeMcf <= 0) missingInletRows++

    out.push(parsed)
  }

  out.sort((a, b) => a.date - b.date || a.meterName.localeCompare(b.meterName))

  if (badDateRows > 0) warnings.push(`${badDateRows} row(s) skipped - invalid date in midstream GPT file.`)
  if (blankMeterRows > 0) warnings.push(`${blankMeterRows} row(s) had no meter column/value; defaulted to "Statement Meter".`)
  if (noSignalRows > 0) warnings.push(`${noSignalRows} row(s) skipped - no recognizable GPT metrics found.`)
  if (missingInletRows > 0) warnings.push(`${missingInletRows} row(s) are missing inlet volume; GPT $/Mcf cannot be computed for those rows.`)
  if (!out.length) throw new Error('No valid midstream GPT rows found. Check that Date and meter columns are correctly mapped.')

  return { rows: out, warnings }
}
