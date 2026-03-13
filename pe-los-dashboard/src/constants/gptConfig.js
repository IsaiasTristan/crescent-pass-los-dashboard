// ─── GPT Statement Configuration — single audit file ─────────────────────────
//
// Everything GPT-specific lives here so it can be reviewed in one place:
//   • NGL_COMPONENTS          — the 5 NGL fractions reported in midstream statements
//   • NGL_COMPONENT_FIELD_SUFFIXES — per-component field schema (6 per component)
//   • NGL_FORMULAS            — per-component and aggregate NGL calculation logic
//   • GPT_FIELD_ALIASES       — CSV column name aliases for every canonical GPT field
//
// Cross-references:
//   fieldRegistry.js          — imports NGL_COMPONENTS + GPT_FIELD_ALIASES to build
//                               the full FIELD_REGISTRY and FIELD_ALIASES objects
//   parseMidstreamGptCsv.js   — imports NGL_COMPONENTS + NGL_FORMULAS
//   buildGptRollup.js         — imports NGL_COMPONENTS
//   gptFormulas.js            — derived metrics (gas shrink, gas diff, GPT $/Mcf, etc.)
//
// To add a column from a new vendor statement:
//   1. Find the canonical field in GPT_FIELD_ALIASES and add the new column name.
//   2. If it's a new field entirely, add it to GPT_FIELD_ALIASES AND fieldRegistry.js.
//   3. If it requires a formula, add to NGL_FORMULAS or gptFormulas.js.

// ── NGL Components ────────────────────────────────────────────────────────────
// The 5 standard NGL fractions in midstream settlement statements.
// "pentPlus" (C5+) combines isopentane, normal pentane, and heavier fractions.
export const NGL_COMPONENTS = [
  { id: 'ethane',    label: 'Ethane',    abbr: 'C2'  },
  { id: 'propane',   label: 'Propane',   abbr: 'C3'  },
  { id: 'isobutane', label: 'Isobutane', abbr: 'iC4' },
  { id: 'norButane', label: 'N-Butane',  abbr: 'nC4' },
  { id: 'pentPlus',  label: 'Pent-Plus', abbr: 'C5+' },
]

// ── Per-component field suffixes ──────────────────────────────────────────────
// For component ID 'ethane', canonical field IDs are:
//   ethaneTheoreticalGal  AllocatedGal  ContractPct  PopGal  Price  ProductValue
//
// popGal     = product gallons WITH contract % applied (after-POP)
//              If present in CSV, use directly; otherwise compute from AllocatedGal × ContractPct.
// productValue = product value ($). If present in CSV, use directly; else compute = popGal × Price.
export const NGL_COMPONENT_FIELD_SUFFIXES = [
  { suffix: 'TheoreticalGal', label: 'Theoretical Gallons',    type: 'number',   canonicalUnit: 'gal',     unitChoices: null                    },
  { suffix: 'AllocatedGal',   label: 'Allocated Gallons',       type: 'number',   canonicalUnit: 'gal',     unitChoices: null                    },
  { suffix: 'ContractPct',    label: 'Contract %',              type: 'percent',  canonicalUnit: 'decimal', unitChoices: ['decimal', 'percent']   },
  { suffix: 'PopGal',         label: 'After-POP Gallons',       type: 'number',   canonicalUnit: 'gal',     unitChoices: null                    },
  { suffix: 'Price',          label: 'Product Price ($/Gal)',   type: 'currency', canonicalUnit: '$/gal',   unitChoices: null                    },
  { suffix: 'ProductValue',   label: 'Product Value ($)',       type: 'currency', canonicalUnit: '$',       unitChoices: ['USD']                 },
]

// ── NGL Calculation Formulas ──────────────────────────────────────────────────
// All per-component NGL math in one place. Inputs/outputs in gallons unless noted.
//
// recoveryPct       → % (0–100): allocated / theoretical
// contractFraction  → decimal (0–1): normalizes percent-form or decimal-form inputs
// popGal            → gallons after POP: prefer direct CSV value; else allocatedGal × contractFraction
// productValue      → $: prefer direct CSV value; else popGal × price
// popBbl            → BBL (÷42)
// nglYield          → BBL/Mcf: total after-POP BBL / inlet Mcf
// galPerMcf         → gal/Mcf: component popGal / inlet Mcf
// pctOfNgl          → %: component popGal / total NGL gallons × 100
export const NGL_FORMULAS = {
  recoveryPct: (allocatedGal, theoreticalGal) =>
    theoreticalGal != null && theoreticalGal > 0 && allocatedGal != null
      ? (allocatedGal / theoreticalGal) * 100
      : null,

  contractFraction: (contractPct) => {
    if (contractPct == null) return 1
    return contractPct > 1 ? contractPct / 100 : contractPct
  },

  // Prefer directly-provided popGal (PRODUCT GALLONS WITH CONTRACT % APPLIED) if available.
  popGal: (allocatedGal, contractPct, directPopGal = null) => {
    if (directPopGal != null) return directPopGal
    if (allocatedGal == null) return null
    const frac = contractPct != null ? (contractPct > 1 ? contractPct / 100 : contractPct) : 1
    return allocatedGal * frac
  },

  // Prefer directly-provided productValue if available.
  productValue: (popGal, price, directProductValue = null) => {
    if (directProductValue != null) return directProductValue
    if (popGal == null || price == null) return null
    return popGal * price
  },

  popBbl:    (gallons) => (gallons != null ? gallons / 42 : null),

  nglYield:  (nglTotalBbl, inletMcf) =>
    nglTotalBbl != null && inletMcf != null && inletMcf > 0
      ? nglTotalBbl / inletMcf : null,

  galPerMcf: (popGal, inletMcf) =>
    popGal != null && inletMcf != null && inletMcf > 0
      ? popGal / inletMcf : null,

  pctOfNgl:  (popGal, totalNglGal) =>
    popGal != null && totalNglGal != null && totalNglGal > 0
      ? (popGal / totalNglGal) * 100 : null,
}

// ── GPT Field Aliases ─────────────────────────────────────────────────────────
// Maps canonical field ID → array of known CSV column name aliases.
// Comparison is case-insensitive (normalized to lowercase + strip non-alphanumeric).
// Column names are taken from actual midstream statement exports.
//
// Organized by category for auditability.
export const GPT_FIELD_ALIASES = {

  // ── Identity ──────────────────────────────────────────────────────────────
  serviceDate: [
    'date', 'month', 'period', 'statement date', 'statement month',
    'service end date', 'production month', 'acctg period',
  ],
  meterName: [
    'meter name', 'meter', 'meter/plant', 'plant', 'plant name',
    'facility', 'location', 'delivery point',
  ],

  // ── Inlet / wellhead gas volumes ──────────────────────────────────────────
  // Dual-unit: same wellhead gas can appear as MCF or MMBtu in the same statement.
  // Map whichever column is preferred; the unit dropdown handles conversion.
  inletVolumeMcf: [
    'gross wh mcf', 'gross wh database', 'gross wh plant',
    'gathering inlet volume (mcf)', 'gathering inlet volume',
    'inlet volume (mcf)', 'inlet volume', 'inlet mcf',
  ],
  inletVolumeMmBtu: [
    'gross wh mmbtu', 'gross wh plant mmbtu',
    'inlet volume (mmbtu)', 'inlet mmbtu',
  ],
  fieldFuelMcf: [
    'field fuel mcf', 'field fuel (mcf)', 'field fuel',
  ],
  fieldFuelMmBtu: [
    'field fuel mmbtu', 'field fuel (mmbtu)',
  ],
  netDeliveredMcf: [
    'net delivered mcf', 'net delivered (mcf)', 'net delivered',
  ],
  netDeliveredMmBtu: [
    'net delivered mmbtu', 'net delivered (mmbtu)',
  ],
  totalShrinkMmBtu: [
    'total shrink mmbtu', 'total shrink (mmbtu)', 'total shrink',
    'gas shrink (mmbtu)', 'shrink mmbtu',
  ],
  plantFuelLossMmBtu: [
    'plant fuel/loss mmbtu', 'plant fuel loss mmbtu',
    'plant fuel (mmbtu)', 'plant loss mmbtu',
  ],
  gasShrinkPct: [
    'gas shrink', 'shrink', 'shrink (%)', 'gas shrink (%)',
  ],
  gasShrinkMcf: [
    'gas shrink (mcf)', 'shrink mcf', 'shrink volume',
  ],
  btuFactor: [
    'residue gas btu factor', 'btu factor', 'gross wh plant btu factor',
    'post-pop residue gas btu factor', 'pre-pop residue gas btu factor',
  ],

  // ── Residue gas settlement ─────────────────────────────────────────────────
  // GP&T $/Mcf formula (in gptFormulas.js): (gatheringFee + treatingFee) / residueGasVolumeMcf
  settlementResidueMmBtu: [
    'settelement residue mmbtu', 'settlement residue mmbtu',
    'settlement res mmbtu', 'residue mmbtu',
  ],
  globalContractPct: [
    'contract %', 'contract pct', 'residue contract %', 'gas contract %',
  ],
  settlementResWithContract: [
    'settlement res * contract %', 'settlement residue * contract %',
    'settlement res with contract', 'contractual residue',
  ],
  residuePricePerMmBtu: [
    'residue price / mmbtu', 'residue price ($/mmbtu)', 'residue gas price',
    'settlement price', 'gas price ($/mmbtu)',
  ],
  residueGasVolumeMcf: [
    'residue gas volume (mcf)', 'residue gas volume', 'residue gas',
    'post-pop net residue gas', 'gas available for sale', 'post-pop residue gas',
  ],
  residueGasSales: [
    'producers residue value', 'producer residue value',
    'residue gas sales', 'residue gas sales ($)', 'residue gas value',
    'gas sales', 'net gas sales',
  ],
  gasDifferential: [
    'gas differential', 'gas differential ($/mcf)', 'gas diff', 'gas basis',
  ],
  hhubPrice: [
    'henry hub', 'henry hub price', 'hhub', 'hh',
  ],
  benchmarkGasPrice: [
    'benchmark gas price', 'benchmark gas', 'gas benchmark',
    'hsc', 'waha', 'index gas price', 'residue gas index price',
  ],
  wtiPrice: [
    'wti', 'wti price', 'wti cushing', 'wti crude',
  ],

  // ── NGL aggregate fields ───────────────────────────────────────────────────
  nglVolumeBbl: [
    'ngl volume', 'ngl volume (bbl)', 'ngl prod', 'ngl prod (bbl)', 'ngl gallons',
    'total ngl bbl', 'ngl total (bbl)',
  ],
  nglYield: [
    'ngl yield', 'ngl yield (bbl/mcf)', 'ngl bbl per mcf',
  ],
  nglSales: [
    'ngl sales', 'ngl sales ($)', 'net ngl sales',
    'total ngl value', 'ngl product value',
  ],
  nglRealizedPrice: [
    'ngl realized price', 'ngl price', 'realized ngl price', 'ngl price ($/bbl)',
  ],
  nglDifferentialPct: [
    'ngl differential', 'ngl differential (%)',
    'ngl % wti', 'ngl as % of wti', 'ngl pct wti',
  ],

  // ── Midstream fees ─────────────────────────────────────────────────────────
  // GP&T $/Mcf = (gatheringFee + treatingFee) / residueGasVolumeMcf  (gptFormulas.js)
  totalMidstreamFee: [
    'total midstream fee', 'total midstream fee ($)',
    'gathering & treatment fees', 'gathering and treatment fees',
    'gathering treatment fees', 'total gpt fees', 'gpt fees', 'total fees',
  ],
  gatheringFee: [
    'gathering fee', 'gathering fees', 'gathering charge',
  ],
  processingFee: [
    'processing fee', 'processing fees', 'processing charge',
  ],
  compressionFee: [
    'compression fee', 'compression fees', 'compression charge',
  ],
  treatingFee: [
    'treating fee', 'treating fees', 'treatment fee',
  ],
  otherMidstreamFee: [
    'other midstream fee', 'other fee', 'other fees', 'fuel fee', 'admin fee',
  ],
  // Generic variable fee slots (Fee 1–4): the label column names the fee type;
  // the amount column is the dollar value.
  fee1Label:  ['fee 1'],
  fee1Amount: ['fee 1 amount'],
  fee2Label:  ['fee 2'],
  fee2Amount: ['fee 2 amount'],
  fee3Label:  ['fee 3'],
  fee3Amount: ['fee 3 amount'],
  fee4Label:  ['fee 4'],
  fee4Amount: ['fee 4 amount'],

  // ── NGL per-component aliases ──────────────────────────────────────────────
  // Column names sourced from actual midstream statement exports.

  // Ethane (C2)
  ethaneTheoreticalGal:  ['ethane theoretical gallons', 'ethane theoretical gal', 'c2 theoretical gallons', 'c2 theoretical'],
  ethaneAllocatedGal:    ['ethane allocated product gallons', 'allocated ethane product gallons', 'ethane allocated gallons', 'c2 allocated'],
  ethaneContractPct:     ['ethane contract %', 'ethane contract pct', 'ethane pop %', 'c2 contract %', 'c2 contract'],
  ethanePopGal:          ['ethane product gallons with contract % applied', 'ethane pop gallons', 'ethane gallons with contract', 'c2 product gallons with contract', 'c2 pop gallons'],
  ethanePrice:           ['ethane product price', 'ethane price', 'ethane price ($/gal)', 'c2 price'],
  ethaneProductValue:    ['ethane product value', 'ethane value', 'c2 product value'],

  // Propane (C3)
  propaneTheoreticalGal: ['propane theoretical gallons', 'propane theoretical gal', 'c3 theoretical gallons', 'c3 theoretical'],
  propaneAllocatedGal:   ['propane allocated product gallons', 'allocated propane product gallons', 'propane allocated gallons', 'c3 allocated'],
  propaneContractPct:    ['propane contract %', 'propane contract pct', 'propane pop %', 'c3 contract %', 'c3 contract'],
  propanePopGal:         ['propane product gallons with contract % applied', 'propane pop gallons', 'propane gallons with contract', 'c3 product gallons with contract', 'c3 pop gallons'],
  propanePrice:          ['propane product price', 'propane price', 'propane price ($/gal)', 'c3 price'],
  propaneProductValue:   ['propane product value', 'propane value', 'c3 product value'],

  // Isobutane (iC4) — labeled "ISO-BUTANE" in statements
  isobutaneTheoreticalGal: ['iso-butane theoretical gallons', 'isobutane theoretical gallons', 'iso butane theoretical gallons', 'ic4 theoretical gallons', 'ic4 theoretical'],
  isobutaneAllocatedGal:   ['allocated iso-butane product gallons', 'iso-butane allocated product gallons', 'isobutane allocated gallons', 'ic4 allocated gallons', 'ic4 allocated'],
  isobutaneContractPct:    ['iso-butane contract %', 'isobutane contract %', 'ic4 contract %', 'ic4 contract'],
  isobutanePopGal:         ['product gallons with iso-butane contract % applied', 'iso-butane pop gallons', 'isobutane product gallons with contract % applied', 'ic4 product gallons with contract', 'ic4 pop gallons'],
  isobutanePrice:          ['iso-butane product price', 'isobutane product price', 'isobutane price', 'ic4 price'],
  isobutaneProductValue:   ['iso-butane product value', 'isobutane product value', 'ic4 product value'],

  // Normal Butane (nC4) — labeled "NOR-BUTANE" in statements
  norButaneTheoreticalGal: ['nor-butane theoretical gallons', 'n-butane theoretical gallons', 'nbutane theoretical gallons', 'nc4 theoretical gallons', 'nc4 theoretical'],
  norButaneAllocatedGal:   ['nor-butane allocated product gallons', 'n-butane allocated product gallons', 'nbutane allocated gallons', 'nc4 allocated gallons', 'nc4 allocated'],
  norButaneContractPct:    ['nor-butane contract %', 'n-butane contract %', 'nbutane contract %', 'nc4 contract %', 'nc4 contract'],
  norButanePopGal:         ['product nor-butane gallons with contract % applied', 'nor-butane pop gallons', 'n-butane product gallons with contract % applied', 'nc4 product gallons with contract', 'nc4 pop gallons'],
  norButanePrice:          ['nor-butane product price', 'n-butane product price', 'nbutane price', 'nc4 price'],
  norButaneProductValue:   ['nor-butane product value', 'n-butane product value', 'nc4 product value'],

  // Pent-Plus (C5+) — combines isopentane, normal pentane, and heavier fractions
  pentPlusTheoreticalGal: ['pent-plus theoretical gallons', 'pent plus theoretical gallons', 'c5+ theoretical gallons', 'pentane plus theoretical gallons'],
  pentPlusAllocatedGal:   ['pent-plus allocated product gallons', 'pent plus allocated product gallons', 'c5+ allocated gallons', 'pentane plus allocated gallons'],
  pentPlusContractPct:    ['pent-plus contract %', 'pent plus contract %', 'c5+ contract %', 'pentane plus contract %'],
  pentPlusPopGal:         ['pent-plus product gallons with contract % applied', 'pent plus pop gallons', 'c5+ product gallons with contract % applied', 'pentane plus pop gallons'],
  pentPlusPrice:          ['pent-plus product price', 'pent plus product price', 'c5+ price', 'pentane plus price'],
  pentPlusProductValue:   ['pent-plus product value', 'pent plus product value', 'c5+ product value'],
}

// ── Source type detection signals ────────────────────────────────────────────
// Fields whose presence strongly suggests this is a GPT statement.
export const GPT_SOURCE_SIGNALS = [
  'totalMidstreamFee', 'gatheringFee', 'processingFee',
  'inletVolumeMcf', 'inletVolumeMmBtu', 'meterName',
  'ethaneTheoreticalGal', 'propaneTheoreticalGal',
]
