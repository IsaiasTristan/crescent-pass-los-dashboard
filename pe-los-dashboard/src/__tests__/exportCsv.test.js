import { describe, it, expect } from 'vitest'
import Papa from 'papaparse'
import { ARIES_INPUT_FIELDS } from '../constants/losMapping.js'
import { buildAriesExportRows, parseAriesImport } from '../export/exportCsv.js'

function makeCase(seed) {
  const out = {}
  ARIES_INPUT_FIELDS.forEach((field, idx) => {
    out[field.key] = String(seed + idx)
  })
  return out
}

describe('ARIES input export/import', () => {
  it('buildAriesExportRows includes all UI fields and metadata columns', () => {
    const ariesInputs = {
      vdrCase: { op: makeCase(1), obo: makeCase(101) },
      myCase:  { op: makeCase(201), obo: makeCase(301) },
    }
    const hist = { varOilPerBOE: 12.34, prodTaxPct: 5.6 }
    const rows = buildAriesExportRows(ariesInputs, hist)

    expect(rows).toHaveLength(ARIES_INPUT_FIELDS.length)
    expect(rows[0]).toHaveProperty('State Key')
    expect(rows[0]).toHaveProperty('Unit')
    expect(rows[0]).toHaveProperty('Hist Avg')
    expect(rows.find(r => r['State Key'] === 'varOilPerBOE')['Hist Avg']).toBe('12.34')
  })

  it('round-trips exported CSV back to all input values, including zero values', () => {
    const ariesInputs = {
      vdrCase: { op: makeCase(1), obo: makeCase(101) },
      myCase:  { op: makeCase(201), obo: makeCase(301) },
    }
    ariesInputs.vdrCase.op.varOilPerBOE = '0'
    ariesInputs.myCase.obo.nglDiffPct = '0'

    const rows = buildAriesExportRows(ariesInputs, {})
    const csv = Papa.unparse(rows)
    const parsed = parseAriesImport(csv)

    expect(parsed).toEqual(ariesInputs)
  })
})

