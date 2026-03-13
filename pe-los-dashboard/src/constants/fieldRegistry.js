// ─── Canonical field registry ────────────────────────────────────────────────
// Single source of truth for every canonical field across all four data sources:
// LOS, Historical Gross Volumes, Historical Pricing, and Midstream GPT Statement.
//
// GPT-specific field names, aliases, NGL components, and calculation formulas
// are maintained in src/constants/gptConfig.js — edit that file to add new
// vendor column names or change NGL component structure.
//
// FIELD_ALIASES: raw strings; comparison is done after normalizing to lowercase + strip non-alphanumeric.
// SOURCE_TYPE_SIGNALS: canonical field IDs whose presence strongly identifies a source type.

export { NGL_COMPONENTS } from './gptConfig.js'
import { NGL_COMPONENTS, NGL_COMPONENT_FIELD_SUFFIXES, GPT_FIELD_ALIASES, GPT_SOURCE_SIGNALS } from './gptConfig.js'

// Dynamically generate NGL component FIELD_REGISTRY entries from gptConfig.js.
// Avoids hand-maintaining 30 near-identical field definitions.
const _nglFields = {}
for (const comp of NGL_COMPONENTS) {
  for (const { suffix, label, type, canonicalUnit, unitChoices } of NGL_COMPONENT_FIELD_SUFFIXES) {
    _nglFields[`${comp.id}${suffix}`] = {
      label: `${comp.label} ${label}`,
      type,
      canonicalUnit,
      unitChoices,
      sources: ['gpt'],
      required: {},
    }
  }
}

// Dynamically build NGL component FIELD_ALIASES from gptConfig.js GPT_FIELD_ALIASES.
const _nglAliases = {}
for (const comp of NGL_COMPONENTS) {
  for (const { suffix } of NGL_COMPONENT_FIELD_SUFFIXES) {
    const fieldId = `${comp.id}${suffix}`
    _nglAliases[fieldId] = GPT_FIELD_ALIASES[fieldId] || []
  }
}

export const DATA_SOURCES = {
  los:     { label: 'LOS Data' },
  volumes: { label: 'Historical Gross Volumes' },
  pricing: { label: 'Historical Pricing' },
  gpt:     { label: 'Midstream / GPT Statement' },
}

// Unit options. toBase converts an input value to the canonical unit.
export const UNIT_OPTIONS = {
  BBL:     { label: 'BBL',               toBase: v => v },
  gallons: { label: 'Gallons (÷42)',      toBase: v => v / 42 },
  MCF:     { label: 'MCF',               toBase: v => v },
  MMBTU:   { label: 'MMBtu',             toBase: v => v / 1.02 },
  CF:      { label: 'CF (÷1,000)',        toBase: v => v / 1000 },
  decimal: { label: 'Decimal (e.g. 0.75)', toBase: v => v },
  percent: { label: 'Percent (e.g. 75)',  toBase: v => v / 100 },
  USD:     { label: '$',                 toBase: v => v },
}

// canonicalUnit → which unit options are valid for user selection
export const UNIT_CHOICES = {
  BBL:     ['BBL', 'gallons'],
  MCF:     ['MCF', 'MMBTU', 'CF'],
  decimal: ['decimal', 'percent'],
  '$':     ['USD'],
}

export const FIELD_REGISTRY = {
  // ── Shared identity fields ──────────────────────────────────────────────────
  wellName: {
    label: 'Well Name',
    type: 'string',
    canonicalUnit: null,
    unitChoices: null,
    sources: ['los', 'volumes', 'gpt'],
    required: { los: true, volumes: false, pricing: false, gpt: false },
  },
  serviceDate: {
    label: 'Date / Month',
    type: 'date',
    canonicalUnit: null,
    unitChoices: null,
    sources: ['los', 'volumes', 'pricing', 'gpt'],
    required: { los: true, volumes: true, pricing: true, gpt: true },
  },
  propertyNum: {
    label: 'Property # / Applicable Tag',
    type: 'string',
    canonicalUnit: null,
    unitChoices: null,
    sources: ['los', 'volumes', 'gpt'],
    required: {},
  },
  propertyName: {
    label: 'Property Name / Lease',
    type: 'string',
    canonicalUnit: null,
    unitChoices: null,
    sources: ['los', 'volumes', 'gpt'],
    required: {},
  },
  opStatus: {
    label: 'Op Status',
    type: 'string',
    canonicalUnit: null,
    unitChoices: null,
    sources: ['los', 'volumes'],
    required: {},
  },

  // ── LOS-specific fields ─────────────────────────────────────────────────────
  costCategory: {
    label: 'Cost Category',
    type: 'string',
    canonicalUnit: null,
    unitChoices: null,
    sources: ['los'],
    required: { los: true },
  },
  losCategory: {
    label: 'LOS Category',
    type: 'string',
    canonicalUnit: null,
    unitChoices: null,
    sources: ['los'],
    required: {},
  },
  netAmount: {
    label: 'Net Amount',
    type: 'currency',
    canonicalUnit: '$',
    unitChoices: ['USD'],
    sources: ['los'],
    required: { los: true },
  },
  netVolume: {
    label: 'Net Volume',
    type: 'number',
    canonicalUnit: null,
    unitChoices: null,
    sources: ['los'],
    required: {},
  },
  grossAmount: {
    label: 'Gross Amount',
    type: 'currency',
    canonicalUnit: '$',
    unitChoices: ['USD'],
    sources: ['los'],
    required: {},
  },
  grossVolume: {
    label: 'Gross Volume',
    type: 'number',
    canonicalUnit: null,
    unitChoices: null,
    sources: ['los'],
    required: {},
  },
  wi: {
    label: 'Working Interest (WI)',
    type: 'percent',
    canonicalUnit: 'decimal',
    unitChoices: ['decimal', 'percent'],
    sources: ['los'],
    required: {},
  },
  nri: {
    label: 'Net Revenue Interest (NRI)',
    type: 'percent',
    canonicalUnit: 'decimal',
    unitChoices: ['decimal', 'percent'],
    sources: ['los'],
    required: {},
  },
  opObo: {
    label: 'Op / OBO',
    type: 'string',
    canonicalUnit: null,
    unitChoices: null,
    sources: ['los'],
    required: {},
  },
  jpRp: {
    label: 'JP / RP (Lift Type)',
    type: 'string',
    canonicalUnit: null,
    unitChoices: null,
    sources: ['los'],
    required: {},
  },

  // ── Historical gross volume fields ──────────────────────────────────────────
  grossOilVolume: {
    label: 'Gross Oil Volume',
    type: 'number',
    canonicalUnit: 'BBL',
    unitChoices: ['BBL', 'gallons'],
    sources: ['volumes'],
    required: {},
  },
  grossGasVolume: {
    label: 'Gross Gas Volume',
    type: 'number',
    canonicalUnit: 'MCF',
    unitChoices: ['MCF', 'MMBTU', 'CF'],
    sources: ['volumes'],
    required: {},
  },
  grossNGLVolume: {
    label: 'Gross NGL Volume',
    type: 'number',
    canonicalUnit: 'BBL',
    unitChoices: ['BBL', 'gallons'],
    sources: ['volumes'],
    required: {},
  },
  grossWaterVolume: {
    label: 'Gross Water Volume',
    type: 'number',
    canonicalUnit: 'BBL',
    unitChoices: ['BBL', 'gallons'],
    sources: ['volumes'],
    required: {},
  },

  // ── Historical pricing fields ────────────────────────────────────────────────
  wtiPrice: {
    label: 'WTI Price',
    type: 'currency',
    canonicalUnit: '$/BBL',
    unitChoices: null,
    sources: ['pricing', 'gpt'],
    required: {},
  },
  henryHub: {
    label: 'Henry Hub Price',
    type: 'currency',
    canonicalUnit: '$/MMBTU',
    unitChoices: null,
    sources: ['pricing', 'gpt'],
    required: {},
  },
  mehPrice: {
    label: 'MEH Price',
    type: 'currency',
    canonicalUnit: '$/BBL',
    unitChoices: null,
    sources: ['pricing'],
    required: {},
  },
  hscPrice: {
    label: 'HSC Price',
    type: 'currency',
    canonicalUnit: '$/MMBTU',
    unitChoices: null,
    sources: ['pricing'],
    required: {},
  },
  mehBasis: {
    label: 'MEH Basis vs WTI',
    type: 'currency',
    canonicalUnit: '$/BBL',
    unitChoices: null,
    sources: ['pricing'],
    required: {},
  },
  hscBasis: {
    label: 'HSC Basis vs Henry Hub',
    type: 'currency',
    canonicalUnit: '$/MMBTU',
    unitChoices: null,
    sources: ['pricing'],
    required: {},
  },

  // ── Midstream / GPT statement fields ────────────────────────────────────────
  // Canonical IDs match the GPT_COLUMN_ALIASES keys in gptMapping.js for direct
  // fieldIdx mapping in parseMidstreamGptCsv.js.
  meterName: {
    label: 'Meter / Plant Name',
    type: 'string',
    canonicalUnit: null,
    unitChoices: null,
    sources: ['gpt'],
    required: { gpt: true },
  },
  inletVolumeMcf: {
    label: 'Inlet Gas Volume',
    type: 'number',
    canonicalUnit: 'MCF',
    unitChoices: ['MCF', 'MMBTU', 'CF'],
    sources: ['gpt'],
    required: {},
  },
  gasShrinkPct: {
    label: 'Gas Shrink (%)',
    type: 'percent',
    canonicalUnit: 'decimal',
    unitChoices: ['decimal', 'percent'],
    sources: ['gpt'],
    required: {},
  },
  gasShrinkMcf: {
    label: 'Gas Shrink Volume (MCF)',
    type: 'number',
    canonicalUnit: 'MCF',
    unitChoices: ['MCF'],
    sources: ['gpt'],
    required: {},
  },
  btuFactor: {
    label: 'BTU Factor',
    type: 'number',
    canonicalUnit: null,
    unitChoices: null,
    sources: ['gpt'],
    required: {},
  },
  residueGasVolumeMcf: {
    label: 'Residue Gas Volume (MCF)',
    type: 'number',
    canonicalUnit: 'MCF',
    unitChoices: ['MCF', 'MMBTU', 'CF'],
    sources: ['gpt'],
    required: {},
  },
  residueGasSales: {
    label: 'Residue Gas Sales ($)',
    type: 'currency',
    canonicalUnit: '$',
    unitChoices: ['USD'],
    sources: ['gpt'],
    required: {},
  },
  gasDifferential: {
    label: 'Gas Differential ($/Mcf)',
    type: 'currency',
    canonicalUnit: '$/MCF',
    unitChoices: null,
    sources: ['gpt'],
    required: {},
  },
  hhubPrice: {
    label: 'Henry Hub Price (GPT)',
    type: 'currency',
    canonicalUnit: '$/MMBTU',
    unitChoices: null,
    sources: ['gpt'],
    required: {},
  },
  benchmarkGasPrice: {
    label: 'Benchmark Gas Price',
    type: 'currency',
    canonicalUnit: '$/MMBTU',
    unitChoices: null,
    sources: ['gpt'],
    required: {},
  },
  nglVolumeBbl: {
    label: 'NGL Volume',
    type: 'number',
    canonicalUnit: 'BBL',
    unitChoices: ['BBL', 'gallons'],
    sources: ['gpt'],
    required: {},
  },
  nglYield: {
    label: 'NGL Yield (BBL/Mcf)',
    type: 'number',
    canonicalUnit: null,
    unitChoices: null,
    sources: ['gpt'],
    required: {},
  },
  nglSales: {
    label: 'NGL Sales ($)',
    type: 'currency',
    canonicalUnit: '$',
    unitChoices: ['USD'],
    sources: ['gpt'],
    required: {},
  },
  nglRealizedPrice: {
    label: 'NGL Realized Price ($/BBL)',
    type: 'currency',
    canonicalUnit: '$/BBL',
    unitChoices: null,
    sources: ['gpt'],
    required: {},
  },
  nglDifferentialPct: {
    label: 'NGL Differential (% WTI)',
    type: 'percent',
    canonicalUnit: 'decimal',
    unitChoices: ['decimal', 'percent'],
    sources: ['gpt'],
    required: {},
  },
  totalMidstreamFee: {
    label: 'Total Midstream / GPT Fee ($)',
    type: 'currency',
    canonicalUnit: '$',
    unitChoices: ['USD'],
    sources: ['gpt'],
    required: {},
  },
  gatheringFee: {
    label: 'Gathering Fee ($)',
    type: 'currency',
    canonicalUnit: '$',
    unitChoices: ['USD'],
    sources: ['gpt'],
    required: {},
  },
  processingFee: {
    label: 'Processing Fee ($)',
    type: 'currency',
    canonicalUnit: '$',
    unitChoices: ['USD'],
    sources: ['gpt'],
    required: {},
  },
  compressionFee: {
    label: 'Compression Fee ($)',
    type: 'currency',
    canonicalUnit: '$',
    unitChoices: ['USD'],
    sources: ['gpt'],
    required: {},
  },
  treatingFee: {
    label: 'Treating Fee ($)',
    type: 'currency',
    canonicalUnit: '$',
    unitChoices: ['USD'],
    sources: ['gpt'],
    required: {},
  },
  otherMidstreamFee: {
    label: 'Other Midstream Fee ($)',
    type: 'currency', canonicalUnit: '$', unitChoices: ['USD'],
    sources: ['gpt'], required: {},
  },

  // ── Inlet / wellhead gas volume variants (MCF and MMBtu) ──────────────────
  inletVolumeMmBtu: {
    label: 'Inlet Gas Volume (MMBtu)',
    type: 'number', canonicalUnit: 'MCF', unitChoices: ['MCF', 'MMBTU', 'CF'],
    sources: ['gpt'], required: {},
  },
  fieldFuelMcf: {
    label: 'Field Fuel (MCF)',
    type: 'number', canonicalUnit: 'MCF', unitChoices: ['MCF', 'MMBTU', 'CF'],
    sources: ['gpt'], required: {},
  },
  fieldFuelMmBtu: {
    label: 'Field Fuel (MMBtu)',
    type: 'number', canonicalUnit: 'MCF', unitChoices: ['MCF', 'MMBTU', 'CF'],
    sources: ['gpt'], required: {},
  },
  netDeliveredMcf: {
    label: 'Net Delivered Gas (MCF)',
    type: 'number', canonicalUnit: 'MCF', unitChoices: ['MCF', 'MMBTU', 'CF'],
    sources: ['gpt'], required: {},
  },
  netDeliveredMmBtu: {
    label: 'Net Delivered Gas (MMBtu)',
    type: 'number', canonicalUnit: 'MCF', unitChoices: ['MCF', 'MMBTU', 'CF'],
    sources: ['gpt'], required: {},
  },
  totalShrinkMmBtu: {
    label: 'Total Shrink (MMBtu)',
    type: 'number', canonicalUnit: 'MCF', unitChoices: ['MCF', 'MMBTU', 'CF'],
    sources: ['gpt'], required: {},
  },
  plantFuelLossMmBtu: {
    label: 'Plant Fuel / Loss (MMBtu)',
    type: 'number', canonicalUnit: 'MCF', unitChoices: ['MCF', 'MMBTU', 'CF'],
    sources: ['gpt'], required: {},
  },

  // ── Residue gas settlement ─────────────────────────────────────────────────
  settlementResidueMmBtu: {
    label: 'Settlement Residue (MMBtu)',
    type: 'number', canonicalUnit: 'MCF', unitChoices: ['MCF', 'MMBTU', 'CF'],
    sources: ['gpt'], required: {},
  },
  globalContractPct: {
    label: 'Residue Gas Contract %',
    type: 'percent', canonicalUnit: 'decimal', unitChoices: ['decimal', 'percent'],
    sources: ['gpt'], required: {},
  },
  settlementResWithContract: {
    label: 'Settlement Res × Contract %',
    type: 'number', canonicalUnit: 'MCF', unitChoices: ['MCF', 'MMBTU', 'CF'],
    sources: ['gpt'], required: {},
  },
  residuePricePerMmBtu: {
    label: 'Residue Gas Price ($/MMBtu)',
    type: 'currency', canonicalUnit: '$/MMBTU', unitChoices: null,
    sources: ['gpt'], required: {},
  },

  // ── Variable fee slots (Fee 1–4) ───────────────────────────────────────────
  fee1Label:  { label: 'Fee 1 (Label)', type: 'string', canonicalUnit: null, unitChoices: null, sources: ['gpt'], required: {} },
  fee1Amount: { label: 'Fee 1 Amount ($)', type: 'currency', canonicalUnit: '$', unitChoices: ['USD'], sources: ['gpt'], required: {} },
  fee2Label:  { label: 'Fee 2 (Label)', type: 'string', canonicalUnit: null, unitChoices: null, sources: ['gpt'], required: {} },
  fee2Amount: { label: 'Fee 2 Amount ($)', type: 'currency', canonicalUnit: '$', unitChoices: ['USD'], sources: ['gpt'], required: {} },
  fee3Label:  { label: 'Fee 3 (Label)', type: 'string', canonicalUnit: null, unitChoices: null, sources: ['gpt'], required: {} },
  fee3Amount: { label: 'Fee 3 Amount ($)', type: 'currency', canonicalUnit: '$', unitChoices: ['USD'], sources: ['gpt'], required: {} },
  fee4Label:  { label: 'Fee 4 (Label)', type: 'string', canonicalUnit: null, unitChoices: null, sources: ['gpt'], required: {} },
  fee4Amount: { label: 'Fee 4 Amount ($)', type: 'currency', canonicalUnit: '$', unitChoices: ['USD'], sources: ['gpt'], required: {} },

  // ── NGL component fields — auto-generated from gptConfig.js ───────────────
  // 5 components × 6 field suffixes = 30 fields.
  // To change components or add fields, edit NGL_COMPONENTS / NGL_COMPONENT_FIELD_SUFFIXES
  // in src/constants/gptConfig.js.
  ..._nglFields,
}

// All known aliases for each canonical field. Raw strings — normalized at match time.
export const FIELD_ALIASES = {
  wellName: [
    'well name', 'well', 'wellname', 'api well name', 'well id', 'well identifier',
    'api#', 'api number', 'api', 'well_name', 'producing well',
  ],
  serviceDate: [
    'service end date', 'date', 'month', 'service date', 'prod date', 'production date',
    'period', 'month end', 'month/year', 'pricing date', 'price date', 'production month',
    'acctg period', 'accounting period', 'settle date', 'settlement date',
    'statement date', 'statement month',
  ],
  propertyNum: [
    'property #', 'property num', 'property number', 'pt prop num', 'pt prop #',
    'pt property num', 'pt property #', 'applicable tag', 'applicable_tag',
    'well tag', 'tag', 'prop num', 'prop #', 'property id',
  ],
  propertyName: [
    'property name', 'lease', 'property', 'lease name', 'lease/well', 'field',
    'unit name', 'unit', 'producing entity',
  ],
  opStatus: [
    'op status', 'operation status', 'operated', 'operator status', 'op/non-op',
    'operated flag', 'operated status',
  ],
  costCategory: [
    'cost category', 'cost cat', 'category', 'cost type', 'expense category',
    'cost_category', 'acct category',
  ],
  losCategory: [
    'los category', 'los cat', 'los_category', 'los type',
  ],
  netAmount: [
    'net amount', 'net $', 'net cost', 'net revenue', 'net amount ($)', 'net amt',
    'amount net',
  ],
  netVolume: [
    'net volume', 'net vol', 'net bbls', 'net mcf', 'net volume (boe)',
    'net vol (bbl)', 'net volume (bbl)',
  ],
  grossAmount: [
    'gross amount', 'gross $', 'gross revenue', 'gross cost', 'gross amt',
  ],
  grossVolume: [
    'gross volume', 'gross vol', 'gross bbls', 'gross mcf', 'gross volume (bbl)',
  ],
  wi: [
    'wi', 'working interest', 'working int', 'w/i', 'wi%', 'w.i.',
  ],
  nri: [
    'nri', 'net revenue interest', 'net rev int', 'nri%', 'n.r.i.',
  ],
  opObo: [
    'op/obo', 'op status', 'operated', 'operator status', 'op/non-op', 'operated flag',
    'op flag',
  ],
  jpRp: [
    'jp/rp', 'jp/rp_use', 'jp_rp_use', 'jp/rp use', 'lift type', 'lift method',
    'artificial lift', 'lift',
  ],
  grossOilVolume: [
    'gross oil', 'gross oil volume', 'oil gross', 'oil volume', 'gross oil bbls',
    'oil bbls', 'oil (bbls)', 'gross oil (bbl)', 'oil bbl', 'oil production',
    'gross oil production', 'oil throughput',
  ],
  grossGasVolume: [
    'gross gas', 'gross gas volume', 'gas gross', 'gas volume', 'gross gas mcf',
    'gas mcf', 'gas (mcf)', 'gross gas (mcf)', 'gas production', 'gross gas production',
    'gas throughput', 'gas mmcf',
  ],
  grossNGLVolume: [
    'gross ngl', 'gross ngl volume', 'ngl gross', 'ngl volume', 'ngl bbls',
    'ngl (bbls)', 'ngl (gal)', 'ngl gallons', 'ngl production', 'plant ngl',
    'gross ngl (bbl)', 'ngl bbl',
  ],
  grossWaterVolume: [
    'gross water', 'gross water volume', 'water gross', 'water volume', 'water bbls',
    'water (bbls)', 'water', 'bwpd', 'gross water (bbl)', 'water bbl',
    'produced water', 'gross produced water',
  ],
  wtiPrice: [
    'wti', 'wti price', 'wti cushing', 'wti crude', 'crude price', 'wti ($/bbl)',
    'crude oil price', 'nymex wti',
  ],
  henryHub: [
    'henry hub', 'henryhub', 'hh', 'hh price', 'henry hub price',
    'henry hub ($/mmbtu)', 'nymex gas', 'nymex henry hub',
  ],
  mehPrice: [
    'meh', 'meh price', 'meh crude', 'magellan east houston', 'houston crude',
  ],
  hscPrice: [
    'hsc', 'hsc price', 'houston ship channel', 'hsc gas',
  ],
  mehBasis: [
    'meh basis', 'meh differential', 'meh diff', 'meh basis differential',
    'meh vs wti', 'oil basis', 'crude basis',
  ],
  hscBasis: [
    'hsc basis', 'hsc differential', 'hsc diff', 'hsc basis differential',
    'hsc vs hh', 'gas basis', 'natural gas basis',
  ],
  // ── GPT field aliases — sourced from gptConfig.js ─────────────────────────
  // serviceDate is excluded here because the non-GPT entry above is more comprehensive.
  // To add new vendor column names, edit GPT_FIELD_ALIASES in gptConfig.js.
  ...Object.fromEntries(
    Object.entries(GPT_FIELD_ALIASES).filter(([id]) => id !== 'serviceDate')
  ),

  // ── NGL component aliases — auto-generated from gptConfig.js ───────────────
  ..._nglAliases,
}

// Fields whose presence strongly signals a particular source type for auto-detection.
// Scored by counting how many signal fields match detected headers.
// GPT signals are maintained in gptConfig.js (GPT_SOURCE_SIGNALS).
export const SOURCE_TYPE_SIGNALS = {
  los:     ['costCategory', 'losCategory', 'netAmount', 'opObo', 'jpRp'],
  volumes: ['grossOilVolume', 'grossGasVolume', 'grossWaterVolume', 'grossNGLVolume'],
  pricing: ['wtiPrice', 'henryHub', 'mehPrice', 'hscPrice', 'mehBasis', 'hscBasis'],
  gpt:     GPT_SOURCE_SIGNALS,
}
