import React, { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList, ReferenceLine,
} from 'recharts'

import { CHART_COLORS as C } from '../../constants/losMapping.js'
import { ChartCard } from '../charts/ChartCard.jsx'
import { fB, fP, fG2 } from '../../utils/formatters.js'
import { CM, GP, AP, TP, LP, rl, topLabel, buildLTM, fmtMoney } from '../../charts/chartConfig.jsx'
import { buildMonthlyChartTable } from '../../charts/chartTableConfig.js'

const SECTION_ORDER = [
  {
    id: 'well',
    title: 'Per-Well LOE',
    charts: [
      { key: 'jpFixed', title: 'JP Fixed ($/Well/mo)', dataKey: 'jpFixedOnlyPerWell', ltmKey: 'jpFixedOnlyPerWell', fmt: v => fmtMoney(v, 0), tooltipFmt: v => [fmtMoney(v, 0), 'JP Fixed/Well'], overlayKey: 'jpFixedPerWellMonth', fill: C.fixed, tableParts:[{ key:'gross_fixed_jp', label:'Numerator: JP Fixed Cost', formatter:v => fmtMoney(v, 0) }, { key:'jpWellCount', label:'Denominator: JP Wells', formatter:v => v.toFixed(0) }] },
      { key: 'rpFixed', title: 'RP Fixed ($/Well/mo)', dataKey: 'rpFixedOnlyPerWell', ltmKey: 'rpFixedOnlyPerWell', fmt: v => fmtMoney(v, 0), tooltipFmt: v => [fmtMoney(v, 0), 'RP Fixed/Well'], overlayKey: 'rpFixedPerWellMonth', fill: C.fixed, tableParts:[{ key:'gross_fixed_rp', label:'Numerator: RP Fixed Cost', formatter:v => fmtMoney(v, 0) }, { key:'rpWellCount', label:'Denominator: RP Wells', formatter:v => v.toFixed(0) }] },
      { key: 'jpWorkover', title: 'JP Workover ($/Well/mo)', dataKey: 'jpWorkoverPerWell', ltmKey: 'jpWorkoverPerWell', fmt: v => fmtMoney(v, 0), tooltipFmt: v => [fmtMoney(v, 0), 'JP Workover/Well'], overlayKey: 'jpWorkoverPerWellMonth', fill: C.workover, tableParts:[{ key:'gross_workover_jp', label:'Numerator: JP Workover Cost', formatter:v => fmtMoney(v, 0) }, { key:'jpWellCount', label:'Denominator: JP Wells', formatter:v => v.toFixed(0) }] },
      { key: 'rpWorkover', title: 'RP Workover ($/Well/mo)', dataKey: 'rpWorkoverPerWell', ltmKey: 'rpWorkoverPerWell', fmt: v => fmtMoney(v, 0), tooltipFmt: v => [fmtMoney(v, 0), 'RP Workover/Well'], overlayKey: 'rpWorkoverPerWellMonth', fill: C.workover, tableParts:[{ key:'gross_workover_rp', label:'Numerator: RP Workover Cost', formatter:v => fmtMoney(v, 0) }, { key:'rpWellCount', label:'Denominator: RP Wells', formatter:v => v.toFixed(0) }] },
    ],
  },
  {
    id: 'unit',
    title: 'Unit Costs And Revenue Credits',
    charts: [
      { key: 'varOil', title: 'Oil Unit Cost ($/Gross Bbl)', dataKey: 'varOilPerBOE', ltmKey: 'varOilPerBOE', fmt: fB, tooltipFmt: v => [fB(v), 'Oil Unit Cost/Gross Bbl'], overlayKey: 'varOilPerBOE', fill: C.varOil, tableParts:[{ key:'gross_var_oil', label:'Numerator: Gross Oil Cost', formatter:fB }, { key:'gross_oil', label:'Denominator: Gross Oil Volume', formatter:v => v.toFixed(0) }] },
      { key: 'gpt', title: 'GP&T ($/Gross Mcf)', dataKey: 'gptPerMcf', ltmKey: 'gptPerMcf', fmt: v => fmtMoney(v, 3), tooltipFmt: v => [fmtMoney(v, 3), 'GP&T/Gross Mcf'], overlayKey: 'gptPerMcf', fill: C.gpt, tableParts:[{ key:'gross_gpt', label:'Numerator: Gross GP&T Cost', formatter:fB }, { key:'gross_gas', label:'Denominator: Gross Gas Volume', formatter:v => v.toFixed(0) }] },
      { key: 'midstream', title: 'Midstream Revenue ($/Gross Mcf)', dataKey: 'midstreamPerMcf', ltmKey: 'midstreamPerMcf', fmt: v => fmtMoney(v, 3), tooltipFmt: v => [fmtMoney(v, 3), 'Midstream/Gross Mcf'], overlayKey: 'midstreamPerMcf', fill: C.midstream, tableParts:[{ key:'midstream', label:'Numerator: Midstream Revenue', formatter:fB }, { key:'gross_gas', label:'Denominator: Gross Gas Volume', formatter:v => v.toFixed(0) }] },
      { key: 'water', title: 'Water ($/Gross Bbl water)', dataKey: 'varWaterPerBBL', ltmKey: 'varWaterPerBBL', fmt: fB, tooltipFmt: v => [fB(v), 'Water/Gross Bbl'], overlayKey: 'varWaterPerBBL', fill: C.varWater, tableParts:[{ key:'gross_var_water', label:'Numerator: Gross Water Cost', formatter:fB }, { key:'histGrossWaterVolume', label:'Denominator: Gross Water Volume', formatter:v => v.toFixed(0) }] },
      { key: 'tax', title: 'Production Taxes (% Revenue)', dataKey: 'prodTaxPct', ltmKey: 'prodTaxPct', fmt: fP, tooltipFmt: v => [fP(v), 'Prod Tax %'], overlayKey: 'prodTaxPct', yTickFmt: v => `${v.toFixed(1)}%`, labelFmt: v => `${v.toFixed(1)}%`, fill: C.prodTaxes, tableParts:[{ key:'prod_taxes', label:'Numerator: Production Taxes', formatter:fB }, { key:'totalRevenue', label:'Denominator: Revenue', formatter:fB }] },
    ],
  },
  {
    id: 'diff',
    title: 'Pricing Differentials',
    charts: [
      { key: 'oilDiff', title: 'Oil Differential (Realized - MEH, $/Bbl)', dataKey: 'oilDifferential', ltmKey: 'oilDifferential', fmt: fB, tooltipFmt: v => [fB(v), 'Oil Differential'], overlayKey: 'oilDiff', fill: C.differential, tableParts:[{ key:'realizedOil', label:'Realized Oil', formatter:fB }, { key:'actualOilPrice', label:'Benchmark Oil', formatter:fB }] },
      { key: 'gasDiff', title: 'Gas Differential (Realized - HSC, $/Mcf)', dataKey: 'gasDifferential', ltmKey: 'gasDifferential', fmt: fG2, tooltipFmt: v => [fG2(v), 'Gas Differential'], overlayKey: 'gasDiff', fill: C.differential, tableParts:[{ key:'realizedGas', label:'Realized Gas', formatter:fG2 }, { key:'actualGasPrice', label:'Benchmark Gas', formatter:fG2 }] },
      { key: 'nglDiff', title: 'NGL Differential (Realized / WTI, %)', dataKey: 'nglDifferential', ltmKey: 'nglDifferential', fmt: v => (v == null || !isFinite(v) ? '--' : `${(v * 100).toFixed(1)}%`), tooltipFmt: v => [`${(v * 100).toFixed(1)}%`, 'NGL Differential'], overlayKey: 'nglDiffPct', yTickFmt: v => `${(v * 100).toFixed(1)}%`, labelFmt: v => `${(v * 100).toFixed(1)}%`, fill: C.differential, tableParts:[{ key:'realizedNGL', label:'Realized NGL', formatter:fB }, { key:'actualNGLPrice', label:'Benchmark WTI', formatter:fB }] },
    ],
  },
]

function sliceLabel(slice) {
  return slice === 'obo' ? 'Non-Operated' : 'Operated'
}

function valueForOverlay(inputs, key) {
  const parsed = parseFloat(inputs?.[key])
  return Number.isFinite(parsed) ? parsed : null
}

function yTickFormatter(chart) {
  return chart.yTickFmt || chart.fmt
}

function labelFormatter(chart) {
  return chart.labelFmt || chart.fmt
}

export function InputChartsTab({ rollupsBySlice, ariesInputs, defaultSlice = 'op' }) {
  const [slice, setSlice] = useState(defaultSlice === 'obo' ? 'obo' : 'op')

  const data = rollupsBySlice?.[slice] || []
  const myInputs = ariesInputs?.myCase?.[slice] || {}
  const vdrInputs = ariesInputs?.vdrCase?.[slice] || {}

  const ltm = useMemo(() => {
    const out = {}
    SECTION_ORDER.forEach(section => {
      section.charts.forEach(chart => {
        out[chart.ltmKey] = {
          avg12: buildLTM(data, chart.ltmKey, 12),
          avg6: buildLTM(data, chart.ltmKey, 6),
        }
      })
    })
    return out
  }, [data])

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No data loaded - upload a CSV file to view input support charts.
      </div>
    )
  }

  const span = `${data[0].monthDisp} to ${data[data.length - 1].monthDisp}`

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Input Charts</h2>
          <p className="text-xs text-gray-500 mt-1">
            Historical support charts for every ARIES input. Use the local selector below to validate operated and non-operated assumptions without leaving this tab.
          </p>
          <p className="text-xs text-gray-400 mt-1">{data.length} months | {span} | showing {sliceLabel(slice)} inputs</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: 'op', label: 'Operated' },
            { id: 'obo', label: 'Non-Op' },
          ].map(option => (
            <button
              key={option.id}
              onClick={() => setSlice(option.id)}
              className={`px-3 py-1.5 rounded border text-xs font-semibold transition-colors cursor-pointer ${
                slice === option.id
                  ? 'bg-[#1F3864] text-white border-[#1F3864]'
                  : 'bg-white text-gray-600 border-gray-300 hover:text-gray-900 hover:border-gray-400'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {SECTION_ORDER.map(section => (
        <div key={section.id} className="space-y-3">
          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <div className="h-px flex-1 bg-gray-200" style={{ minWidth: '20px' }} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2 bg-gray-50 border border-gray-200 rounded">
              {section.title}
            </span>
            <div className="h-px flex-1 bg-gray-200" style={{ minWidth: '20px' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {section.charts.map(chart => {
              const ltmData = ltm[chart.ltmKey] || {}
              const vdr = valueForOverlay(vdrInputs, chart.overlayKey)
              const my = valueForOverlay(myInputs, chart.overlayKey)
              return (
                <ChartCard
                  key={chart.key}
                  title={chart.title}
                  ltmAvg={ltmData.avg12}
                  ltm6Avg={ltmData.avg6}
                  ltmFmt={chart.fmt}
                  hasVdrMy
                  detailTable={buildMonthlyChartTable(data, {
                    title: 'Historical Chart Data',
                    valueKey: chart.dataKey,
                    valueLabel: 'Chart Result',
                    valueFormatter: chart.fmt,
                    parts: chart.tableParts || [],
                  })}
                >
                  {(yDomain, overlays, colors) => (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data} margin={CM}>
                        <CartesianGrid {...GP} />
                        <XAxis dataKey="monthDisp" {...AP} />
                        <YAxis {...AP} tickFormatter={yTickFormatter(chart)} domain={yDomain} />
                        <Tooltip {...TP} formatter={chart.tooltipFmt} />
                        <Legend {...LP} />
                        <Bar dataKey={chart.dataKey} name={chart.title} fill={chart.fill}>
                          <LabelList dataKey={chart.dataKey} content={topLabel(labelFormatter(chart))} />
                        </Bar>
                        {rl('ltm', ltmData.avg12, overlays, colors, chart.fmt, 'LTM 12mo')}
                        {rl('ltm6', ltmData.avg6, overlays, colors, chart.fmt, 'LTM 6mo', '2 2')}
                        {rl('vdr', vdr, overlays, colors, chart.fmt, 'VDR')}
                        {rl('my', my, overlays, colors, chart.fmt, 'My')}
                        <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
