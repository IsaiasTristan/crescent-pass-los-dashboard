import React, { useState, useMemo, useCallback, memo } from 'react'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, LabelList,
} from 'recharts'

// ─── Canonical modules ────────────────────────────────────────────────────────
import { CHART_COLORS as C, TABS, INITIAL_ARIES_INPUTS } from './constants/losMapping.js'
import { WBW_TYPES, WBW_GROUPS, SORT_OPTIONS } from './constants/wbwTypes.js'
import { parseCSVText } from './ingest/parseCsv.js'
import { buildMonthlyRollup, buildWellData, filterRows, selectActiveInputs, attachPricingDifferentials, attachHistoricalVolumes } from './selectors/buildRollups.js'
import { exportHistorical, exportDataQualityReport } from './export/exportCsv.js'
import { f$, fB, fP, fG2, fBoed, fMcfd, fMdol } from './utils/formatters.js'
import {
  CM, GP, AP, TP, LP, WAP, WCM,
  segLabel, topLabel, rl, smartUnit, buildLTM, safeAvg, fmtMoney, fmtMoneyScaled,
} from './charts/chartConfig.jsx'
import { buildMonthlyChartTable, buildWellChartTableConfig } from './charts/chartTableConfig.js'
import { ChartCard } from './components/charts/ChartCard.jsx'
import { ChartDataTable } from './components/charts/ChartDataTable.jsx'
import { InputsTab, InputChartsTab, LOSTableTab, HistoricalPricingTab } from './components/tabs/index.js'

// ─── ROLLUP TAB ───────────────────────────────────────────────────────────────

function RollupTab({ monthlyRollup, ariesInputs, wellData }) {
  const [unitProdPref, setUnitProdPref] = useState('auto')
  const [unitGasPref,  setUnitGasPref]  = useState('auto')
  const [unitCostPref, setUnitCostPref] = useState('auto')

  const data = useMemo(() => monthlyRollup.map(m => ({
    ...m,
    label: m.monthDisp,
    fixedOnlyPerWell: m.fixedOnlyPerWell,
    workoverPerWell:  m.workoverPerWell,
    jpFixedOnlyPerWell: m.jpFixedOnlyPerWell,
    rpFixedOnlyPerWell: m.rpFixedOnlyPerWell,
    jpWorkoverPerWell:  m.jpWorkoverPerWell,
    rpWorkoverPerWell:  m.rpWorkoverPerWell,
  })), [monthlyRollup])

  const { myCase, vdrCase } = ariesInputs
  const pf = k => parseFloat(k) || null
  const my = {
    jpFixed:  pf(myCase.jpFixedPerWellMonth),  rpFixed:  pf(myCase.rpFixedPerWellMonth),
    jpWkover: pf(myCase.jpWorkoverPerWellMonth), rpWkover: pf(myCase.rpWorkoverPerWellMonth),
    varOil:   pf(myCase.varOilPerBOE),           gpt: pf(myCase.gptPerMcf), midstream: pf(myCase.midstreamPerMcf),
    varWater: pf(myCase.varWaterPerBBL),         prodTax:  pf(myCase.prodTaxPct),
    oilDiff:  pf(myCase.oilDiff),                gasDiff:  pf(myCase.gasDiff), nglDiffPct: pf(myCase.nglDiffPct),
  }
  const vdr = {
    jpFixed:  pf(vdrCase.jpFixedPerWellMonth),  rpFixed:  pf(vdrCase.rpFixedPerWellMonth),
    jpWkover: pf(vdrCase.jpWorkoverPerWellMonth), rpWkover: pf(vdrCase.rpWorkoverPerWellMonth),
    varOil:   pf(vdrCase.varOilPerBOE),           gpt: pf(vdrCase.gptPerMcf), midstream: pf(vdrCase.midstreamPerMcf),
    varWater: pf(vdrCase.varWaterPerBBL),         prodTax:  pf(vdrCase.prodTaxPct),
    oilDiff:  pf(vdrCase.oilDiff),                gasDiff:  pf(vdrCase.gasDiff), nglDiffPct: pf(vdrCase.nglDiffPct),
  }

  if (!data.length) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">No data loaded -- upload a CSV file to view charts.</div>
  )

  const span   = `${data[0].label} to ${data[data.length-1].label}`
  const maxOf  = key => Math.max(0, ...data.map(d => Math.abs(d[key] || 0)))

  const boeUnit  = smartUnit('prod', unitProdPref, maxOf('netBOEd'))
  const gboUnit  = smartUnit('prod', unitProdPref, maxOf('grossBOEd'))
  const oilUnit  = smartUnit('prod', unitProdPref, maxOf('netOild'))
  const goilUnit = smartUnit('prod', unitProdPref, maxOf('grossOild'))
  const nglUnit  = smartUnit('prod', unitProdPref, maxOf('netNGLd'))
  const gasUnit  = smartUnit('gas',  unitGasPref,  maxOf('netGasd'))
  const ggasUnit = smartUnit('gas',  unitGasPref,  maxOf('grossGasd'))
  const losUnit  = smartUnit('cost', unitCostPref, maxOf('totalLOS'))
  const voilUnit = smartUnit('cost', unitCostPref, maxOf('var_oil'))
  const vwatUnit = smartUnit('cost', unitCostPref, maxOf('var_water'))
  const gptUnit  = smartUnit('cost', unitCostPref, maxOf('gpt'))
  const midUnit  = smartUnit('cost', unitCostPref, maxOf('midstream'))
  const ptaxUnit = smartUnit('cost', unitCostPref, maxOf('prod_taxes'))
  const capUnit  = smartUnit('cost', unitCostPref, maxOf('capex'))
  const perUnitFmt = n => fmtMoney(n, 2)
  const perUnitGasFmt = n => fmtMoney(n, 3)
  const realizedFmt = n => fmtMoney(n, 2)
  const realizedGasFmt = n => fmtMoney(n, 2)
  const nglRatioFmt = n => (n == null || !isFinite(n)) ? '--' : `${(Number(n) * 100).toFixed(1)}%`
  const perWellFmt = n => fmtMoney(n, 0)
  const perWellUnitLabel = '$/Well/mo'
  const dt = (valueKey, valueFormatter, parts = []) => buildMonthlyChartTable(data, {
    title: 'Historical Chart Data',
    valueKey,
    valueLabel: 'Chart Result',
    valueFormatter,
    parts,
  })

  const ltm = useMemo(() => {
    const metrics = [
      'netBOEd', 'grossBOEd', 'netOild', 'grossOild', 'netNGLd', 'netGasd', 'grossGasd',
      'totalLOS', 'var_oil', 'var_water', 'gpt', 'midstream', 'prod_taxes', 'prod_tax_oil',
      'prod_tax_gas', 'prod_tax_ngl', 'ad_valorem_tax', 'severanceTaxes', 'capex',
      'costPerBOE', 'varOilPerBOE', 'gptPerMcf', 'midstreamPerMcf', 'fixedOnlyPerWell', 'workoverPerWell',
      'varWaterPerBBL',
      'jpFixedOnlyPerWell', 'rpFixedOnlyPerWell', 'jpWorkoverPerWell', 'rpWorkoverPerWell',
      'capexPerWell', 'prodTaxPct', 'oilSevTaxPct', 'gasSevTaxPct', 'nglSevTaxPct', 'adValTaxPct',
      'realizedOil', 'realizedNGL', 'realizedGas',
      'actualOilPrice', 'actualNGLPrice', 'actualGasPrice', 'oilDifferential',
      'nglDifferential', 'gasDifferential', 'revenuePerBOE', 'marginPerBOE',
    ]
    return metrics.reduce((acc, key) => {
      acc.avg12[key] = buildLTM(data, key, 12)
      acc.avg6[key] = buildLTM(data, key, 6)
      return acc
    }, { avg12: {}, avg6: {} })
  }, [data])

  const UnitPill = ({ id, label, active, onClick }) => (
    <button key={id} onClick={onClick} style={{
      padding:'1px 7px', fontSize:'10px', fontWeight:700, cursor:'pointer',
      border:'1px solid', borderRadius:'3px', transition:'all 0.15s',
      background: active ? '#1F3864' : 'white',
      color:      active ? 'white'   : '#6B7280',
      borderColor:active ? '#1F3864' : '#D1D5DB',
    }}>{label}</button>
  )

  const SectionHeader = ({ title, controls }) => (
    <div className="flex items-center gap-3 pt-2 flex-wrap">
      <div className="h-px flex-1 bg-gray-200" style={{minWidth:'20px'}}/>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2 bg-gray-50 border border-gray-200 rounded">{title}</span>
        {controls}
      </div>
      <div className="h-px flex-1 bg-gray-200" style={{minWidth:'20px'}}/>
    </div>
  )

  const boeControls = (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[9px] font-semibold text-gray-400 uppercase">BOE:</span>
      {['auto','MBoed','Boed'].map(u => <UnitPill key={u} id={u} label={u==='auto'?'Auto':u} active={unitProdPref===u} onClick={()=>setUnitProdPref(u)}/>)}
      <span className="text-[9px] font-semibold text-gray-400 uppercase ml-2">Gas:</span>
      {['auto','MMcfd','Mcfd'].map(u => <UnitPill key={u} id={u} label={u==='auto'?'Auto':u} active={unitGasPref===u} onClick={()=>setUnitGasPref(u)}/>)}
    </div>
  )

  const costControls = (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[9px] font-semibold text-gray-400 uppercase">Unit:</span>
      {['auto','$MM','$M','$'].map(u => <UnitPill key={u} id={u} label={u==='auto'?'Auto':u} active={unitCostPref===u} onClick={()=>setUnitCostPref(u)}/>)}
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Asset Rollup</h2>
          <p className="text-xs text-gray-500 mt-1">{data.length} months | {span} | {data[data.length-1]?.wellCount ?? '--'} active wells last month</p>
        </div>
        {wellData && wellData.length > 0 && (
          <button onClick={() => exportHistorical(wellData)}
            className="px-4 py-2 bg-white border border-gray-300 rounded text-sm text-gray-600 hover:text-gray-900 hover:border-gray-400 transition-colors cursor-pointer font-semibold">
            Export Historical Data
          </button>
        )}
      </div>

      {/* ===== VOLUMES ===== */}
      <SectionHeader title="Volumes" controls={boeControls}/>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px'}}>

        <ChartCard title={`Net Production (${boeUnit.label})`} ltmAvg={ltm.avg12.netBOEd} ltm6Avg={ltm.avg6.netBOEd} ltmFmt={boeUnit.labelFmt} detailTable={dt('netBOEd', boeUnit.labelFmt, [
          { key: 'netOild', label: 'Oil', formatter: oilUnit.labelFmt },
          { key: 'netNGLd', label: 'NGL', formatter: nglUnit.labelFmt },
          { key: 'netGasBOEd', label: 'Gas In BOE', formatter: boeUnit.labelFmt },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={boeUnit.tickFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[boeUnit.labelFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="netOild"    name="Oil" fill={C.oil} stackId="n"><LabelList dataKey="netOild"    content={segLabel(boeUnit.segFmt)}/></Bar>
                <Bar dataKey="netNGLd"    name="NGL" fill={C.ngl} stackId="n"><LabelList dataKey="netNGLd"    content={segLabel(boeUnit.segFmt)}/></Bar>
                <Bar dataKey="netGasBOEd" name="Gas" fill={C.gas} stackId="n">
                  <LabelList dataKey="netGasBOEd" content={segLabel(boeUnit.segFmt)}/>
                  <LabelList dataKey="netBOEd"    content={topLabel(boeUnit.segFmt)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={`Gross Production (${gboUnit.label})`} ltmAvg={ltm.avg12.grossBOEd} ltm6Avg={ltm.avg6.grossBOEd} ltmFmt={gboUnit.labelFmt} detailTable={dt('grossBOEd', gboUnit.labelFmt, [
          { key: 'grossOild', label: 'Oil', formatter: goilUnit.labelFmt },
          { key: 'grossNGLd', label: 'NGL', formatter: n => `${n.toFixed(1)} ${gboUnit.label}` },
          { key: 'grossGasBOEd', label: 'Gas In BOE', formatter: gboUnit.labelFmt },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={gboUnit.tickFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[gboUnit.labelFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="grossOild"    name="Oil" fill={C.oil} stackId="g"><LabelList dataKey="grossOild"    content={segLabel(gboUnit.segFmt)}/></Bar>
                <Bar dataKey="grossNGLd"    name="NGL" fill={C.ngl} stackId="g"><LabelList dataKey="grossNGLd"    content={segLabel(gboUnit.segFmt)}/></Bar>
                <Bar dataKey="grossGasBOEd" name="Gas" fill={C.gas} stackId="g">
                  <LabelList dataKey="grossGasBOEd" content={segLabel(gboUnit.segFmt)}/>
                  <LabelList dataKey="grossBOEd"    content={topLabel(gboUnit.segFmt)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={`Net Oil Production (${oilUnit.label})`} ltmAvg={ltm.avg12.netOild} ltm6Avg={ltm.avg6.netOild} ltmFmt={oilUnit.labelFmt} detailTable={dt('netOild', oilUnit.labelFmt)}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={oilUnit.tickFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[oilUnit.labelFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="netOild" name="Net Oil" fill={C.oil}>
                  <LabelList dataKey="netOild" content={topLabel(oilUnit.segFmt)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={`Gross Oil Production (${goilUnit.label})`} ltmAvg={ltm.avg12.grossOild} ltm6Avg={ltm.avg6.grossOild} ltmFmt={goilUnit.labelFmt} detailTable={dt('grossOild', goilUnit.labelFmt)}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={goilUnit.tickFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[goilUnit.labelFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="grossOild" name="Gross Oil" fill={C.oil}>
                  <LabelList dataKey="grossOild" content={topLabel(goilUnit.segFmt)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={`Net NGL Production (${nglUnit.label})`} ltmAvg={ltm.avg12.netNGLd} ltm6Avg={ltm.avg6.netNGLd} ltmFmt={nglUnit.labelFmt} detailTable={dt('netNGLd', nglUnit.labelFmt)}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={nglUnit.tickFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[nglUnit.labelFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="netNGLd" name="Net NGL" fill={C.ngl}>
                  <LabelList dataKey="netNGLd" content={topLabel(nglUnit.segFmt)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={`Net Gas Production (${gasUnit.label})`} ltmAvg={ltm.avg12.netGasd} ltm6Avg={ltm.avg6.netGasd} ltmFmt={gasUnit.labelFmt} detailTable={dt('netGasd', gasUnit.labelFmt)}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={gasUnit.tickFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[gasUnit.labelFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="netGasd" name="Net Gas" fill={C.gas}>
                  <LabelList dataKey="netGasd" content={topLabel(gasUnit.segFmt)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={`Gross Gas Production (${ggasUnit.label})`} ltmAvg={ltm.avg12.grossGasd} ltm6Avg={ltm.avg6.grossGasd} ltmFmt={ggasUnit.labelFmt} detailTable={dt('grossGasd', ggasUnit.labelFmt)}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={ggasUnit.tickFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[ggasUnit.labelFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="grossGasd" name="Gross Gas" fill={C.gas}>
                  <LabelList dataKey="grossGasd" content={topLabel(ggasUnit.segFmt)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

      </div>

      {/* ===== TOTAL COST ===== */}
      <SectionHeader title="Total Cost" controls={costControls}/>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px'}}>

        <ChartCard title={`Total Lease Operating Statement (${losUnit.label})`} ltmAvg={ltm.avg12.totalLOS} ltm6Avg={ltm.avg6.totalLOS} ltmFmt={losUnit.labelFmt} detailTable={dt('totalLOS', losUnit.labelFmt, [
          { key: 'var_oil', label: 'Var Oil', formatter: losUnit.labelFmt },
          { key: 'var_water', label: 'Var Water', formatter: losUnit.labelFmt },
          { key: 'totalFixed', label: 'Fixed + Workover', formatter: losUnit.labelFmt },
          { key: 'gpt', label: 'GP&T', formatter: losUnit.labelFmt },
          { key: 'prod_taxes', label: 'Prod Taxes', formatter: losUnit.labelFmt },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={losUnit.tickFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[losUnit.labelFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="var_oil"    name="Var Oil"      fill={C.varOil}    stackId="l"><LabelList dataKey="var_oil"    content={segLabel(losUnit.segFmt)}/></Bar>
                <Bar dataKey="var_water"  name="Var Water"    fill={C.varWater}  stackId="l"><LabelList dataKey="var_water"  content={segLabel(losUnit.segFmt)}/></Bar>
                <Bar dataKey="totalFixed" name="Fixed+Wkover" fill={C.fixed}     stackId="l"><LabelList dataKey="totalFixed" content={segLabel(losUnit.segFmt)}/></Bar>
                <Bar dataKey="gpt"        name="GP&T"         fill={C.gpt}       stackId="l"><LabelList dataKey="gpt"        content={segLabel(losUnit.segFmt)}/></Bar>
                <Bar dataKey="prod_taxes" name="Prod Taxes"   fill={C.prodTaxes} stackId="l">
                  <LabelList dataKey="prod_taxes" content={segLabel(losUnit.segFmt)}/>
                  <LabelList dataKey="totalLOS"   content={topLabel(losUnit.segFmt)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={`Var Oil Expense (${voilUnit.label})`} ltmAvg={ltm.avg12.var_oil} ltm6Avg={ltm.avg6.var_oil} ltmFmt={voilUnit.labelFmt} detailTable={dt('var_oil', voilUnit.labelFmt)}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={voilUnit.tickFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[voilUnit.labelFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="var_oil" name="Var Oil" fill={C.varOil}>
                  <LabelList dataKey="var_oil" content={topLabel(voilUnit.segFmt)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={`Water Expense (${vwatUnit.label})`} ltmAvg={ltm.avg12.var_water} ltm6Avg={ltm.avg6.var_water} ltmFmt={vwatUnit.labelFmt} detailTable={dt('var_water', vwatUnit.labelFmt)}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={vwatUnit.tickFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[vwatUnit.labelFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="var_water" name="Water" fill={C.varWater}>
                  <LabelList dataKey="var_water" content={topLabel(vwatUnit.segFmt)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={`GP&T (${gptUnit.label})`} ltmAvg={ltm.avg12.gpt} ltm6Avg={ltm.avg6.gpt} ltmFmt={gptUnit.labelFmt} detailTable={dt('gpt', gptUnit.labelFmt)}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={gptUnit.tickFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[gptUnit.labelFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="gpt" name="GP&T" fill={C.gpt}>
                  <LabelList dataKey="gpt" content={topLabel(gptUnit.segFmt)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={`Production Taxes Breakdown (${ptaxUnit.label})`} ltmAvg={ltm.avg12.prod_taxes} ltm6Avg={ltm.avg6.prod_taxes} ltmFmt={ptaxUnit.labelFmt} detailTable={dt('prod_taxes', ptaxUnit.labelFmt, [
          { key: 'prod_tax_oil', label: 'Oil Sev', formatter: ptaxUnit.labelFmt },
          { key: 'prod_tax_gas', label: 'Gas Sev', formatter: ptaxUnit.labelFmt },
          { key: 'prod_tax_ngl', label: 'NGL Sev', formatter: ptaxUnit.labelFmt },
          { key: 'ad_valorem_tax', label: 'Ad Valorem', formatter: ptaxUnit.labelFmt },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={ptaxUnit.tickFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[ptaxUnit.labelFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="prod_tax_oil" name="Oil Severance" fill={C.oil} stackId="tax">
                  <LabelList dataKey="prod_tax_oil" content={segLabel(ptaxUnit.segFmt)}/>
                </Bar>
                <Bar dataKey="prod_tax_gas" name="Gas Severance" fill={C.gas} stackId="tax">
                  <LabelList dataKey="prod_tax_gas" content={segLabel(ptaxUnit.segFmt)}/>
                </Bar>
                <Bar dataKey="prod_tax_ngl" name="NGL Severance" fill={C.ngl} stackId="tax">
                  <LabelList dataKey="prod_tax_ngl" content={segLabel(ptaxUnit.segFmt)}/>
                </Bar>
                <Bar dataKey="ad_valorem_tax" name="Ad Valorem" fill={C.prodTaxes} stackId="tax">
                  <LabelList dataKey="ad_valorem_tax" content={segLabel(ptaxUnit.segFmt)}/>
                  <LabelList dataKey="prod_taxes" content={topLabel(ptaxUnit.segFmt)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={`CAPEX (${capUnit.label})`} ltmAvg={ltm.avg12.capex} ltm6Avg={ltm.avg6.capex} ltmFmt={capUnit.labelFmt} detailTable={dt('capex', capUnit.labelFmt)}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={capUnit.tickFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[capUnit.labelFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="capex" name="CAPEX" fill={C.capex}>
                  <LabelList dataKey="capex" content={topLabel(capUnit.segFmt)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

      </div>

      {/* ===== MIDSTREAM ===== */}
      <SectionHeader title="Midstream Revenue" controls={costControls}/>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px'}}>

        <ChartCard title={`Midstream Revenue (${midUnit.label})`} ltmAvg={ltm.avg12.midstream} ltm6Avg={ltm.avg6.midstream} ltmFmt={midUnit.labelFmt} detailTable={dt('midstream', midUnit.labelFmt)}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={midUnit.tickFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[midUnit.labelFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="midstream" name="Midstream" fill={C.midstream}>
                  <LabelList dataKey="midstream" content={topLabel(midUnit.segFmt)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Midstream Revenue ($/Gross Mcf)" ltmAvg={ltm.avg12.midstreamPerMcf} ltm6Avg={ltm.avg6.midstreamPerMcf} ltmFmt={perUnitGasFmt} hasVdrMy detailTable={dt('midstreamPerMcf', perUnitGasFmt, [
          { key: 'midstream', label: 'Numerator: Midstream Revenue', formatter: midUnit.labelFmt },
          { key: 'gross_gas', label: 'Denominator: Gross Gas Volume', formatter: n => n.toFixed(0) },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={perUnitGasFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[perUnitGasFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="midstreamPerMcf" name="Midstream/Gross Mcf" fill={C.midstream}>
                  <LabelList dataKey="midstreamPerMcf" content={topLabel(perUnitGasFmt)}/>
                </Bar>
                {rl('ltm', ltm.avg12.midstreamPerMcf, ovl, clr, perUnitGasFmt, 'LTM 12mo')}
                {rl('ltm6', ltm.avg6.midstreamPerMcf, ovl, clr, perUnitGasFmt, 'LTM 6mo', '2 2')}
                {rl('vdr', vdr.midstream, ovl, clr, perUnitGasFmt, 'VDR')}
                {rl('my',  my.midstream,  ovl, clr, perUnitGasFmt, 'My')}
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

      </div>

      {/* ===== UNIT COST ===== */}
      <SectionHeader title="Unit Cost Benchmarks"/>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px'}}>

        <ChartCard title="Total Lease Operating Statement ($/Boe)" ltmAvg={ltm.avg12.costPerBOE} ltm6Avg={ltm.avg6.costPerBOE} ltmFmt={fB} detailTable={dt('costPerBOE', fB, [
          { key: 'totalLOS', label: 'Numerator: Total LOS', formatter: losUnit.labelFmt },
          { key: 'netBOE', label: 'Denominator: Net BOE', formatter: n => n.toFixed(0) },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={perUnitFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[fB(v),n]}/><Legend {...LP}/>
                <Bar dataKey="costPerBOE" name="LOS/Boe" fill={C.cost}>
                  <LabelList dataKey="costPerBOE" content={topLabel(perUnitFmt)}/>
                </Bar>
                {rl('ltm', ltm.avg12.costPerBOE, ovl, clr, fB, 'LTM 12mo')}
                {rl('ltm6', ltm.avg6.costPerBOE, ovl, clr, fB, 'LTM 6mo', '2 2')}
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Oil Unit Cost ($/Gross Bbl)" ltmAvg={ltm.avg12.varOilPerBOE} ltm6Avg={ltm.avg6.varOilPerBOE} ltmFmt={fB} hasVdrMy detailTable={dt('varOilPerBOE', fB, [
          { key: 'gross_var_oil', label: 'Numerator: Gross Oil Cost', formatter: voilUnit.labelFmt },
          { key: 'gross_oil', label: 'Denominator: Gross Oil Volume', formatter: n => n.toFixed(0) },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={perUnitFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[fB(v),n]}/><Legend {...LP}/>
                <Bar dataKey="varOilPerBOE" name="Oil Unit Cost/Gross Bbl" fill={C.varOil}>
                  <LabelList dataKey="varOilPerBOE" content={topLabel(perUnitFmt)}/>
                </Bar>
                {rl('ltm', ltm.avg12.varOilPerBOE, ovl, clr, fB, 'LTM 12mo')}
                {rl('ltm6', ltm.avg6.varOilPerBOE, ovl, clr, fB, 'LTM 6mo', '2 2')}
                {rl('vdr', vdr.varOil, ovl, clr, fB, 'VDR')}
                {rl('my',  my.varOil,  ovl, clr, fB, 'My')}
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="GP&T ($/Gross Mcf)" ltmAvg={ltm.avg12.gptPerMcf} ltm6Avg={ltm.avg6.gptPerMcf} ltmFmt={perUnitGasFmt} hasVdrMy detailTable={dt('gptPerMcf', perUnitGasFmt, [
          { key: 'gross_gpt', label: 'Numerator: Gross GP&T Cost', formatter: gptUnit.labelFmt },
          { key: 'gross_gas', label: 'Denominator: Gross Gas Volume', formatter: n => n.toFixed(0) },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={perUnitGasFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[perUnitGasFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="gptPerMcf" name="GP&T/Gross Mcf" fill={C.gpt}>
                  <LabelList dataKey="gptPerMcf" content={topLabel(perUnitGasFmt)}/>
                </Bar>
                {rl('ltm', ltm.avg12.gptPerMcf, ovl, clr, perUnitGasFmt, 'LTM 12mo')}
                {rl('ltm6', ltm.avg6.gptPerMcf, ovl, clr, perUnitGasFmt, 'LTM 6mo', '2 2')}
                {rl('vdr', vdr.gpt, ovl, clr, perUnitGasFmt, 'VDR')}
                {rl('my',  my.gpt,  ovl, clr, perUnitGasFmt, 'My')}
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Water ($/Gross Bbl water)" ltmAvg={ltm.avg12.varWaterPerBBL} ltm6Avg={ltm.avg6.varWaterPerBBL} ltmFmt={fB} hasVdrMy detailTable={dt('varWaterPerBBL', fB, [
          { key: 'gross_var_water', label: 'Numerator: Gross Water Cost', formatter: vwatUnit.labelFmt },
          { key: 'histGrossWaterVolume', label: 'Denominator: Gross Water Volume', formatter: n => n.toFixed(0) },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={perUnitFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[fB(v),n]}/><Legend {...LP}/>
                <Bar dataKey="varWaterPerBBL" name="Water/Gross Bbl" fill={C.varWater}>
                  <LabelList dataKey="varWaterPerBBL" content={topLabel(perUnitFmt)}/>
                </Bar>
                {rl('ltm', ltm.avg12.varWaterPerBBL, ovl, clr, fB, 'LTM 12mo')}
                {rl('ltm6', ltm.avg6.varWaterPerBBL, ovl, clr, fB, 'LTM 6mo', '2 2')}
                {rl('vdr', vdr.varWater, ovl, clr, fB, 'VDR')}
                {rl('my',  my.varWater,  ovl, clr, fB, 'My')}
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={`JP Fixed LOE (${perWellUnitLabel})`} ltmAvg={ltm.avg12.jpFixedOnlyPerWell} ltm6Avg={ltm.avg6.jpFixedOnlyPerWell} ltmFmt={perWellFmt} hasVdrMy detailTable={dt('jpFixedOnlyPerWell', perWellFmt, [
          { key: 'gross_fixed_jp', label: 'Numerator: JP Fixed Cost', formatter: perWellFmt },
          { key: 'jpWellCount', label: 'Denominator: JP Wells', formatter: n => n.toFixed(0) },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={perWellFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[perWellFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="jpFixedOnlyPerWell" name="JP Fixed/Well" fill={C.fixed}>
                  <LabelList dataKey="jpFixedOnlyPerWell" content={topLabel(perWellFmt)}/>
                </Bar>
                {rl('ltm', ltm.avg12.jpFixedOnlyPerWell, ovl, clr, perWellFmt, 'LTM 12mo')}
                {rl('ltm6', ltm.avg6.jpFixedOnlyPerWell, ovl, clr, perWellFmt, 'LTM 6mo', '2 2')}
                {rl('vdr', vdr.jpFixed, ovl, clr, perWellFmt, 'VDR JP')}
                {rl('my',  my.jpFixed,  ovl, clr, perWellFmt, 'My JP')}
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={`RP Fixed LOE (${perWellUnitLabel})`} ltmAvg={ltm.avg12.rpFixedOnlyPerWell} ltm6Avg={ltm.avg6.rpFixedOnlyPerWell} ltmFmt={perWellFmt} hasVdrMy detailTable={dt('rpFixedOnlyPerWell', perWellFmt, [
          { key: 'gross_fixed_rp', label: 'Numerator: RP Fixed Cost', formatter: perWellFmt },
          { key: 'rpWellCount', label: 'Denominator: RP Wells', formatter: n => n.toFixed(0) },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={perWellFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[perWellFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="rpFixedOnlyPerWell" name="RP Fixed/Well" fill={C.fixed}>
                  <LabelList dataKey="rpFixedOnlyPerWell" content={topLabel(perWellFmt)}/>
                </Bar>
                {rl('ltm', ltm.avg12.rpFixedOnlyPerWell, ovl, clr, perWellFmt, 'LTM 12mo')}
                {rl('ltm6', ltm.avg6.rpFixedOnlyPerWell, ovl, clr, perWellFmt, 'LTM 6mo', '2 2')}
                {rl('vdr', vdr.rpFixed, ovl, clr, perWellFmt, 'VDR RP')}
                {rl('my',  my.rpFixed,  ovl, clr, perWellFmt, 'My RP')}
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={`JP Workover (${perWellUnitLabel})`} ltmAvg={ltm.avg12.jpWorkoverPerWell} ltm6Avg={ltm.avg6.jpWorkoverPerWell} ltmFmt={perWellFmt} hasVdrMy detailTable={dt('jpWorkoverPerWell', perWellFmt, [
          { key: 'gross_workover_jp', label: 'Numerator: JP Workover Cost', formatter: perWellFmt },
          { key: 'jpWellCount', label: 'Denominator: JP Wells', formatter: n => n.toFixed(0) },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={perWellFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[perWellFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="jpWorkoverPerWell" name="JP Workover/Well" fill={C.workover}>
                  <LabelList dataKey="jpWorkoverPerWell" content={topLabel(perWellFmt)}/>
                </Bar>
                {rl('ltm', ltm.avg12.jpWorkoverPerWell, ovl, clr, perWellFmt, 'LTM 12mo')}
                {rl('ltm6', ltm.avg6.jpWorkoverPerWell, ovl, clr, perWellFmt, 'LTM 6mo', '2 2')}
                {rl('vdr', vdr.jpWkover, ovl, clr, perWellFmt, 'VDR JP')}
                {rl('my',  my.jpWkover,  ovl, clr, perWellFmt, 'My JP')}
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={`RP Workover (${perWellUnitLabel})`} ltmAvg={ltm.avg12.rpWorkoverPerWell} ltm6Avg={ltm.avg6.rpWorkoverPerWell} ltmFmt={perWellFmt} hasVdrMy detailTable={dt('rpWorkoverPerWell', perWellFmt, [
          { key: 'gross_workover_rp', label: 'Numerator: RP Workover Cost', formatter: perWellFmt },
          { key: 'rpWellCount', label: 'Denominator: RP Wells', formatter: n => n.toFixed(0) },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={perWellFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[perWellFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="rpWorkoverPerWell" name="RP Workover/Well" fill={C.workover}>
                  <LabelList dataKey="rpWorkoverPerWell" content={topLabel(perWellFmt)}/>
                </Bar>
                {rl('ltm', ltm.avg12.rpWorkoverPerWell, ovl, clr, perWellFmt, 'LTM 12mo')}
                {rl('ltm6', ltm.avg6.rpWorkoverPerWell, ovl, clr, perWellFmt, 'LTM 6mo', '2 2')}
                {rl('vdr', vdr.rpWkover, ovl, clr, perWellFmt, 'VDR RP')}
                {rl('my',  my.rpWkover,  ovl, clr, perWellFmt, 'My RP')}
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="CAPEX ($/Well/mo)" ltmAvg={ltm.avg12.capexPerWell} ltm6Avg={ltm.avg6.capexPerWell} ltmFmt={f$} detailTable={dt('capexPerWell', f$, [
          { key: 'capex', label: 'Numerator: CAPEX', formatter: capUnit.labelFmt },
          { key: 'wellCount', label: 'Denominator: Wells', formatter: n => n.toFixed(0) },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={f$} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[f$(v),n]}/><Legend {...LP}/>
                <Bar dataKey="capexPerWell" name="CAPEX/Well" fill={C.capex}>
                  <LabelList dataKey="capexPerWell" content={topLabel(f$)}/>
                </Bar>
                {rl('ltm', ltm.avg12.capexPerWell, ovl, clr, f$, 'LTM 12mo')}
                {rl('ltm6', ltm.avg6.capexPerWell, ovl, clr, f$, 'LTM 6mo', '2 2')}
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Production Taxes (% Revenue)" ltmAvg={ltm.avg12.prodTaxPct} ltm6Avg={ltm.avg6.prodTaxPct} ltmFmt={fP} hasVdrMy detailTable={dt('prodTaxPct', fP, [
          { key: 'prod_taxes', label: 'Numerator: Production Taxes', formatter: ptaxUnit.labelFmt },
          { key: 'totalRevenue', label: 'Denominator: Revenue', formatter: midUnit.labelFmt },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={v=>`${v.toFixed(1)}%`} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[fP(v),n]}/><Legend {...LP}/>
                <Bar dataKey="prodTaxPct" name="Prod Tax %" fill={C.prodTaxes}>
                  <LabelList dataKey="prodTaxPct" content={topLabel(v => `${v.toFixed(1)}%`)}/>
                </Bar>
                {rl('ltm', ltm.avg12.prodTaxPct, ovl, clr, fP, 'LTM 12mo')}
                {rl('ltm6', ltm.avg6.prodTaxPct, ovl, clr, fP, 'LTM 6mo', '2 2')}
                {rl('vdr', vdr.prodTax, ovl, clr, fP, 'VDR')}
                {rl('my',  my.prodTax,  ovl, clr, fP, 'My')}
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

      </div>

      <SectionHeader title="Tax Detail"/>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px'}}>

        <ChartCard title="Oil Severance Tax (% Revenue)" ltmAvg={ltm.avg12.oilSevTaxPct} ltm6Avg={ltm.avg6.oilSevTaxPct} ltmFmt={fP} detailTable={dt('oilSevTaxPct', fP, [
          { key: 'prod_tax_oil', label: 'Numerator: Oil Sev Tax', formatter: ptaxUnit.labelFmt },
          { key: 'oil_rev', label: 'Denominator: Oil Revenue', formatter: midUnit.labelFmt },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={v=>`${v.toFixed(1)}%`} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[fP(v),n]}/><Legend {...LP}/>
                <Bar dataKey="oilSevTaxPct" name="Oil Severance %" fill={C.oil}>
                  <LabelList dataKey="oilSevTaxPct" content={topLabel(v => `${v.toFixed(1)}%`)}/>
                </Bar>
                {rl('ltm', ltm.avg12.oilSevTaxPct, ovl, clr, fP, 'LTM 12mo')}
                {rl('ltm6', ltm.avg6.oilSevTaxPct, ovl, clr, fP, 'LTM 6mo', '2 2')}
                <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Gas Severance Tax (% Revenue)" ltmAvg={ltm.avg12.gasSevTaxPct} ltm6Avg={ltm.avg6.gasSevTaxPct} ltmFmt={fP} detailTable={dt('gasSevTaxPct', fP, [
          { key: 'prod_tax_gas', label: 'Numerator: Gas Sev Tax', formatter: ptaxUnit.labelFmt },
          { key: 'gas_rev', label: 'Denominator: Gas Revenue', formatter: midUnit.labelFmt },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={v=>`${v.toFixed(1)}%`} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[fP(v),n]}/><Legend {...LP}/>
                <Bar dataKey="gasSevTaxPct" name="Gas Severance %" fill={C.gas}>
                  <LabelList dataKey="gasSevTaxPct" content={topLabel(v => `${v.toFixed(1)}%`)}/>
                </Bar>
                {rl('ltm', ltm.avg12.gasSevTaxPct, ovl, clr, fP, 'LTM 12mo')}
                {rl('ltm6', ltm.avg6.gasSevTaxPct, ovl, clr, fP, 'LTM 6mo', '2 2')}
                <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="NGL Severance Tax (% Revenue)" ltmAvg={ltm.avg12.nglSevTaxPct} ltm6Avg={ltm.avg6.nglSevTaxPct} ltmFmt={fP} detailTable={dt('nglSevTaxPct', fP, [
          { key: 'prod_tax_ngl', label: 'Numerator: NGL Sev Tax', formatter: ptaxUnit.labelFmt },
          { key: 'ngl_rev', label: 'Denominator: NGL Revenue', formatter: midUnit.labelFmt },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={v=>`${v.toFixed(1)}%`} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[fP(v),n]}/><Legend {...LP}/>
                <Bar dataKey="nglSevTaxPct" name="NGL Severance %" fill={C.ngl}>
                  <LabelList dataKey="nglSevTaxPct" content={topLabel(v => `${v.toFixed(1)}%`)}/>
                </Bar>
                {rl('ltm', ltm.avg12.nglSevTaxPct, ovl, clr, fP, 'LTM 12mo')}
                {rl('ltm6', ltm.avg6.nglSevTaxPct, ovl, clr, fP, 'LTM 6mo', '2 2')}
                <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Ad Valorem Tax (% Rev net of severance)" ltmAvg={ltm.avg12.adValTaxPct} ltm6Avg={ltm.avg6.adValTaxPct} ltmFmt={fP} detailTable={dt('adValTaxPct', fP, [
          { key: 'ad_valorem_tax', label: 'Numerator: Ad Valorem Tax', formatter: ptaxUnit.labelFmt },
          { key: 'adValoremBase', label: 'Denominator: Rev Net Sev', formatter: midUnit.labelFmt },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={v=>`${v.toFixed(1)}%`} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[fP(v),n]}/><Legend {...LP}/>
                <Bar dataKey="adValTaxPct" name="Ad Valorem %" fill={C.prodTaxes}>
                  <LabelList dataKey="adValTaxPct" content={topLabel(v => `${v.toFixed(1)}%`)}/>
                </Bar>
                {rl('ltm', ltm.avg12.adValTaxPct, ovl, clr, fP, 'LTM 12mo')}
                {rl('ltm6', ltm.avg6.adValTaxPct, ovl, clr, fP, 'LTM 6mo', '2 2')}
                <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

      </div>

      {/* ===== REALIZED PRICES & MARGINS ===== */}
      <SectionHeader title="Other — Realized Prices & Margins"/>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px'}}>

        <ChartCard title="Realized Oil Price ($/Bbl)" ltmAvg={ltm.avg12.realizedOil} ltm6Avg={ltm.avg6.realizedOil} ltmFmt={fB} detailTable={dt('realizedOil', fB, [
          { key: 'oil_rev', label: 'Numerator: Oil Revenue', formatter: midUnit.labelFmt },
          { key: 'oil_vol', label: 'Denominator: Oil Volume', formatter: n => n.toFixed(0) },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={realizedFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[fB(v),n]}/><Legend {...LP}/>
                <Bar dataKey="realizedOil" name="Realized Oil" fill={C.oil}>
                  <LabelList dataKey="realizedOil" content={topLabel(fB)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Realized NGL Price ($/Bbl)" ltmAvg={ltm.avg12.realizedNGL} ltm6Avg={ltm.avg6.realizedNGL} ltmFmt={fB} detailTable={dt('realizedNGL', fB, [
          { key: 'ngl_rev', label: 'Numerator: NGL Revenue', formatter: midUnit.labelFmt },
          { key: 'ngl_vol', label: 'Denominator: NGL Volume', formatter: n => n.toFixed(0) },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={realizedFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[fB(v),n]}/><Legend {...LP}/>
                <Bar dataKey="realizedNGL" name="Realized NGL" fill={C.ngl}>
                  <LabelList dataKey="realizedNGL" content={topLabel(fB)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Realized Gas Price ($/Mcf)" ltmAvg={ltm.avg12.realizedGas} ltm6Avg={ltm.avg6.realizedGas} ltmFmt={fG2} detailTable={dt('realizedGas', fG2, [
          { key: 'gas_rev', label: 'Numerator: Gas Revenue', formatter: midUnit.labelFmt },
          { key: 'gas_vol', label: 'Denominator: Gas Volume', formatter: n => n.toFixed(0) },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={realizedGasFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[fG2(v),n]}/><Legend {...LP}/>
                <Bar dataKey="realizedGas" name="Realized Gas" fill={C.gas}>
                  <LabelList dataKey="realizedGas" content={topLabel(fG2)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Actual Oil Price (MEH, $/Bbl)" ltmAvg={ltm.avg12.actualOilPrice} ltm6Avg={ltm.avg6.actualOilPrice} ltmFmt={fB} detailTable={dt('actualOilPrice', fB)}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={realizedFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[fB(v),n]}/><Legend {...LP}/>
                <Bar dataKey="actualOilPrice" name="Actual Oil (MEH)" fill={C.index}>
                  <LabelList dataKey="actualOilPrice" content={topLabel(fB)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Actual NGL Price (WTI, $/Bbl)" ltmAvg={ltm.avg12.actualNGLPrice} ltm6Avg={ltm.avg6.actualNGLPrice} ltmFmt={fB} detailTable={dt('actualNGLPrice', fB)}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={realizedFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[fB(v),n]}/><Legend {...LP}/>
                <Bar dataKey="actualNGLPrice" name="Actual NGL (WTI)" fill={C.index}>
                  <LabelList dataKey="actualNGLPrice" content={topLabel(fB)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Actual Gas Price (HSC, $/Mcf)" ltmAvg={ltm.avg12.actualGasPrice} ltm6Avg={ltm.avg6.actualGasPrice} ltmFmt={fG2} detailTable={dt('actualGasPrice', fG2)}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={realizedGasFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[fG2(v),n]}/><Legend {...LP}/>
                <Bar dataKey="actualGasPrice" name="Actual Gas (HSC)" fill={C.index}>
                  <LabelList dataKey="actualGasPrice" content={topLabel(fG2)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Oil Differential (Realized - MEH, $/Bbl)" ltmAvg={ltm.avg12.oilDifferential} ltm6Avg={ltm.avg6.oilDifferential} ltmFmt={fB} hasVdrMy detailTable={dt('oilDifferential', fB, [
          { key: 'realizedOil', label: 'Realized Oil', formatter: fB },
          { key: 'actualOilPrice', label: 'Benchmark Oil', formatter: fB },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={realizedFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[fB(v),n]}/><Legend {...LP}/>
                <Bar dataKey="oilDifferential" name="Oil Differential" fill={C.differential}>
                  <LabelList dataKey="oilDifferential" content={topLabel(fB)}/>
                </Bar>
                {rl('ltm', ltm.avg12.oilDifferential, ovl, clr, fB, 'LTM 12mo')}
                {rl('ltm6', ltm.avg6.oilDifferential, ovl, clr, fB, 'LTM 6mo', '2 2')}
                {rl('vdr', vdr.oilDiff, ovl, clr, fB, 'VDR')}
                {rl('my',  my.oilDiff,  ovl, clr, fB, 'My')}
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="NGL Differential (Realized / WTI, %)" ltmAvg={ltm.avg12.nglDifferential} ltm6Avg={ltm.avg6.nglDifferential} ltmFmt={nglRatioFmt} hasVdrMy detailTable={dt('nglDifferential', nglRatioFmt, [
          { key: 'realizedNGL', label: 'Realized NGL', formatter: fB },
          { key: 'actualNGLPrice', label: 'Benchmark WTI', formatter: fB },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={nglRatioFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[nglRatioFmt(v),n]}/><Legend {...LP}/>
                <Bar dataKey="nglDifferential" name="NGL Differential" fill={C.differential}>
                  <LabelList dataKey="nglDifferential" content={topLabel(nglRatioFmt)}/>
                </Bar>
                {rl('ltm', ltm.avg12.nglDifferential, ovl, clr, nglRatioFmt, 'LTM 12mo')}
                {rl('ltm6', ltm.avg6.nglDifferential, ovl, clr, nglRatioFmt, 'LTM 6mo', '2 2')}
                {rl('vdr', vdr.nglDiffPct, ovl, clr, nglRatioFmt, 'VDR')}
                {rl('my',  my.nglDiffPct,  ovl, clr, nglRatioFmt, 'My')}
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Gas Differential (Realized - HSC, $/Mcf)" ltmAvg={ltm.avg12.gasDifferential} ltm6Avg={ltm.avg6.gasDifferential} ltmFmt={fG2} hasVdrMy detailTable={dt('gasDifferential', fG2, [
          { key: 'realizedGas', label: 'Realized Gas', formatter: fG2 },
          { key: 'actualGasPrice', label: 'Benchmark Gas', formatter: fG2 },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={realizedGasFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[fG2(v),n]}/><Legend {...LP}/>
                <Bar dataKey="gasDifferential" name="Gas Differential" fill={C.differential}>
                  <LabelList dataKey="gasDifferential" content={topLabel(fG2)}/>
                </Bar>
                {rl('ltm', ltm.avg12.gasDifferential, ovl, clr, fG2, 'LTM 12mo')}
                {rl('ltm6', ltm.avg6.gasDifferential, ovl, clr, fG2, 'LTM 6mo', '2 2')}
                {rl('vdr', vdr.gasDiff, ovl, clr, fG2, 'VDR')}
                {rl('my',  my.gasDiff,  ovl, clr, fG2, 'My')}
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Revenue ($/Boe)" ltmAvg={ltm.avg12.revenuePerBOE} ltm6Avg={ltm.avg6.revenuePerBOE} ltmFmt={fB} detailTable={dt('revenuePerBOE', fB, [
          { key: 'totalRevenue', label: 'Numerator: Revenue', formatter: midUnit.labelFmt },
          { key: 'netBOE', label: 'Denominator: Net BOE', formatter: n => n.toFixed(0) },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={perUnitFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[fB(v),n]}/><Legend {...LP}/>
                <Bar dataKey="revenuePerBOE" name="Revenue/Boe" fill={C.revenue}>
                  <LabelList dataKey="revenuePerBOE" content={topLabel(fB)}/>
                </Bar>
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Operating Margin ($/Boe)" ltmAvg={ltm.avg12.marginPerBOE} ltm6Avg={ltm.avg6.marginPerBOE} ltmFmt={fB} detailTable={dt('marginPerBOE', fB, [
          { key: 'opMargin', label: 'Numerator: Op Margin', formatter: midUnit.labelFmt },
          { key: 'netBOE', label: 'Denominator: Net BOE', formatter: n => n.toFixed(0) },
        ])}>
          {(yDomain, ovl, clr) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CM}>
                <CartesianGrid {...GP}/><XAxis dataKey="label" {...AP}/><YAxis {...AP} tickFormatter={perUnitFmt} domain={yDomain}/>
                <Tooltip {...TP} formatter={(v,n)=>[fB(v),n]}/><Legend {...LP}/>
                <Bar dataKey="marginPerBOE" name="Margin/Boe" fill={C.margin}>
                  <LabelList dataKey="marginPerBOE" content={topLabel(fB)}/>
                </Bar>
                <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

      </div>
    </div>
  )
}

// ─── WELL BY WELL TAB ─────────────────────────────────────────────────────────

function WellMiniChart({ data, typeId, myCase, width, height, yDomain }) {
  const typeDef = WBW_TYPES.find(t => t.id === typeId) || WBW_TYPES[0]
  const my = {
    fixed:   parseFloat(myCase.jpFixedPerWellMonth) || null,
    varOil:  parseFloat(myCase.varOilPerBOE)         || null,
    gpt:     parseFloat(myCase.gptPerMcf)            || null,
    midstream: parseFloat(myCase.midstreamPerMcf)    || null,
    varWater: parseFloat(myCase.varWaterPerBBL)      || null,
    prodTax: parseFloat(myCase.prodTaxPct)            || null,
  }
  const base = { data, width, height, margin: WCM, maxBarSize: 80 }
  const yD   = yDomain
    ? { domain: yDomain }
    : { domain: [dataMin => (dataMin < 0 ? Math.floor(dataMin * 1.45) : 0), dataMax => Math.ceil(dataMax * 1.45)] }
  const ct   = typeDef.chartType

  if (ct === 'boeStackD') {
    const sf = n => n.toFixed(1)
    return <BarChart {...base}><CartesianGrid {...GP}/><XAxis dataKey="monthDisp" {...WAP} interval="preserveStartEnd"/><YAxis {...WAP} {...yD} tickFormatter={sf}/>
      <Tooltip {...TP} formatter={(v,n)=>[fBoed(v)+' Boed',n]}/>
      <Bar dataKey="netOild"    name="Oil" fill={C.oil} stackId="b"><LabelList dataKey="netOild"    content={segLabel(sf)}/></Bar>
      <Bar dataKey="netNGLd"    name="NGL" fill={C.ngl} stackId="b"><LabelList dataKey="netNGLd"    content={segLabel(sf)}/></Bar>
      <Bar dataKey="netGasBOEd" name="Gas" fill={C.gas} stackId="b">
        <LabelList dataKey="netGasBOEd" content={segLabel(sf)}/>
        <LabelList dataKey="netBOEd"    content={topLabel(sf)}/>
      </Bar>
        <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
  }
  if (ct === 'boeStackM') {
    const sf = n => n.toFixed(0)
    return <BarChart {...base}><CartesianGrid {...GP}/><XAxis dataKey="monthDisp" {...WAP} interval="preserveStartEnd"/><YAxis {...WAP} {...yD} tickFormatter={sf}/>
      <Tooltip {...TP} formatter={(v,n)=>[fBoed(v)+' BOE',n]}/>
      <Bar dataKey="oil_vol"   name="Oil" fill={C.oil} stackId="b"><LabelList dataKey="oil_vol"   content={segLabel(sf)}/></Bar>
      <Bar dataKey="ngl_vol"   name="NGL" fill={C.ngl} stackId="b"><LabelList dataKey="ngl_vol"   content={segLabel(sf)}/></Bar>
      <Bar dataKey="netGasBOE" name="Gas" fill={C.gas} stackId="b">
        <LabelList dataKey="netGasBOE" content={segLabel(sf)}/>
        <LabelList dataKey="netBOE"    content={topLabel(sf)}/>
      </Bar>
        <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
  }
  if (ct === 'grossBoeStackD') {
    const sf = n => n.toFixed(1)
    return <BarChart {...base}><CartesianGrid {...GP}/><XAxis dataKey="monthDisp" {...WAP} interval="preserveStartEnd"/><YAxis {...WAP} {...yD} tickFormatter={sf}/>
      <Tooltip {...TP} formatter={(v,n)=>[fBoed(v)+' Boed',n]}/>
      <Bar dataKey="grossOild"    name="Oil" fill={C.oil} stackId="b"><LabelList dataKey="grossOild"    content={segLabel(sf)}/></Bar>
      <Bar dataKey="grossNGLd"    name="NGL" fill={C.ngl} stackId="b"><LabelList dataKey="grossNGLd"    content={segLabel(sf)}/></Bar>
      <Bar dataKey="grossGasBOEd" name="Gas" fill={C.gas} stackId="b">
        <LabelList dataKey="grossGasBOEd" content={segLabel(sf)}/>
        <LabelList dataKey="grossBOEd"    content={topLabel(sf)}/>
      </Bar>
        <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
  }
  if (ct === 'grossBoeStackM') {
    const sf = n => n.toFixed(0)
    return <BarChart {...base}><CartesianGrid {...GP}/><XAxis dataKey="monthDisp" {...WAP} interval="preserveStartEnd"/><YAxis {...WAP} {...yD} tickFormatter={sf}/>
      <Tooltip {...TP} formatter={(v,n)=>[fBoed(v)+' BOE',n]}/>
      <Bar dataKey="gross_oil" name="Oil" fill={C.oil} stackId="b"><LabelList dataKey="gross_oil" content={segLabel(sf)}/></Bar>
      <Bar dataKey="gross_ngl" name="NGL" fill={C.ngl} stackId="b"><LabelList dataKey="gross_ngl" content={segLabel(sf)}/></Bar>
      <Bar dataKey="grossGasBOE" name="Gas" fill={C.gas} stackId="b">
        <LabelList dataKey="grossGasBOE" content={segLabel(sf)}/>
        <LabelList dataKey="grossBOE"    content={topLabel(sf)}/>
      </Bar>
        <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
  }
  if (ct === 'costStack') {
    const sf = n => fmtMoneyScaled(n, 1e6, 1)
    return <BarChart {...base}><CartesianGrid {...GP}/><XAxis dataKey="monthDisp" {...WAP} interval="preserveStartEnd"/><YAxis {...WAP} {...yD} tickFormatter={n=>fmtMoneyScaled(n, 1e6, 1)}/>
      <Tooltip {...TP} formatter={(v,n)=>[fMdol(v),n]}/>
      <Bar dataKey="var_oil"    name="Var Oil"      fill={C.varOil}    stackId="c"><LabelList dataKey="var_oil"    content={segLabel(sf)}/></Bar>
      <Bar dataKey="var_water"  name="Water"         fill={C.varWater}  stackId="c"><LabelList dataKey="var_water"  content={segLabel(sf)}/></Bar>
      <Bar dataKey="totalFixed" name="Fixed+Wkover"  fill={C.fixed}     stackId="c"><LabelList dataKey="totalFixed" content={segLabel(sf)}/></Bar>
      <Bar dataKey="gpt"        name="GP&T"          fill={C.gpt}       stackId="c"><LabelList dataKey="gpt"        content={segLabel(sf)}/></Bar>
      <Bar dataKey="prod_taxes" name="Taxes"         fill={C.prodTaxes} stackId="c">
        <LabelList dataKey="prod_taxes" content={segLabel(sf)}/>
        <LabelList dataKey="totalLOS"   content={topLabel(sf)}/>
      </Bar>
        <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
  }

  const { pk, fill } = typeDef
  const isMM  = ['gas_vol','gross_gas','netGasd','grossGasd'].includes(pk)
  const isBoe = ['netOild','netNGLd','grossOild','grossNGLd','oil_vol','ngl_vol','gross_oil','gross_ngl','netBOEd','netBOE','grossBOEd','grossBOE'].includes(pk)
  const isDol = ['var_oil','var_water','fixed','totalFixed','gpt','workover','prod_taxes','prod_tax_oil','prod_tax_gas','prod_tax_ngl','ad_valorem_tax','capex','totalLOS','assetFCF'].includes(pk)
  const isPct = ['prodTaxPct','oilSevTaxPct','gasSevTaxPct','nglSevTaxPct','adValTaxPct'].includes(pk)
  const isRatioPct = pk === 'nglDifferential'
  const isGas = pk === 'realizedGas' || pk === 'actualGasPrice' || pk === 'gasDifferential'
  const isPerWellK = pk === 'fixedPerWell'
  const isPerMcf3 = pk === 'gptPerMcf' || pk === 'midstreamPerMcf'
  const isPerUnit2 = [
    'costPerBOE','varOilPerBOE','varWaterPerBBL','gptPerMcf','revenuePerBOE','marginPerBOE',
    'realizedOil','realizedNGL','actualOilPrice','actualNGLPrice',
    'oilDifferential',
  ].includes(pk)
  const axFmt = isMM  ? n=>n.toFixed(1)
              : isBoe ? n=>n.toFixed(1)
              : isPerWellK ? n=>fmtMoneyScaled(n, 1000, 1)
              : isDol ? n=>fmtMoneyScaled(n, 1e6, 1)
              : isPct ? n=>`${n.toFixed(1)}%`
              : isRatioPct ? n=>`${(n*100).toFixed(1)}%`
              : isPerMcf3 ? n=>fmtMoney(n, 3)
              : isGas ? n=>fmtMoney(n, 2)
              : isPerUnit2 ? n=>fmtMoney(n, 2)
              :         n=>fmtMoney(n, 1)
  const myRef = pk==='varOilPerBOE' && my.varOil  ? <ReferenceLine y={my.varOil}  stroke={C.myCase} strokeDasharray="4 4" strokeWidth={2}/>
              : pk==='gptPerMcf' && my.gpt ? <ReferenceLine y={my.gpt} stroke={C.myCase} strokeDasharray="4 4" strokeWidth={2}/>
              : pk==='midstreamPerMcf' && my.midstream ? <ReferenceLine y={my.midstream} stroke={C.myCase} strokeDasharray="4 4" strokeWidth={2}/>
              : pk==='varWaterPerBBL' && my.varWater ? <ReferenceLine y={my.varWater} stroke={C.myCase} strokeDasharray="4 4" strokeWidth={2}/>
              : pk==='fixedPerWell'  && my.fixed   ? <ReferenceLine y={my.fixed}   stroke={C.myCase} strokeDasharray="4 4" strokeWidth={2}/>
              : pk==='prodTaxPct'   && my.prodTax  ? <ReferenceLine y={my.prodTax} stroke={C.myCase} strokeDasharray="4 4" strokeWidth={2}/>
              : null

  return <BarChart {...base}>
    <CartesianGrid {...GP}/><XAxis dataKey="monthDisp" {...WAP} interval="preserveStartEnd"/><YAxis {...WAP} {...yD} tickFormatter={axFmt}/>
    <Tooltip {...TP} formatter={v=>[typeDef.fmt(v)]}/>
    <Bar dataKey={pk} fill={fill||C.oil}>
      <LabelList dataKey={pk} content={topLabel(axFmt)}/>
    </Bar>
    {myRef}
      <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3"/>
  </BarChart>
}

const WellCard = memo(function WellCard({ well, typeDef, ariesInputs, pctOfTotal, yDomain }) {
  const [showDataTable, setShowDataTable] = useState(false)
  const d    = well.monthlyData
  const avgAll = safeAvg(d, typeDef.pk)
  const last   = d[d.length - 1]
  const lastV  = last ? last[typeDef.pk] : null
  const avg6   = safeAvg(d.slice(-6), typeDef.pk)
  const chg6   = (lastV != null && avg6 != null && avg6 !== 0) ? ((lastV - avg6) / Math.abs(avg6)) * 100 : null
  const detailTable = buildMonthlyChartTable(d, buildWellChartTableConfig(typeDef))

  return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden" style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
      <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-900 truncate" title={well.wellName}>{well.wellName}</div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {well.jpRp  && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-indigo-50 text-indigo-700">{well.jpRp}</span>}
            {well.opObo && <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${well.opObo==='OP' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{well.opObo}</span>}
            <span className="text-[9px] text-gray-400 font-mono">NRI {(well.nri*100).toFixed(1)}% | WI {(well.wi*100).toFixed(1)}%</span>
          </div>
        </div>
        {lastV != null && (
          <div className="text-right flex-shrink-0">
            <div className="text-sm font-bold text-gray-900">{typeDef.fmt(lastV)}</div>
            <div className="text-[9px] text-gray-400">last mo</div>
          </div>
        )}
      </div>

      <div className="px-2 pt-3 pb-1" style={{height:'180px'}}>
        <ResponsiveContainer width="100%" height="100%">
          <WellMiniChart data={d} typeId={typeDef.id} myCase={ariesInputs.myCase} yDomain={yDomain}/>
        </ResponsiveContainer>
      </div>

      {detailTable?.rows?.length > 0 && (
        <div className="px-4 pb-2">
          <button
            onClick={() => setShowDataTable(v => !v)}
            className={`px-2 py-1 rounded border text-[10px] font-semibold transition-colors cursor-pointer ${
              showDataTable
                ? 'bg-[#1F3864] text-white border-[#1F3864]'
                : 'bg-white text-gray-600 border-gray-300 hover:text-gray-900 hover:border-gray-400'
            }`}
          >
            {showDataTable ? 'Hide Chart Data' : 'Show Chart Data'}
          </button>
          {showDataTable && <ChartDataTable table={detailTable} />}
        </div>
      )}

      <div className="px-4 py-2.5 border-t border-gray-100" style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'8px'}}>
        <div>
          <div className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">Avg (all)</div>
          <div className="text-xs text-gray-700 font-mono mt-0.5">{avgAll != null ? typeDef.fmt(avgAll) : '--'}</div>
        </div>
        <div>
          <div className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">6-mo Avg</div>
          <div className="text-xs text-gray-700 font-mono mt-0.5">{avg6 != null ? typeDef.fmt(avg6) : '--'}</div>
        </div>
        <div>
          <div className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">vs. 6-mo</div>
          <div className={`text-xs font-mono mt-0.5 ${chg6==null?'text-gray-400':chg6<0?'text-emerald-600':chg6>0?'text-red-500':'text-gray-500'}`}>
            {chg6 != null ? `${chg6>0?'+':''}${chg6.toFixed(1)}%` : '--'}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">% of Total</div>
          <div className="text-xs text-[#1F3864] font-mono font-bold mt-0.5">
            {pctOfTotal != null ? `${pctOfTotal.toFixed(1)}%` : '--'}
          </div>
        </div>
      </div>
    </div>
  )
})

function WbwSelector({ typeId, setTypeId }) {
  return (
    <div className="bg-white border border-gray-200 rounded p-3 space-y-2" style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
      {WBW_GROUPS.map(grp => {
        const types = WBW_TYPES.filter(t => t.group === grp)
        return (
          <div key={grp} className="flex flex-wrap items-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mr-1 w-28 flex-shrink-0">{grp}</span>
            {types.map(t => (
              <button key={t.id} onClick={() => setTypeId(t.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer
                  ${typeId===t.id ? 'bg-[#1F3864] text-white' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:border-[#1F3864] hover:text-[#1F3864]'}`}>
                {t.label}
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function getLastMonthVal(well, key) {
  const d = well.monthlyData
  if (!d || !d.length) return null
  const last = d[d.length - 1]
  return last ? (last[key] || 0) : 0
}

function WellByWellTab({ wellData, ariesInputs, typeId, setTypeId, sortId, setSortId }) {
  const [search,     setSearch]     = useState('')
  const [sharedAxis, setSharedAxis] = useState(false)
  const typeDef = WBW_TYPES.find(t => t.id === typeId) || WBW_TYPES[0]

  const sorted = useMemo(() => {
    let arr = [...wellData]
    if (sortId === 'oilVol')   arr.sort((a, b) => getLastMonthVal(b,'netOild') - getLastMonthVal(a,'netOild'))
    if (sortId === 'gasVol')   arr.sort((a, b) => getLastMonthVal(b,'netGasd') - getLastMonthVal(a,'netGasd'))
    if (sortId === 'totalVol') arr.sort((a, b) => getLastMonthVal(b,'netBOEd') - getLastMonthVal(a,'netBOEd'))
    return arr
  }, [wellData, sortId])

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted
    const q = search.toLowerCase()
    return sorted.filter(w => w.wellName.toLowerCase().includes(q))
  }, [sorted, search])

  const sortKey = sortId === 'oilVol' ? 'netOild' : sortId === 'gasVol' ? 'netGasd' : 'netBOEd'
  const totalLastMonth = useMemo(() =>
    wellData.reduce((s, w) => s + (getLastMonthVal(w, sortKey) || 0), 0),
  [wellData, sortKey])

  const sharedYDomain = useMemo(() => {
    if (!sharedAxis) return null
    let min = 0
    let max = 0
    filtered.forEach(w => {
      w.monthlyData.forEach(m => {
        const v = m[typeDef.pk]
        if (v != null && isFinite(v)) {
          min = Math.min(min, v)
          max = Math.max(max, v)
        }
      })
    })
    if (min === 0 && max === 0) return null
    if (min >= 0) return [0, max * 1.45]
    if (max <= 0) return [min * 1.45, 0]
    const pad = Math.max(Math.abs(min), Math.abs(max)) * 1.45
    return [-pad, pad]
  }, [sharedAxis, filtered, typeDef.pk])

  if (!wellData || !wellData.length) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">No data loaded -- upload a CSV file to view well cards.</div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Well by Well Charts</h2>
          <p className="text-xs text-gray-500 mt-1">{wellData.length} wells | {typeDef.tableLabel}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search wells..."
            className="pl-3 pr-3 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-900 placeholder-gray-400 outline-none focus:border-gray-500 w-40"/>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-semibold">Sort:</label>
            <select value={sortId} onChange={e => setSortId(e.target.value)}
              className="px-3 py-1.5 bg-white border-2 border-[#1F3864] rounded text-xs text-[#1F3864] font-bold outline-none cursor-pointer">
              {SORT_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 font-semibold">Shared Axis:</span>
            <button onClick={() => setSharedAxis(!sharedAxis)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer
                ${sharedAxis ? 'bg-[#1F3864]' : 'bg-gray-300'}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform
                ${sharedAxis ? 'translate-x-4.5' : 'translate-x-0.5'}`}/>
            </button>
            <span className="text-[10px] text-gray-400">{sharedAxis ? 'On' : 'Off'}</span>
          </div>
        </div>
      </div>

      <WbwSelector typeId={typeId} setTypeId={setTypeId}/>

      {search && <p className="text-xs text-gray-500">Showing {filtered.length} of {wellData.length} wells</p>}

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px'}}>
        {filtered.map(w => {
          const lastV = getLastMonthVal(w, sortKey)
          const pct   = (totalLastMonth > 0 && lastV != null) ? (lastV / totalLastMonth) * 100 : null
          return <WellCard key={w.wellName} well={w} typeDef={typeDef} ariesInputs={ariesInputs} pctOfTotal={pct} yDomain={sharedYDomain}/>
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">No wells match "{search}"</div>
      )}
    </div>
  )
}

// ─── UPLOAD ZONE ──────────────────────────────────────────────────────────────

function UploadZone({ onFile, compact }) {
  const [drag, setDrag] = useState(false)
  const onDrop = e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f) }
  const onPick = e => { if (e.target.files[0]) onFile(e.target.files[0]) }

  if (compact) {
    return (
      <label onDrop={onDrop} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded border border-dashed text-xs cursor-pointer transition-colors
          ${drag ? 'border-blue-500 text-blue-600' : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700'}`}>
        <input type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={onPick}/>
        Reload CSV
      </label>
    )
  }

  return (
    <label onDrop={onDrop} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)}
      className={`block border-2 border-dashed rounded p-16 text-center cursor-pointer transition-colors
        ${drag ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-white'}`}>
      <input type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={onPick}/>
      <div className="flex flex-col items-center gap-4">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-gray-400">
          <rect x="8" y="6" width="32" height="36" rx="4" stroke="currentColor" strokeWidth="2"/>
          <path d="M16 18h16M16 26h16M16 34h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="36" cy="36" r="10" fill="white" stroke="currentColor" strokeWidth="2"/>
          <path d="M36 30v12M31 35l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div>
          <p className="text-sm text-gray-700 font-semibold">
            Drop <code className="text-gray-900 bg-gray-100 px-1 rounded">los_data.csv</code> here or click to browse
          </p>
          <p className="text-xs text-gray-400 mt-1">Tab or comma delimited | Service End Date format M/D/YY or M/D/YYYY (example: 1/31/24)</p>
        </div>
        <div className="text-[10px] text-gray-500 bg-gray-50 border border-gray-200 rounded px-4 py-2 leading-relaxed max-w-lg text-center">
          Required columns: Well Name | Service End Date | LOS CATEGORY | Net Volume | Net Amount
        </div>
      </div>
    </label>
  )
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────

function warningDetails(warningText) {
  const rowCount = (warningText.match(/^(\d+)\s+row\(s\)/i) || [null, null])[1]
  const rowsLabel = rowCount ? `${rowCount} row(s)` : 'Some rows'

  if (/invalid Service End Date/i.test(warningText)) {
    return {
      summary: warningText,
      impact: `${rowsLabel} were skipped and are not included in rollups/charts/tables.`,
      fix: 'Fix "Service End Date" to a valid calendar date using M/D/YY, M/DD/YY, M/D/YYYY, or M/DD/YYYY (for example: 1/31/24 or 1/31/2024).',
    }
  }

  if (/non-numeric Net Amount/i.test(warningText)) {
    return {
      summary: warningText,
      impact: `${rowsLabel} had Net Amount forced to 0, which can understate or overstate revenue/cost totals.`,
      fix: 'Replace text placeholders (for example: N/A, -, blank text) with numeric values in "Net Amount".',
    }
  }

  if (/non-numeric Net Volume/i.test(warningText)) {
    return {
      summary: warningText,
      impact: `${rowsLabel} had Net Volume forced to 0, which can distort production and BOE metrics.`,
      fix: 'Replace text placeholders with numeric values in "Net Volume".',
    }
  }

  if (/no bucket mapping|excluded from rollups/i.test(warningText)) {
    return {
      summary: warningText,
      impact: 'Those rows are excluded from LOS bucket rollups and related charts.',
      fix: 'Map the LOS/Cost Category labels to known values (or add the mapping in constants/losMapping.js).',
    }
  }

  return { summary: warningText, impact: '', fix: '' }
}

function warningIssueTypes(warningText) {
  if (/invalid Service End Date/i.test(warningText)) return ['invalid_service_end_date']
  if (/non-numeric Net Amount/i.test(warningText)) return ['non_numeric_net_amount']
  if (/non-numeric Net Volume/i.test(warningText)) return ['non_numeric_net_volume']
  if (/no bucket mapping|excluded from rollups/i.test(warningText)) return ['unmapped_los_or_cost_category']
  return []
}

function toRowRanges(rowNumbers) {
  if (!rowNumbers.length) return []
  const ranges = []
  let start = rowNumbers[0]
  let prev = rowNumbers[0]

  for (let i = 1; i < rowNumbers.length; i++) {
    const n = rowNumbers[i]
    if (n === prev + 1) {
      prev = n
      continue
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`)
    start = n
    prev = n
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`)
  return ranges
}

function warningRowRangeText(warningText, issues) {
  const types = warningIssueTypes(warningText)
  if (!types.length) return ''

  const rows = [...new Set(
    (issues || [])
      .filter(i => types.includes(i.issueType) && Number.isInteger(i.rowNumber))
      .map(i => i.rowNumber)
  )].sort((a, b) => a - b)
  if (!rows.length) return ''

  const ranges = toRowRanges(rows)
  const preview = ranges.slice(0, 6).join(', ')
  const extra = ranges.length > 6 ? ` (+${ranges.length - 6} more range${ranges.length - 6 === 1 ? '' : 's'})` : ''
  return `${preview}${extra} (${rows.length} row${rows.length === 1 ? '' : 's'})`
}

function App() {
  const [tab,        setTab]       = useState('inputs')
  const [rows,       setRows]      = useState(null)
  const [loading,    setLoading]   = useState(false)
  const [error,      setError]     = useState(null)
  const [warnings,   setWarnings]  = useState([])
  const [dataIssues, setDataIssues] = useState([])
  const [fname,      setFname]     = useState(null)
  const [opFilter,   setOpFilter]  = useState('all')
  const [liftFilter, setLiftFilter]= useState([])
  const [inputs,     setInputs]    = useState(INITIAL_ARIES_INPUTS)
  const [wbwTypeId,  setWbwTypeId] = useState('netBOEd')
  const [wbwSortId,  setWbwSortId] = useState('default')
  const [pricingRows, setPricingRows] = useState([])
  const [pricingWarnings, setPricingWarnings] = useState([])
  const [pricingError, setPricingError] = useState(null)
  const [pricingFilename, setPricingFilename] = useState('')
  const [volumeRows, setVolumeRows] = useState([])
  const [volumeWarnings, setVolumeWarnings] = useState([])
  const [volumeError, setVolumeError] = useState(null)
  const [volumeFilename, setVolumeFilename] = useState('')

  const processText = useCallback((text, name) => {
    setLoading(true); setError(null); setWarnings([]); setDataIssues([])
    setTimeout(() => {
      try {
        const { rows: r, warnings: w, issues: q } = parseCSVText(text)
        setRows(r); setFname(name || 'data.csv'); setError(null); setWarnings(w || []); setDataIssues(q || [])
      } catch (e) { setError(e.message) }
      finally { setLoading(false) }
    }, 50)
  }, [])

  const processFile = useCallback(file => {
    const r = new FileReader()
    r.onload  = e => processText(e.target.result, file.name)
    r.onerror = () => { setError('Failed to read file.'); setLoading(false) }
    r.readAsText(file)
  }, [processText])

  const filteredRows = useMemo(
    () => filterRows(rows, opFilter, liftFilter),
    [rows, opFilter, liftFilter]
  )

  const baseRollup   = useMemo(() => filteredRows ? buildMonthlyRollup(filteredRows) : [], [filteredRows])
  const baseWellData = useMemo(() => filteredRows ? buildWellData(filteredRows)      : [], [filteredRows])
  const pricedData = useMemo(
    () => attachPricingDifferentials(baseRollup, baseWellData, pricingRows),
    [baseRollup, baseWellData, pricingRows]
  )
  const { monthlyRollup: rollup, wellData, warnings: volumeMatchWarnings, histGrossWaterByMonth } = useMemo(
    () => attachHistoricalVolumes(pricedData.monthlyRollup, pricedData.wellData, volumeRows, opFilter),
    [pricedData, volumeRows, opFilter]
  )

  const activeInputs = useMemo(
    () => selectActiveInputs(inputs, opFilter),
    [inputs, opFilter]
  )

  const inputChartRollups = useMemo(() => {
    if (!rows) return { op: [], obo: [] }

    const buildSliceRollup = slice => {
      const sliceRows = filterRows(rows, slice, liftFilter)
      const sliceBaseRollup = buildMonthlyRollup(sliceRows)
      const sliceBaseWellData = buildWellData(sliceRows)
      const priced = attachPricingDifferentials(sliceBaseRollup, sliceBaseWellData, pricingRows)
      return attachHistoricalVolumes(priced.monthlyRollup, priced.wellData, volumeRows, slice).monthlyRollup
    }

    return {
      op: buildSliceRollup('op'),
      obo: buildSliceRollup('obo'),
    }
  }, [rows, liftFilter, pricingRows, volumeRows])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      <header className="border-b border-gray-200 sticky top-0 z-20"
        style={{backgroundColor:'rgba(255,255,255,0.97)', backdropFilter:'blur(8px)'}}>
        <div className="max-w-[1440px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div>
              <h1 className="text-base font-bold tracking-tight text-gray-900 leading-tight">E&amp;P LOS Dashboard</h1>
              <p className="text-[10px] text-gray-500 leading-tight">PE Due Diligence | Lease Operating Statement Analysis</p>
            </div>
            {rows && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-emerald-500"/>
                <span className="text-xs text-gray-600 truncate">{fname}</span>
                <span className="text-xs text-gray-400">
                  {(filteredRows||rows).length.toLocaleString()} rows | {wellData.length} wells | {rollup.length} months
                  {opFilter !== 'all' && <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{background:'#1F3864', color:'white'}}>{opFilter === 'op' ? 'Operated' : 'Non-Op'}</span>}
                  {liftFilter.map(f => <span key={f} className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{background:'#C55A11', color:'white'}}>{f === 'jp' ? 'JP' : f === 'rp' ? 'RP' : 'Other'}</span>)}
                </span>
              </div>
            )}
          </div>
          <UploadZone onFile={processFile} compact/>
        </div>
      </header>

      <nav className="border-b border-gray-200 bg-white">
        <div className="max-w-[1440px] mx-auto px-6 flex items-center justify-between">
          <div className="flex">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer
                  ${tab===t.id ? 'border-[#1F3864] text-[#1F3864]' : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'}`}>
                {t.label}
              </button>
            ))}
          </div>
          {rows && (
            <div className="flex flex-col items-end gap-1.5 my-1.5 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider w-7 text-right">Op</span>
                <div style={{display:'flex', borderRadius:'4px', overflow:'hidden', border:'1px solid #E5E7EB'}}>
                  {[{id:'all',label:'Total'},{id:'op',label:'Operated'},{id:'obo',label:'Non-Op'}].map((o, oi) => (
                    <button key={o.id} onClick={() => setOpFilter(o.id)}
                      style={{
                        padding:'4px 11px', fontSize:'11px', fontWeight:700, cursor:'pointer', border:'none',
                        borderRight: oi < 2 ? '1px solid #E5E7EB' : 'none',
                        background: opFilter===o.id ? '#1F3864' : 'white',
                        color:      opFilter===o.id ? 'white'   : '#6B7280',
                        transition: 'all 0.15s',
                      }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider w-7 text-right">Lift</span>
                <div style={{display:'flex', borderRadius:'4px', overflow:'hidden', border:'1px solid #E5E7EB'}}>
                  {[{id:'jp',label:'JP'},{id:'rp',label:'RP'},{id:'other',label:'Other'}].map((o, oi) => (
                    <button key={o.id}
                      onClick={() => setLiftFilter(prev => prev.includes(o.id) ? prev.filter(x => x !== o.id) : [...prev, o.id])}
                      style={{
                        padding:'4px 11px', fontSize:'11px', fontWeight:700, cursor:'pointer', border:'none',
                        borderRight: oi < 2 ? '1px solid #E5E7EB' : 'none',
                        background: liftFilter.includes(o.id) ? '#C55A11' : 'white',
                        color:      liftFilter.includes(o.id) ? 'white'   : '#6B7280',
                        transition: 'all 0.15s',
                      }}>
                      {o.label}
                    </button>
                  ))}
                </div>
                {liftFilter.length > 0 && (
                  <button onClick={() => setLiftFilter([])}
                    style={{fontSize:'10px', color:'#9CA3AF', cursor:'pointer', background:'none', border:'none', textDecoration:'underline', padding:'0 2px'}}>
                    clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-[1440px] mx-auto px-6 py-6">

        {loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-2 border-gray-200"/>
              <div className="absolute inset-0 rounded-full border-2 border-t-[#1F3864] spinner"/>
            </div>
            <p className="text-sm text-gray-500">Parsing LOS data...</p>
          </div>
        )}

        {!loading && error && (
          <div className="mb-6 max-w-2xl space-y-4">
            <div className="bg-red-50 border border-red-200 rounded p-5">
              <p className="text-red-700 text-sm font-bold">Parse Error</p>
              <p className="text-red-600 text-xs mt-1 leading-relaxed">{error}</p>
              <p className="text-gray-500 text-xs mt-2">Ensure the first row is a header with columns like &quot;Well Name&quot;, &quot;Service End Date&quot;, &quot;LOS CATEGORY&quot;, &quot;Net Amount&quot;. Dates: M/DD/YY or M/DD/YYYY. Save as tab- or comma-delimited CSV.</p>
            </div>
            <UploadZone onFile={processFile}/>
          </div>
        )}

        {!loading && !error && !rows && tab !== 'historicalpricing' && <UploadZone onFile={processFile}/>}

        {!loading && rows && warnings.length > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded p-4 space-y-2">
            <p className="text-amber-800 text-xs font-bold uppercase tracking-wide">Data Quality Warnings</p>
            <p className="text-amber-700 text-xs">
              Some rows loaded with issues. Review each warning below for exact impact and fix steps.
            </p>
            {dataIssues.length > 0 && (
              <div className="pt-1">
                <button
                  onClick={() => exportDataQualityReport(dataIssues, fname || 'los_data.csv')}
                  className="px-3 py-1.5 bg-white border border-amber-300 rounded text-xs text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer font-semibold"
                >
                  Download bad rows report (CSV)
                </button>
              </div>
            )}
            {warnings.map((w, i) => {
              const detail = warningDetails(w)
              const rowRangeText = warningRowRangeText(w, dataIssues)
              return (
                <div key={i} className="bg-amber-100/60 border border-amber-200 rounded px-3 py-2">
                  <p className="text-amber-800 text-xs font-medium">{detail.summary}</p>
                  {rowRangeText && (
                    <p className="text-amber-800/90 text-xs mt-1"><span className="font-semibold">Rows affected:</span> {rowRangeText}</p>
                  )}
                  {detail.impact && (
                    <p className="text-amber-800/90 text-xs mt-1"><span className="font-semibold">Impact:</span> {detail.impact}</p>
                  )}
                  {detail.fix && (
                    <p className="text-amber-800/90 text-xs mt-1"><span className="font-semibold">How to fix:</span> {detail.fix}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {!loading && (
          <>
            {rows && tab==='inputs'          && <InputsTab          ariesInputs={inputs} setAriesInputs={setInputs} monthlyRollup={rollup}/>}
            {rows && tab==='inputcharts'     && <InputChartsTab     rollupsBySlice={inputChartRollups} ariesInputs={inputs} defaultSlice={opFilter === 'obo' ? 'obo' : 'op'} />}
            {rows && tab==='rollup'          && <RollupTab          monthlyRollup={rollup} ariesInputs={activeInputs} wellData={wellData}/>}
            {rows && tab==='wellbywell'      && <WellByWellTab      wellData={wellData} ariesInputs={activeInputs}
                                          typeId={wbwTypeId} setTypeId={setWbwTypeId}
                                          sortId={wbwSortId} setSortId={setWbwSortId}/>}
            {rows && tab==='wellbywelltable' && <LOSTableTab        rawRows={filteredRows || []} wellData={wellData}/>}
            {tab==='historicalpricing' && (
              <HistoricalPricingTab
                pricingRows={pricingRows}
                setPricingRows={setPricingRows}
                pricingWarnings={pricingWarnings}
                setPricingWarnings={setPricingWarnings}
                pricingError={pricingError}
                setPricingError={setPricingError}
                pricingFilename={pricingFilename}
                setPricingFilename={setPricingFilename}
                volumeRows={volumeRows}
                setVolumeRows={setVolumeRows}
                volumeWarnings={volumeWarnings}
                setVolumeWarnings={setVolumeWarnings}
                volumeError={volumeError}
                setVolumeError={setVolumeError}
                volumeFilename={volumeFilename}
                setVolumeFilename={setVolumeFilename}
                volumeMatchWarnings={volumeMatchWarnings}
                histGrossWaterByMonth={histGrossWaterByMonth}
              />
            )}
          </>
        )}

      </main>
    </div>
  )
}

export default App



