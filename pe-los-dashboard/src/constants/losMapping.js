// ─── LOS bucket mappings ──────────────────────────────────────────────────────
// Cost Category is checked first; LOS Category is the fallback.

export const LOS_BUCKETS = {
  'Oil': 'oil', 'Gas': 'gas', 'NGL': 'ngl',
  'Chemicals': 'variable_oil', 'Fuel & Power': 'variable_oil',
  'Gathering, Trans. & Processing': 'gpt',
  'Midstream Revenue': 'midstream',
  'Midstream Revenue Elimination': 'midstream',
  'Liquids Hauling & Disposal': 'variable_water',
  'Company Labor': 'fixed', 'Contract Labor/Pumper': 'fixed',
  'Field Office': 'fixed', 'EHS & Regulatory': 'fixed',
  'LOE': 'fixed',
  'Measurement/Automation': 'fixed', 'Surface Repairs & Maint': 'fixed',
  'Vehicles': 'fixed', 'Well Servicing': 'fixed',
  'Ad Valorem Taxes': 'prod_taxes',
  'Production Taxes-Oil': 'prod_taxes', 'Production Taxes-Gas': 'prod_taxes',
  'Production Taxes-NGL': 'prod_taxes', 'CAPEX': 'capex',
}

export const COST_CAT_BUCKETS = {
  'RevO': 'oil', 'RevG': 'gas', 'RevNGL': 'ngl',
  'Fixed': 'fixed',
  'Other': 'capex',
  'Var':   'variable_oil',
  'VW':    'variable_water',
  'GPT':   'gpt',
  'WORK':  'workover',
  'PTo': 'prod_taxes', 'PTg': 'prod_taxes', 'PTngl': 'prod_taxes', 'AT': 'prod_taxes',
  'MS': 'midstream', 'MS Rev': 'midstream', 'MSRev': 'midstream', 'MS Elim': 'midstream',
}

// LOS category labels that should be silently dropped during aggregation
export const LOS_IGNORE = new Set([
  'midstream gpt elimination',
  'midstream loe reclass',
])

// ─── Chart colors (Evercore IB pitchbook palette) ────────────────────────────

export const CHART_COLORS = {
  oil:       '#1F3864',
  ngl:       '#2E74B5',
  gas:       '#808080',
  fixed:     '#1F3864',
  varOil:    '#2E74B5',
  varWater:  '#808080',
  gpt:       '#4472C4',
  midstream: '#7030A0',
  workover:  '#70AD47',
  capex:     '#C00000',
  prodTaxes: '#C55A11',
  revenue:   '#1F3864',
  margin:    '#548235',
  cost:      '#C55A11',
  index:     '#0F766E',
  differential: '#334155',
  myCase:    '#DC2626',
  vdrCase:   '#6B7280',
}

// ─── ARIES inputs ─────────────────────────────────────────────────────────────

// Empty ARIES case object — keys match the ARIES_INPUT_FIELDS below
export const EMPTY_CASE = {
  jpFixedPerWellMonth:    '',
  rpFixedPerWellMonth:    '',
  jpWorkoverPerWellMonth: '',
  rpWorkoverPerWellMonth: '',
  varOilPerBOE:           '',
  gptPerBOE:              '',
  varWaterPerBBL:         '',
  prodTaxPct:             '',
  oilDiff:                '',
  gasDiff:                '',
  nglDiffPct:             '',
}

// Initial nested ARIES inputs state shape: { vdrCase: { op, obo }, myCase: { op, obo } }
export const INITIAL_ARIES_INPUTS = {
  vdrCase: { op: { ...EMPTY_CASE }, obo: { ...EMPTY_CASE } },
  myCase:  { op: { ...EMPTY_CASE }, obo: { ...EMPTY_CASE } },
}

// Input field definitions for the ARIES Inputs tab
export const ARIES_INPUT_FIELDS = [
  { key: 'jpFixedPerWellMonth',    label: 'JP Fixed',           unit: '$/well/month',   lowerIsBetter: true,  histKey: null,           fmt: v => `$${Number(v).toLocaleString('en-US',{maximumFractionDigits:0})}` },
  { key: 'rpFixedPerWellMonth',    label: 'RP Fixed',           unit: '$/well/month',   lowerIsBetter: true,  histKey: null,           fmt: v => `$${Number(v).toLocaleString('en-US',{maximumFractionDigits:0})}` },
  { key: 'jpWorkoverPerWellMonth', label: 'JP Workover',        unit: '$/well/month',   lowerIsBetter: true,  histKey: null,           fmt: v => `$${Number(v).toLocaleString('en-US',{maximumFractionDigits:0})}` },
  { key: 'rpWorkoverPerWellMonth', label: 'RP Workover',        unit: '$/well/month',   lowerIsBetter: true,  histKey: null,           fmt: v => `$${Number(v).toLocaleString('en-US',{maximumFractionDigits:0})}` },
  { key: 'varOilPerBOE',           label: 'Variable Oil Costs', unit: '$/BOE',           lowerIsBetter: true,  histKey: 'varOilPerBOE', fmt: v => `$${Number(v).toFixed(2)}` },
  { key: 'gptPerBOE',              label: 'GP&T',               unit: '$/BOE',           lowerIsBetter: true,  histKey: 'gptPerBOE',    fmt: v => `$${Number(v).toFixed(2)}` },
  { key: 'varWaterPerBBL',         label: 'Variable Water',     unit: '$/BBL water',     lowerIsBetter: true,  histKey: 'varWaterPerBBL', fmt: v => `$${Number(v).toFixed(2)}` },
  { key: 'prodTaxPct',             label: 'Production Taxes',   unit: '% of revenue',   lowerIsBetter: true,  histKey: 'prodTaxPct',   fmt: v => `${Number(v).toFixed(2)}%` },
  { key: 'oilDiff',                label: 'Oil Differential',   unit: '$/BBL vs. WTI',  lowerIsBetter: false, histKey: null,           fmt: v => `$${Number(v).toFixed(2)}` },
  { key: 'gasDiff',                label: 'Gas Differential',   unit: '$/MMBTU vs. HH', lowerIsBetter: false, histKey: null,           fmt: v => `$${Number(v).toFixed(3)}` },
  { key: 'nglDiffPct',             label: 'NGL Differential',   unit: '% of WTI',       lowerIsBetter: false, histKey: null,           fmt: v => `${Number(v).toFixed(1)}%` },
]

// Key map from export label → ARIES state key (used by parseAriesImport)
export const ARIES_IMPORT_KEY_MAP = {
  'JP Fixed':                        'jpFixedPerWellMonth',
  'RP Fixed':                        'rpFixedPerWellMonth',
  'JP Workover':                     'jpWorkoverPerWellMonth',
  'RP Workover':                     'rpWorkoverPerWellMonth',
  'Variable Oil Costs':              'varOilPerBOE',
  'GP&T':                            'gptPerBOE',
  'Variable Water':                  'varWaterPerBBL',
  'Production Taxes':                'prodTaxPct',
  'Oil Differential':                'oilDiff',
  'Gas Differential':                'gasDiff',
  'NGL Differential':                'nglDiffPct',
  'JP Fixed ($/well/month)':        'jpFixedPerWellMonth',
  'RP Fixed ($/well/month)':        'rpFixedPerWellMonth',
  'JP Workover ($/well/month)':     'jpWorkoverPerWellMonth',
  'RP Workover ($/well/month)':     'rpWorkoverPerWellMonth',
  'Variable Oil ($/BOE)':           'varOilPerBOE',
  'GP&T ($/BOE)':                   'gptPerBOE',
  'Variable Water ($/BBL water)':   'varWaterPerBBL',
  'Production Taxes (% revenue)':   'prodTaxPct',
  'Oil Differential ($/BBL)':       'oilDiff',
  'Gas Differential ($/MMBTU)':     'gasDiff',
  'NGL Differential (% of WTI)':    'nglDiffPct',
  // backward-compat: old single-case exports
  'Fixed Costs ($/well/month)':     'jpFixedPerWellMonth',
}

// ─── App tabs ─────────────────────────────────────────────────────────────────

export const TABS = [
  { id: 'inputs',          label: 'ARIES Inputs' },
  { id: 'rollup',          label: 'Asset Rollup' },
  { id: 'wellbywell',      label: 'Well by Well Charts' },
  { id: 'wellbywelltable', label: 'LOS Table' },
  { id: 'historicalpricing', label: 'Historical Inputs' },
]

// LOS table sections that are treated as "recurring" LOE (name-based, not bucket-based)
export const RECURRING_LOE_NAMES = new Set(['Overhead', 'LOE', 'Insurance'])

// All known buckets — used to catch unmapped categories in the LOS table
export const KNOWN_BUCKETS = new Set([
  'oil', 'gas', 'ngl',
  'variable_oil', 'variable_water', 'fixed',
  'workover', 'gpt', 'midstream', 'prod_taxes', 'capex',
])
