import { CHART_COLORS as C } from './losMapping.js'
import { fBoed, fMcfd, fMdol, fB, fP, fG2 } from '../utils/formatters.js'

// Well-by-well chart type definitions — each entry defines one selectable
// metric view in the Well by Well tab.
export const WBW_TYPES = [
  { id:'netBOEd',       group:'Total Production',  label:'Net Total (Boed)',      pk:'netBOEd',          chartType:'boeStackD',      fmt:n=>fBoed(n)+' Boed',  tableFmt:fBoed,              tableLabel:'Net Production (Boed)'      },
  { id:'netBOEtot',     group:'Total Production',  label:'Net Total (BOE/mo)',    pk:'netBOE',           chartType:'boeStackM',      fmt:n=>fBoed(n)+' BOE',   tableFmt:fBoed,              tableLabel:'Net Production (BOE/mo)'    },
  { id:'grossBOEd',     group:'Total Production',  label:'Gross Total (Boed)',    pk:'grossBOEd',        chartType:'grossBoeStackD', fmt:n=>fBoed(n)+' Boed',  tableFmt:fBoed,              tableLabel:'Gross Production (Boed)'    },
  { id:'grossBOEtot',   group:'Total Production',  label:'Gross Total (BOE/mo)',  pk:'grossBOE',         chartType:'grossBoeStackM', fmt:n=>fBoed(n)+' BOE',   tableFmt:fBoed,              tableLabel:'Gross Production (BOE/mo)'  },
  { id:'netOild',       group:'Oil & NGL',         label:'Net Oil (Bpd)',         pk:'netOild',          chartType:'single', fill:C.oil,       fmt:n=>fBoed(n)+' Bpd',   tableFmt:fBoed,  tableLabel:'Net Oil (Bpd)'          },
  { id:'netOiltot',     group:'Oil & NGL',         label:'Net Oil (Bbl/mo)',      pk:'oil_vol',          chartType:'single', fill:C.oil,       fmt:n=>fBoed(n)+' Bbl',   tableFmt:fBoed,  tableLabel:'Net Oil (Bbl/mo)'       },
  { id:'netNGLd',       group:'Oil & NGL',         label:'Net NGL (Bpd)',         pk:'netNGLd',          chartType:'single', fill:C.ngl,       fmt:n=>fBoed(n)+' Bpd',   tableFmt:fBoed,  tableLabel:'Net NGL (Bpd)'          },
  { id:'netNGLtot',     group:'Oil & NGL',         label:'Net NGL (Bbl/mo)',      pk:'ngl_vol',          chartType:'single', fill:C.ngl,       fmt:n=>fBoed(n)+' Bbl',   tableFmt:fBoed,  tableLabel:'Net NGL (Bbl/mo)'       },
  { id:'grossOild',     group:'Oil & NGL',         label:'Gross Oil (Bpd)',       pk:'grossOild',        chartType:'single', fill:C.oil,       fmt:n=>fBoed(n)+' Bpd',   tableFmt:fBoed,  tableLabel:'Gross Oil (Bpd)'        },
  { id:'grossOiltot',   group:'Oil & NGL',         label:'Gross Oil (Bbl/mo)',    pk:'gross_oil',        chartType:'single', fill:C.oil,       fmt:n=>fBoed(n)+' Bbl',   tableFmt:fBoed,  tableLabel:'Gross Oil (Bbl/mo)'     },
  { id:'grossNGLd',     group:'Oil & NGL',         label:'Gross NGL (Bpd)',       pk:'grossNGLd',        chartType:'single', fill:C.ngl,       fmt:n=>fBoed(n)+' Bpd',   tableFmt:fBoed,  tableLabel:'Gross NGL (Bpd)'        },
  { id:'grossNGLtot',   group:'Oil & NGL',         label:'Gross NGL (Bbl/mo)',    pk:'gross_ngl',        chartType:'single', fill:C.ngl,       fmt:n=>fBoed(n)+' Bbl',   tableFmt:fBoed,  tableLabel:'Gross NGL (Bbl/mo)'     },
  { id:'netGasd',       group:'Gas Production',    label:'Net Gas (Mcfd)',        pk:'netGasd',          chartType:'single', fill:C.gas,       fmt:n=>fMcfd(n)+' Mcfd',  tableFmt:fMcfd,  tableLabel:'Net Gas (Mcfd)'         },
  { id:'netGastot',     group:'Gas Production',    label:'Net Gas (Mcf/mo)',      pk:'gas_vol',          chartType:'single', fill:C.gas,       fmt:n=>fMcfd(n)+' Mcf',   tableFmt:fMcfd,  tableLabel:'Net Gas (Mcf/mo)'       },
  { id:'grossGasd',     group:'Gas Production',    label:'Gross Gas (Mcfd)',      pk:'grossGasd',        chartType:'single', fill:C.gas,       fmt:n=>fMcfd(n)+' Mcfd',  tableFmt:fMcfd,  tableLabel:'Gross Gas (Mcfd)'       },
  { id:'grossGastot',   group:'Gas Production',    label:'Gross Gas (Mcf/mo)',    pk:'gross_gas',        chartType:'single', fill:C.gas,       fmt:n=>fMcfd(n)+' Mcf',   tableFmt:fMcfd,  tableLabel:'Gross Gas (Mcf/mo)'     },
  { id:'totalLOSm',     group:'Costs ($MM)',       label:'Total Lease Operating Statement ($MM)', pk:'totalLOS', chartType:'costStack', fmt:fMdol, tableFmt:n=>(n/1e6).toFixed(1), tableLabel:'Total Lease Operating Statement ($MM)' },
  { id:'costPerBOE',    group:'Costs ($M)',        label:'LOS ($/Boe)',           pk:'costPerBOE',       chartType:'single', fill:'#C55A11', fmt:fB,          tableFmt:n=>n.toFixed(2),       tableLabel:'LOS ($/Boe)'    },
  { id:'varOilm',       group:'Costs ($MM)',       label:'Var Oil Exp ($MM)',     pk:'var_oil',          chartType:'single', fill:C.varOil,  fmt:fMdol,       tableFmt:n=>(n/1e6).toFixed(1), tableLabel:'Var Oil Exp ($MM)'  },
  { id:'varOilPerBOE',  group:'Costs ($M)',        label:'Var Oil ($/Boe)',       pk:'varOilPerBOE',     chartType:'single', fill:C.varOil,  fmt:fB,          tableFmt:n=>n.toFixed(2),       tableLabel:'Var Oil ($/Boe)'    },
  { id:'varWaterm',     group:'Costs ($MM)',       label:'Water Exp ($MM)',       pk:'var_water',        chartType:'single', fill:C.varWater, fmt:fMdol,      tableFmt:n=>(n/1e6).toFixed(1), tableLabel:'Water Exp ($MM)'    },
  { id:'varWaterPerBw', group:'Costs ($MM)',       label:'Water ($/mo)',          pk:'varWaterPerMonth', chartType:'single', fill:C.varWater, fmt:fMdol,      tableFmt:n=>(n/1e6).toFixed(1), tableLabel:'Water ($/mo)'       },
  { id:'fixedm',        group:'Costs ($MM)',       label:'Fixed Exp ($MM)',       pk:'fixed',            chartType:'single', fill:C.fixed,   fmt:fMdol,       tableFmt:n=>(n/1e6).toFixed(1), tableLabel:'Fixed Exp ($MM)'    },
  { id:'fixedPerWell',  group:'Costs ($M)',        label:'Fixed ($/Well/mo)',     pk:'fixedPerWell',     chartType:'single', fill:C.fixed,   fmt:n=>`$${(n/1000).toFixed(1)}`, tableFmt:n=>(n/1000).toFixed(1), tableLabel:'Fixed ($/Well/mo)'  },
  { id:'gptPerBOE',     group:'Costs ($M)',        label:'GP&T ($/Boe)',          pk:'gptPerBOE',        chartType:'single', fill:C.gpt,     fmt:fB,          tableFmt:n=>n.toFixed(2),       tableLabel:'GP&T ($/Boe)'        },
  { id:'realizedOil',   group:'Realized Prices',  label:'Oil ($/Bbl)',           pk:'realizedOil',      chartType:'single', fill:C.oil,     fmt:fB,          tableFmt:n=>n.toFixed(2),       tableLabel:'Realized Oil ($/Bbl)'       },
  { id:'realizedNGL',   group:'Realized Prices',  label:'NGL (% WTI)',           pk:'realizedNGL',      chartType:'single', fill:C.ngl,     fmt:fB,          tableFmt:n=>n.toFixed(2),       tableLabel:'Realized NGL ($/Bbl est.)'  },
  { id:'realizedGas',   group:'Realized Prices',  label:'Gas ($/Mcf)',           pk:'realizedGas',      chartType:'single', fill:C.gas,     fmt:fG2,         tableFmt:n=>n.toFixed(2),       tableLabel:'Realized Gas ($/Mcf)'       },
  { id:'actualOilPrice', group:'Realized Prices', label:'Actual Oil ($/Bbl)',    pk:'actualOilPrice',   chartType:'single', fill:C.index,   fmt:fB,          tableFmt:n=>n.toFixed(2),       tableLabel:'Actual Oil Price ($/Bbl)'   },
  { id:'actualNGLPrice', group:'Realized Prices', label:'Actual NGL ($/Bbl)',    pk:'actualNGLPrice',   chartType:'single', fill:C.index,   fmt:fB,          tableFmt:n=>n.toFixed(2),       tableLabel:'Actual NGL Price ($/Bbl)'   },
  { id:'actualGasPrice', group:'Realized Prices', label:'Actual Gas ($/Mcf)',    pk:'actualGasPrice',   chartType:'single', fill:C.index,   fmt:fG2,         tableFmt:n=>n.toFixed(2),       tableLabel:'Actual Gas Price ($/Mcf)'   },
  { id:'oilDifferential', group:'Realized Prices', label:'Oil Diff ($/Bbl)',     pk:'oilDifferential',  chartType:'single', fill:C.differential, fmt:fB,      tableFmt:n=>n.toFixed(2),       tableLabel:'Oil Differential ($/Bbl)'   },
  { id:'nglDifferential', group:'Realized Prices', label:'NGL Diff (% WTI)',     pk:'nglDifferential',  chartType:'single', fill:C.differential, fmt:n=>`${(n*100).toFixed(1)}%`, tableFmt:n=>(n*100).toFixed(1), tableLabel:'NGL Differential (% of WTI)'   },
  { id:'gasDifferential', group:'Realized Prices', label:'Gas Diff ($/Mcf)',     pk:'gasDifferential',  chartType:'single', fill:C.differential, fmt:fG2,     tableFmt:n=>n.toFixed(2),       tableLabel:'Gas Differential ($/Mcf)'   },
  { id:'prodTaxm',      group:'Taxes',            label:'Prod Taxes ($MM)',      pk:'prod_taxes',       chartType:'single', fill:'#C55A11', fmt:fMdol,       tableFmt:n=>(n/1e6).toFixed(1), tableLabel:'Prod Taxes ($MM)'           },
  { id:'prodTaxPct',    group:'Taxes',            label:'Prod Tax (% Rev)',      pk:'prodTaxPct',       chartType:'single', fill:'#C55A11', fmt:fP,          tableFmt:n=>n.toFixed(2),       tableLabel:'Prod Tax (% Revenue)'       },
  { id:'midstreamm',    group:'Midstream',        label:'Midstream Rev ($MM)',   pk:'midstream',        chartType:'single', fill:C.midstream, fmt:fMdol,     tableFmt:n=>(n/1e6).toFixed(3), tableLabel:'Midstream Rev ($MM)'        },
  { id:'midstreamBOE',  group:'Midstream',        label:'Midstream ($/Boe)',     pk:'midstreamPerBOE',  chartType:'single', fill:C.midstream, fmt:fB,        tableFmt:n=>n.toFixed(3),       tableLabel:'Midstream ($/Boe)'          },
]

export const WBW_GROUPS = [...new Set(WBW_TYPES.map(t => t.group))]

export const SORT_OPTIONS = [
  { id: 'default',  label: 'Default (Name)' },
  { id: 'oilVol',   label: 'Oil Vol (Bpd)'  },
  { id: 'gasVol',   label: 'Gas Vol (Mcfd)' },
  { id: 'totalVol', label: 'Total BOE (Boed)' },
]
