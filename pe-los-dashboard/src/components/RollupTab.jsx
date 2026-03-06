import React, { useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import ChartCard, { buildMiniRows } from './ChartCard'
import ExportButton from './ExportButton'
import { exportHistoricalData } from '../utils/exportCSV'
import { CHART_COLORS as C } from '../constants/losMapping'

// ─── Shared Recharts style props ────────────────────────────────────────────
const CHART_MARGIN = { top: 4, right: 16, left: 0, bottom: 0 }

const GRID = { strokeDasharray: '3 3', stroke: '#2a2d3a', vertical: false }

const AXIS = {
  tick: { fill: '#4a4d5a', fontSize: 10 },
  axisLine: { stroke: '#2a2d3a' },
  tickLine: { stroke: '#2a2d3a' },
}

const TOOLTIP = {
  contentStyle: {
    backgroundColor: '#1a1d27',
    border: '1px solid #2a2d3a',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#f0f0f0',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  },
  labelStyle: { color: '#8b8fa8', marginBottom: '4px' },
  cursor: { fill: 'rgba(255,255,255,0.03)' },
}

const LEGEND = { wrapperStyle: { fontSize: '10px', paddingTop: '8px' } }

// ─── Formatters ──────────────────────────────────────────────────────────────
const fmtD  = n => n == null || isNaN(n) ? '—' : n.toFixed(0)
const fmtD1 = n => n == null || isNaN(n) ? '—' : n.toFixed(1)
const fmtD2 = n => n == null || isNaN(n) ? '—' : n.toFixed(2)
const fmtD3 = n => n == null || isNaN(n) ? '—' : n.toFixed(3)
const fmtK  = n => n == null || isNaN(n) ? '—' : `$${(n / 1000).toFixed(0)}K`
const fmtDol  = n => n == null || isNaN(n) ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
const fmtPct  = n => n == null || isNaN(n) ? '—' : `${Number(n).toFixed(2)}%`
const fmtBOE  = n => n == null || isNaN(n) ? '—' : `$${Number(n).toFixed(2)}`
const fmtGas  = n => n == null || isNaN(n) ? '—' : `$${Number(n).toFixed(3)}`

// ─── ARIES reference lines ───────────────────────────────────────────────────
function AriesLines({ myVal, vdrVal, fmtFn }) {
  fmtFn = fmtFn || fmtD2
  return (
    <>
      {myVal != null && isFinite(myVal) && (
        <ReferenceLine
          y={myVal}
          stroke={C.myCase}
          strokeDasharray="5 3"
          strokeWidth={1.5}
          label={{ value: `My: ${fmtFn(myVal)}`, fill: C.myCase, fontSize: 9, position: 'insideTopRight' }}
        />
      )}
      {vdrVal != null && isFinite(vdrVal) && (
        <ReferenceLine
          y={vdrVal}
          stroke={C.vdrCase}
          strokeDasharray="2 4"
          strokeWidth={1.5}
          label={{ value: `VDR: ${fmtFn(vdrVal)}`, fill: C.vdrCase, fontSize: 9, position: 'insideBottomRight' }}
        />
      )}
    </>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function RollupTab({ monthlyRollup, ariesInputs, wellData }) {
  const chartData = useMemo(
    () => monthlyRollup.map(m => ({ ...m, label: m.monthDisplay })),
    [monthlyRollup],
  )

  const { myCase, vdrCase } = ariesInputs
  const my = {
    fixed:   parseFloat(myCase.fixedPerWellMonth) || null,
    varOil:  parseFloat(myCase.varOilPerBOE)       || null,
    prodTax: parseFloat(myCase.prodTaxPct)          || null,
  }
  const vdr = {
    fixed:   parseFloat(vdrCase.fixedPerWellMonth) || null,
    varOil:  parseFloat(vdrCase.varOilPerBOE)       || null,
    prodTax: parseFloat(vdrCase.prodTaxPct)          || null,
  }

  if (monthlyRollup.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[#8b8fa8] text-sm">
        No data loaded — upload a CSV file to view portfolio charts.
      </div>
    )
  }

  const span = `${chartData[0]?.label} – ${chartData[chartData.length - 1]?.label}`

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#f0f0f0]">Portfolio Rollup</h2>
          <p className="text-xs text-[#8b8fa8] mt-1">
            {monthlyRollup.length} months · {span} ·{' '}
            {monthlyRollup[monthlyRollup.length - 1]?.wellCount ?? '—'} active wells (last month)
          </p>
        </div>
        {wellData && (
          <ExportButton onClick={() => exportHistoricalData(wellData)}>
            Export Historical Data
          </ExportButton>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">

        {/* 1 — Gross Production */}
        <ChartCard
          title="Gross Production"
          subtitle="BOE/d — Oil / Gas / NGL stacked"
          miniRows={buildMiniRows(chartData, 'grossBOEd', fmtD1)}
          miniFormatter={v => `${fmtD1(v)} BOE/d`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={CHART_MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis {...AXIS} tickFormatter={fmtD} />
              <Tooltip {...TOOLTIP} formatter={(v, n) => [fmtD1(v), n]} />
              <Legend {...LEGEND} />
              <Bar dataKey="grossOild" name="Oil (BBL/d)"  fill={C.oil}  stackId="g" />
              <Bar dataKey="grossNGLd" name="NGL (BBL/d)"  fill={C.ngl}  stackId="g" />
              <Bar dataKey="grossGasd" name="Gas (MCFD)"   fill={C.gas}  stackId="g" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 2 — Net Production */}
        <ChartCard
          title="Net Production"
          subtitle="BOE/d — Oil / Gas / NGL stacked"
          miniRows={buildMiniRows(chartData, 'netBOEd', fmtD1)}
          miniFormatter={v => `${fmtD1(v)} BOE/d`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={CHART_MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis {...AXIS} tickFormatter={fmtD} />
              <Tooltip {...TOOLTIP} formatter={(v, n) => [fmtD1(v), n]} />
              <Legend {...LEGEND} />
              <Bar dataKey="netOild" name="Oil (BBL/d)" fill={C.oil}  stackId="n" />
              <Bar dataKey="netNGLd" name="NGL (BBL/d)" fill={C.ngl}  stackId="n" />
              <Bar dataKey="netGasd" name="Gas (MCFD)"  fill={C.gas}  stackId="n" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 3 — Total LOS */}
        <ChartCard
          title="Total LOS"
          subtitle="$/month — by cost bucket"
          miniRows={buildMiniRows(chartData, 'totalLOS', fmtDol)}
          miniFormatter={fmtDol}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={CHART_MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis {...AXIS} tickFormatter={fmtK} />
              <Tooltip {...TOOLTIP} formatter={(v, n) => [fmtDol(v), n]} />
              <Legend {...LEGEND} />
              <Bar dataKey="fixed"      name="Fixed"      fill={C.fixed}     stackId="los" />
              <Bar dataKey="var_oil"    name="Var Oil"    fill={C.varOil}    stackId="los" />
              <Bar dataKey="var_water"  name="Var Water"  fill={C.varWater}  stackId="los" />
              <Bar dataKey="prod_taxes" name="Prod Taxes" fill={C.prodTaxes} stackId="los" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 4 — Variable Oil $/BOE */}
        <ChartCard
          title="Variable Oil Costs"
          subtitle="$/BOE (applied to oil + NGL production)"
          miniRows={buildMiniRows(chartData, 'varOilPerBOE', fmtBOE)}
          miniFormatter={fmtBOE}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={CHART_MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis {...AXIS} tickFormatter={v => `$${v.toFixed(1)}`} />
              <Tooltip {...TOOLTIP} formatter={(v, n) => [fmtBOE(v), n]} />
              <Legend {...LEGEND} />
              <Line dataKey="varOilPerBOE" name="Historical" stroke={C.varOil} dot={false} strokeWidth={2} />
              <AriesLines myVal={my.varOil} vdrVal={vdr.varOil} fmtFn={fmtBOE} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 5 — Variable Water $/month */}
        <ChartCard
          title="Variable Water Costs"
          subtitle="$/month — Liquids Hauling &amp; Disposal (water BBL/d not in LOS)"
          miniRows={buildMiniRows(chartData, 'varWaterPerMonth', fmtDol)}
          miniFormatter={fmtDol}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={CHART_MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis {...AXIS} tickFormatter={fmtK} />
              <Tooltip {...TOOLTIP} formatter={(v, n) => [fmtDol(v), n]} />
              <Legend {...LEGEND} />
              <Line dataKey="varWaterPerMonth" name="Historical ($/mo)" stroke={C.varWater} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 6 — Fixed + WO $/well/month */}
        <ChartCard
          title="Fixed + WO Costs"
          subtitle="$/well/month (total fixed ÷ active wells)"
          miniRows={buildMiniRows(chartData, 'fixedPerWell', v => fmtDol(v))}
          miniFormatter={fmtDol}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={CHART_MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis {...AXIS} tickFormatter={v => `$${(v / 1000).toFixed(1)}K`} />
              <Tooltip {...TOOLTIP} formatter={(v, n) => [fmtDol(v), n]} />
              <Legend {...LEGEND} />
              <Line dataKey="fixedPerWell" name="Historical" stroke={C.fixed} dot={false} strokeWidth={2} />
              <AriesLines myVal={my.fixed} vdrVal={vdr.fixed} fmtFn={fmtDol} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 7 — Production Taxes % */}
        <ChartCard
          title="Production Taxes"
          subtitle="% of gross revenue"
          miniRows={buildMiniRows(chartData, 'prodTaxPct', fmtPct)}
          miniFormatter={fmtPct}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={CHART_MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis {...AXIS} tickFormatter={v => `${v.toFixed(1)}%`} />
              <Tooltip {...TOOLTIP} formatter={(v, n) => [fmtPct(v), n]} />
              <Legend {...LEGEND} />
              <Line dataKey="prodTaxPct" name="Historical" stroke={C.prodTaxes} dot={false} strokeWidth={2} />
              <AriesLines myVal={my.prodTax} vdrVal={vdr.prodTax} fmtFn={fmtPct} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 8 — Total LOS $/BOE */}
        <ChartCard
          title="Total Production Cost"
          subtitle="$/BOE (all-in LOS ÷ net BOE)"
          miniRows={buildMiniRows(chartData, 'costPerBOE', fmtBOE)}
          miniFormatter={fmtBOE}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={CHART_MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis {...AXIS} tickFormatter={v => `$${v.toFixed(1)}`} />
              <Tooltip {...TOOLTIP} formatter={(v, n) => [fmtBOE(v), n]} />
              <Legend {...LEGEND} />
              <Line dataKey="costPerBOE" name="LOS/BOE" stroke={C.cost} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 9 — Revenue $/BOE */}
        <ChartCard
          title="Revenue per BOE"
          subtitle="$/BOE"
          miniRows={buildMiniRows(chartData, 'revenuePerBOE', fmtBOE)}
          miniFormatter={fmtBOE}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={CHART_MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis {...AXIS} tickFormatter={v => `$${v.toFixed(1)}`} />
              <Tooltip {...TOOLTIP} formatter={(v, n) => [fmtBOE(v), n]} />
              <Legend {...LEGEND} />
              <Line dataKey="revenuePerBOE" name="Revenue/BOE" stroke={C.revenue} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 10 — Operating Margin $/BOE */}
        <ChartCard
          title="Operating Margin per BOE"
          subtitle="$/BOE (Revenue − LOS)"
          miniRows={buildMiniRows(chartData, 'marginPerBOE', fmtBOE)}
          miniFormatter={fmtBOE}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={CHART_MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis {...AXIS} tickFormatter={v => `$${v.toFixed(1)}`} />
              <Tooltip {...TOOLTIP} formatter={(v, n) => [fmtBOE(v), n]} />
              <Legend {...LEGEND} />
              <Line dataKey="marginPerBOE" name="Margin/BOE" stroke={C.margin} dot={false} strokeWidth={2} />
              <ReferenceLine y={0} stroke="#4a4d5a" strokeDasharray="3 3" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 11 — Realized Oil Price */}
        <ChartCard
          title="Realized Oil Price"
          subtitle="$/BBL"
          miniRows={buildMiniRows(chartData, 'realizedOil', fmtBOE)}
          miniFormatter={fmtBOE}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={CHART_MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis {...AXIS} tickFormatter={v => `$${v.toFixed(0)}`} />
              <Tooltip {...TOOLTIP} formatter={(v, n) => [fmtBOE(v), n]} />
              <Legend {...LEGEND} />
              <Line dataKey="realizedOil" name="Realized Oil" stroke={C.oil} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 12 — Realized Gas Price */}
        <ChartCard
          title="Realized Gas Price"
          subtitle="$/MMBTU"
          miniRows={buildMiniRows(chartData, 'realizedGas', fmtGas)}
          miniFormatter={fmtGas}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={CHART_MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis {...AXIS} tickFormatter={v => `$${v.toFixed(2)}`} />
              <Tooltip {...TOOLTIP} formatter={(v, n) => [fmtGas(v), n]} />
              <Legend {...LEGEND} />
              <Line dataKey="realizedGas" name="Realized Gas" stroke={C.gas} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 13 — Realized NGL Price */}
        <ChartCard
          title="Realized NGL Price"
          subtitle="$/BBL"
          miniRows={buildMiniRows(chartData, 'realizedNGL', fmtBOE)}
          miniFormatter={fmtBOE}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={CHART_MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis {...AXIS} tickFormatter={v => `$${v.toFixed(1)}`} />
              <Tooltip {...TOOLTIP} formatter={(v, n) => [fmtBOE(v), n]} />
              <Legend {...LEGEND} />
              <Line dataKey="realizedNGL" name="Realized NGL" stroke={C.ngl} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>
    </div>
  )
}
