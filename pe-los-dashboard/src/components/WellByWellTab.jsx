import React, { useState, useMemo, memo } from 'react'
import {
  BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { CHART_COLORS as C } from '../constants/losMapping'

// ─── Chart type definitions ──────────────────────────────────────────────────
const CHART_TYPES = [
  { id: 'grossProduction', label: 'Gross Production',       unit: 'BOE/d' },
  { id: 'netProduction',   label: 'Net Production',         unit: 'BOE/d' },
  { id: 'totalLOS',        label: 'Total LOS',              unit: '$/mo'  },
  { id: 'varOilPerBOE',    label: 'Var Oil ($/BOE)',        unit: '$/BOE' },
  { id: 'varWater',        label: 'Var Water',              unit: '$/mo'  },
  { id: 'fixedCost',       label: 'Fixed ($/well/mo)',      unit: '$/mo'  },
  { id: 'prodTaxPct',      label: 'Prod Tax (% rev)',       unit: '%'     },
  { id: 'costPerBOE',      label: 'Cost/BOE',               unit: '$/BOE' },
  { id: 'realizedOil',     label: 'Realized Oil',           unit: '$/BBL' },
  { id: 'realizedGas',     label: 'Realized Gas',           unit: '$/MMBTU'},
  { id: 'revenueMargin',   label: 'Revenue & Margin',       unit: '$/BOE' },
]

// ─── Shared chart styles ─────────────────────────────────────────────────────
const CHART_MARGIN = { top: 2, right: 8, left: 0, bottom: 0 }
const GRID = { strokeDasharray: '3 3', stroke: '#2a2d3a', vertical: false }
const AXIS = {
  tick: { fill: '#4a4d5a', fontSize: 9 },
  axisLine: { stroke: '#2a2d3a' },
  tickLine: { stroke: '#2a2d3a' },
}
const TOOLTIP = {
  contentStyle: {
    backgroundColor: '#1a1d27',
    border: '1px solid #2a2d3a',
    borderRadius: '6px',
    fontSize: '11px',
    color: '#f0f0f0',
  },
  labelStyle: { color: '#8b8fa8' },
  cursor: { fill: 'rgba(255,255,255,0.03)' },
}

function safeAvg(arr, key) {
  const vals = arr.map(d => d[key]).filter(v => v != null && isFinite(v) && v !== 0)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function pctChange(current, ref) {
  if (!ref || ref === 0 || !isFinite(ref)) return null
  return ((current - ref) / Math.abs(ref)) * 100
}

function fmt2(n) { return n == null || isNaN(n) ? '—' : n.toFixed(2) }
function fmtK(n) { return n == null || isNaN(n) ? '—' : `$${(n / 1000).toFixed(1)}K` }
function fmtPct(n) { return n == null || isNaN(n) ? '—' : `${n.toFixed(1)}%` }
function fmtBOE(n) { return n == null || isNaN(n) ? '—' : `$${n.toFixed(2)}` }

// ─── Per-chart primary metric key for stats ───────────────────────────────────
const PRIMARY_KEYS = {
  grossProduction: 'grossBOEd',
  netProduction:   'netBOEd',
  totalLOS:        'totalLOS',
  varOilPerBOE:    'varOilPerBOE',
  varWater:        'varWaterPerMonth',
  fixedCost:       'fixed',
  prodTaxPct:      'prodTaxPct',
  costPerBOE:      'costPerBOE',
  realizedOil:     'realizedOil',
  realizedGas:     'realizedGas',
  revenueMargin:   'revenuePerBOE',
}

const PRIMARY_FMTS = {
  grossProduction: n => `${n.toFixed(1)} BOE/d`,
  netProduction:   n => `${n.toFixed(1)} BOE/d`,
  totalLOS:        fmtK,
  varOilPerBOE:    fmtBOE,
  varWater:        fmtK,
  fixedCost:       fmtK,
  prodTaxPct:      fmtPct,
  costPerBOE:      fmtBOE,
  realizedOil:     fmtBOE,
  realizedGas:     n => `$${n.toFixed(3)}`,
  revenueMargin:   fmtBOE,
}

// ─── WellChart ───────────────────────────────────────────────────────────────
function WellChart({ data, chartType, myCase, height = 160 }) {
  const my = {
    fixed:   parseFloat(myCase.fixedPerWellMonth) || null,
    varOil:  parseFloat(myCase.varOilPerBOE)       || null,
    prodTax: parseFloat(myCase.prodTaxPct)          || null,
  }

  const axes = (
    <>
      <CartesianGrid {...GRID} />
      <XAxis dataKey="monthDisplay" {...AXIS} interval="preserveStartEnd" />
    </>
  )

  switch (chartType) {
    case 'grossProduction':
      return (
        <BarChart data={data} margin={CHART_MARGIN}>
          {axes}
          <YAxis {...AXIS} tickFormatter={n => n.toFixed(0)} />
          <Tooltip {...TOOLTIP} formatter={(v, n) => [v.toFixed(1), n]} />
          <Bar dataKey="grossOild" name="Oil" fill={C.oil}  stackId="g" />
          <Bar dataKey="grossNGLd" name="NGL" fill={C.ngl}  stackId="g" />
          <Bar dataKey="grossGasd" name="Gas" fill={C.gas}  stackId="g" />
        </BarChart>
      )

    case 'netProduction':
      return (
        <BarChart data={data} margin={CHART_MARGIN}>
          {axes}
          <YAxis {...AXIS} tickFormatter={n => n.toFixed(0)} />
          <Tooltip {...TOOLTIP} formatter={(v, n) => [v.toFixed(1), n]} />
          <Bar dataKey="netOild" name="Oil" fill={C.oil}  stackId="n" />
          <Bar dataKey="netNGLd" name="NGL" fill={C.ngl}  stackId="n" />
          <Bar dataKey="netGasd" name="Gas" fill={C.gas}  stackId="n" />
        </BarChart>
      )

    case 'totalLOS':
      return (
        <BarChart data={data} margin={CHART_MARGIN}>
          {axes}
          <YAxis {...AXIS} tickFormatter={n => `$${(n / 1000).toFixed(0)}K`} />
          <Tooltip {...TOOLTIP} formatter={(v, n) => [`$${Number(v).toLocaleString()}`, n]} />
          <Bar dataKey="fixed"      name="Fixed"  fill={C.fixed}     stackId="l" />
          <Bar dataKey="var_oil"    name="VarOil" fill={C.varOil}    stackId="l" />
          <Bar dataKey="var_water"  name="Water"  fill={C.varWater}  stackId="l" />
          <Bar dataKey="prod_taxes" name="Tax"    fill={C.prodTaxes} stackId="l" />
        </BarChart>
      )

    case 'varOilPerBOE':
      return (
        <LineChart data={data} margin={CHART_MARGIN}>
          {axes}
          <YAxis {...AXIS} tickFormatter={n => `$${n.toFixed(1)}`} />
          <Tooltip {...TOOLTIP} formatter={v => [fmtBOE(v), 'Var Oil']} />
          <Line dataKey="varOilPerBOE" name="Var Oil" stroke={C.varOil} dot={false} strokeWidth={1.5} />
          {my.varOil && <ReferenceLine y={my.varOil} stroke={C.myCase} strokeDasharray="4 3" strokeWidth={1.5} />}
        </LineChart>
      )

    case 'varWater':
      return (
        <LineChart data={data} margin={CHART_MARGIN}>
          {axes}
          <YAxis {...AXIS} tickFormatter={n => `$${(n / 1000).toFixed(0)}K`} />
          <Tooltip {...TOOLTIP} formatter={v => [`$${Number(v).toLocaleString()}`, 'Var Water']} />
          <Line dataKey="varWaterPerMonth" name="Var Water" stroke={C.varWater} dot={false} strokeWidth={1.5} />
        </LineChart>
      )

    case 'fixedCost':
      return (
        <LineChart data={data} margin={CHART_MARGIN}>
          {axes}
          <YAxis {...AXIS} tickFormatter={n => `$${(n / 1000).toFixed(0)}K`} />
          <Tooltip {...TOOLTIP} formatter={v => [`$${Number(v).toLocaleString()}`, 'Fixed']} />
          <Line dataKey="fixed" name="Fixed" stroke={C.fixed} dot={false} strokeWidth={1.5} />
          {my.fixed && <ReferenceLine y={my.fixed} stroke={C.myCase} strokeDasharray="4 3" strokeWidth={1.5} />}
        </LineChart>
      )

    case 'prodTaxPct':
      return (
        <LineChart data={data} margin={CHART_MARGIN}>
          {axes}
          <YAxis {...AXIS} tickFormatter={n => `${n.toFixed(1)}%`} />
          <Tooltip {...TOOLTIP} formatter={v => [fmtPct(v), 'Prod Tax']} />
          <Line dataKey="prodTaxPct" name="Prod Tax" stroke={C.prodTaxes} dot={false} strokeWidth={1.5} />
          {my.prodTax && <ReferenceLine y={my.prodTax} stroke={C.myCase} strokeDasharray="4 3" strokeWidth={1.5} />}
        </LineChart>
      )

    case 'costPerBOE':
      return (
        <LineChart data={data} margin={CHART_MARGIN}>
          {axes}
          <YAxis {...AXIS} tickFormatter={n => `$${n.toFixed(1)}`} />
          <Tooltip {...TOOLTIP} formatter={v => [fmtBOE(v), 'LOS/BOE']} />
          <Line dataKey="costPerBOE" name="LOS/BOE" stroke={C.cost} dot={false} strokeWidth={1.5} />
        </LineChart>
      )

    case 'realizedOil':
      return (
        <LineChart data={data} margin={CHART_MARGIN}>
          {axes}
          <YAxis {...AXIS} tickFormatter={n => `$${n.toFixed(0)}`} />
          <Tooltip {...TOOLTIP} formatter={v => [fmtBOE(v), 'Realized Oil']} />
          <Line dataKey="realizedOil" name="Realized Oil" stroke={C.oil} dot={false} strokeWidth={1.5} />
        </LineChart>
      )

    case 'realizedGas':
      return (
        <LineChart data={data} margin={CHART_MARGIN}>
          {axes}
          <YAxis {...AXIS} tickFormatter={n => `$${n.toFixed(2)}`} />
          <Tooltip {...TOOLTIP} formatter={v => [`$${Number(v).toFixed(3)}`, 'Realized Gas']} />
          <Line dataKey="realizedGas" name="Realized Gas" stroke={C.gas} dot={false} strokeWidth={1.5} />
        </LineChart>
      )

    case 'revenueMargin':
    default:
      return (
        <ComposedChart data={data} margin={CHART_MARGIN}>
          {axes}
          <YAxis {...AXIS} tickFormatter={n => `$${n.toFixed(1)}`} />
          <Tooltip {...TOOLTIP} formatter={v => [fmtBOE(v)]} />
          <Line dataKey="revenuePerBOE" name="Revenue" stroke={C.revenue} dot={false} strokeWidth={1.5} />
          <Line dataKey="marginPerBOE"  name="Margin"  stroke={C.margin}  dot={false} strokeWidth={1.5} />
          <ReferenceLine y={0} stroke="#4a4d5a" strokeDasharray="3 3" />
        </ComposedChart>
      )
  }
}

// ─── WellCard ────────────────────────────────────────────────────────────────
const WellCard = memo(function WellCard({ well, chartType, ariesInputs }) {
  const data = well.monthlyData
  const key = PRIMARY_KEYS[chartType]
  const fmtFn = PRIMARY_FMTS[chartType]

  const avgAll = safeAvg(data, key)
  const last = data[data.length - 1]
  const lastVal = last ? last[key] : null
  const avg6 = safeAvg(data.slice(-6), key)
  const chg6 = lastVal != null && avg6 != null ? pctChange(lastVal, avg6) : null

  const badge = (text, color) => text ? (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide ${color}`}>
      {text}
    </span>
  ) : null

  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-lg overflow-hidden">
      {/* Card header */}
      <div className="px-4 py-3 border-b border-[#2a2d3a] flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#f0f0f0] truncate" title={well.wellName}>
            {well.wellName}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {badge(well.jpRp,  'bg-[#6366f1]/20 text-[#a5b4fc]')}
            {badge(well.opObo, well.opObo === 'OP' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400')}
            <span className="text-[9px] text-[#4a4d5a] font-mono">
              NRI {(well.nri * 100).toFixed(1)}% · WI {(well.wi * 100).toFixed(1)}%
            </span>
          </div>
        </div>
        {lastVal != null && fmtFn && (
          <div className="text-right flex-shrink-0">
            <div className="text-sm font-semibold text-[#f0f0f0]">{fmtFn(lastVal)}</div>
            <div className="text-[9px] text-[#8b8fa8]">last mo</div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="px-2 pt-3 pb-1" style={{ height: '180px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <WellChart
            data={data}
            chartType={chartType}
            myCase={ariesInputs.myCase}
          />
        </ResponsiveContainer>
      </div>

      {/* Stats row */}
      <div className="px-4 py-2.5 border-t border-[#2a2d3a] grid grid-cols-3 gap-2">
        <div>
          <div className="text-[9px] text-[#4a4d5a] uppercase tracking-wide">Avg (all)</div>
          <div className="text-xs text-[#8b8fa8] font-mono mt-0.5">
            {avgAll != null && fmtFn ? fmtFn(avgAll) : '—'}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-[#4a4d5a] uppercase tracking-wide">6-mo Avg</div>
          <div className="text-xs text-[#8b8fa8] font-mono mt-0.5">
            {avg6 != null && fmtFn ? fmtFn(avg6) : '—'}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-[#4a4d5a] uppercase tracking-wide">vs. 6-mo</div>
          <div className={`text-xs font-mono mt-0.5 ${
            chg6 == null ? 'text-[#4a4d5a]'
            : chg6 < 0   ? 'text-emerald-400'
            : chg6 > 0   ? 'text-red-400'
            : 'text-[#8b8fa8]'
          }`}>
            {chg6 != null ? `${chg6 > 0 ? '+' : ''}${chg6.toFixed(1)}%` : '—'}
          </div>
        </div>
      </div>
    </div>
  )
})

// ─── Main component ──────────────────────────────────────────────────────────
export default function WellByWellTab({ wellData, ariesInputs }) {
  const [chartType, setChartType] = useState('netProduction')
  const [search, setSearch]       = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return wellData
    const q = search.toLowerCase()
    return wellData.filter(w => w.wellName.toLowerCase().includes(q))
  }, [wellData, search])

  if (!wellData || wellData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[#8b8fa8] text-sm">
        No data loaded — upload a CSV file to view well cards.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-[#f0f0f0]">Well by Well</h2>
        <p className="text-xs text-[#8b8fa8] mt-1">
          {wellData.length} wells — select chart type to apply to all cards
        </p>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4a4d5a]" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search wells…"
            className="pl-7 pr-3 py-1.5 bg-[#1a1d27] border border-[#2a2d3a] rounded text-xs text-[#f0f0f0] placeholder-[#4a4d5a] outline-none focus:border-[#4a4d5a] w-48 transition-colors"
          />
        </div>

        {/* Chart type toggle */}
        <div className="flex flex-wrap gap-1">
          {CHART_TYPES.map(ct => (
            <button
              key={ct.id}
              onClick={() => setChartType(ct.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                chartType === ct.id
                  ? 'bg-[#4e9af1] text-white'
                  : 'bg-[#1a1d27] border border-[#2a2d3a] text-[#8b8fa8] hover:text-[#f0f0f0] hover:border-[#4a4d5a]'
              }`}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      {search && (
        <p className="text-xs text-[#8b8fa8]">
          Showing {filtered.length} of {wellData.length} wells
        </p>
      )}

      {/* Well card grid */}
      <div className="grid grid-cols-2 gap-4">
        {filtered.map(well => (
          <WellCard
            key={well.wellName}
            well={well}
            chartType={chartType}
            ariesInputs={ariesInputs}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-[#4a4d5a] text-sm">
          No wells match "{search}"
        </div>
      )}
    </div>
  )
}
