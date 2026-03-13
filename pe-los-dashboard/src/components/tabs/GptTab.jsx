import React, { useMemo, useState, useCallback } from 'react'
import { parseMidstreamGptCSVWithMapping } from '../../ingest/parseMidstreamGptCsv.js'
import { buildGptRollup } from '../../selectors/buildGptRollup.js'
import { NGL_COMPONENTS } from '../../constants/gptConfig.js'
import { fP, fG } from '../../utils/formatters.js'
import { DataSourceMapper } from '../DataSourceMapper.jsx'
import { UploadZone } from '../shared/UploadZone.jsx'

function fmtYield(v) {
  return v == null || !isFinite(v) ? '--' : Number(v).toFixed(0)
}

function fmtBtu(v) {
  return v == null || !isFinite(v) ? '--' : Number(v).toFixed(3)
}

function fmtPct(v) {
  return v == null || !isFinite(v) ? '--' : `${Number(v).toFixed(2)}%`
}

// Check if any row in the series has component data
function hasNglComponentData(rows) {
  return rows.some(r => r.nglComponents && Object.values(r.nglComponents).some(c => c != null))
}

function meanLast(rows, windowSize, accessor) {
  const values = (rows || [])
    .slice(-windowSize)
    .map(accessor)
    .filter(v => v != null && isFinite(v))
  if (!values.length) return null
  return values.reduce((sum, value) => sum + Number(value), 0) / values.length
}

function pickHistoricalGasPrice(pricingRow) {
  if (!pricingRow) return null
  if (pricingRow.hsc != null && isFinite(pricingRow.hsc)) return Number(pricingRow.hsc)
  if (pricingRow.henryHub != null && isFinite(pricingRow.henryHub)) return Number(pricingRow.henryHub)
  return null
}

function MetricTable({ title, rows }) {
  const showCompYield       = rows.some(r => r.nglYieldFromComponents != null)
  const showGptResidueGas   = rows.some(r => r.gptPerMcfResidueGas != null)
  const showResidueBtuFactor = rows.some(r => r.residueBtuFactor != null)
  const showResidueRealized = rows.some(r => r.residueGasRealizedPrice != null)
  const showImpliedDiff     = rows.some(r => r.gptImpliedGasDiff != null)

  const th = 'px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap'
  const td = 'px-3 py-2 text-right text-gray-900 font-mono'
  const avgCell = (windowSize, accessor, formatter) => formatter(meanLast(rows, windowSize, accessor))

  return (
    <div className="bg-white border border-gray-200 rounded overflow-x-auto">
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      <table className="min-w-full text-xs">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Date</th>
            <th className={th}>NGL Yield (BBL/MMcf){showCompYield && <span className="ml-1 text-gray-400 font-normal">[comp]</span>}</th>
            <th className={th}>Gas Shrink (%)</th>
            <th className={th}>
              BTU Factor (Inlet)
              <span className="ml-1 text-gray-400 font-normal text-[10px]" title="Wet-gas inlet BTU factor = Inlet MMBtu ÷ Inlet Mcf. Includes NGL heat content.">derived</span>
            </th>
            {showResidueBtuFactor && (
              <th className={th}>
                BTU Factor (Residue)
                <span className="ml-1 text-gray-400 font-normal text-[10px]" title="Dry-gas residue BTU factor = Post-POP Residue MMBtu ÷ Post-POP Residue Mcf. Excludes NGL heat content.">derived</span>
              </th>
            )}
            {showResidueRealized && <th className={th}>Residue Gas Realized ($/Mcf)</th>}
            {showImpliedDiff && <th className={th}>Implied Diff vs Hist Gas ($/Mcf)</th>}
            <th className={th}>NGL Price (% WTI)</th>
            <th className={th}>GPT $/Mcf (Inlet)</th>
            {showGptResidueGas  && <th className={th}>G&amp;T $/Mcf (Residue)</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const yld = showCompYield ? (row.nglYieldFromComponents ?? row.nglYield) : row.nglYield
            return (
              <tr key={`${row.monthKey}-${idx}`} className={idx % 2 ? 'bg-white' : 'bg-gray-50/40'}>
                <td className="px-3 py-2 text-gray-700">{row.monthDisp}</td>
                <td className={td}>{fmtYield(yld)}</td>
                <td className={td}>{fmtPct(row.gasShrinkPct)}</td>
                <td className={td}>{fmtBtu(row.btuFactor)}</td>
                {showResidueBtuFactor && <td className={td}>{fmtBtu(row.residueBtuFactor)}</td>}
                {showResidueRealized && <td className={td}>{fG(row.residueGasRealizedPrice)}</td>}
                {showImpliedDiff && <td className={td}>{fG(row.gptImpliedGasDiff)}</td>}
                <td className={td}>{fP(row.nglPricePctWti)}</td>
                <td className={td}>{fG(row.gptCostPerMcf)}</td>
                {showGptResidueGas  && <td className={td}>{fG(row.gptPerMcfResidueGas)}</td>}
              </tr>
            )
          })}
          <tr className="bg-[#1F3864]/5 border-t border-[#1F3864]/20">
            <td className="px-3 py-2 text-[#1F3864] font-semibold">L6M Avg</td>
            <td className={td}>{avgCell(6, row => showCompYield ? (row.nglYieldFromComponents ?? row.nglYield) : row.nglYield, fmtYield)}</td>
            <td className={td}>{avgCell(6, row => row.gasShrinkPct, fmtPct)}</td>
            <td className={td}>{avgCell(6, row => row.btuFactor, fmtBtu)}</td>
            {showResidueBtuFactor && <td className={td}>{avgCell(6, row => row.residueBtuFactor, fmtBtu)}</td>}
            {showResidueRealized && <td className={td}>{avgCell(6, row => row.residueGasRealizedPrice, fG)}</td>}
            {showImpliedDiff && <td className={td}>{avgCell(6, row => row.gptImpliedGasDiff, fG)}</td>}
            <td className={td}>{avgCell(6, row => row.nglPricePctWti, fP)}</td>
            <td className={td}>{avgCell(6, row => row.gptCostPerMcf, fG)}</td>
            {showGptResidueGas && <td className={td}>{avgCell(6, row => row.gptPerMcfResidueGas, fG)}</td>}
          </tr>
          <tr className="bg-[#1F3864]/5">
            <td className="px-3 py-2 text-[#1F3864] font-semibold">LTM Avg</td>
            <td className={td}>{avgCell(12, row => showCompYield ? (row.nglYieldFromComponents ?? row.nglYield) : row.nglYield, fmtYield)}</td>
            <td className={td}>{avgCell(12, row => row.gasShrinkPct, fmtPct)}</td>
            <td className={td}>{avgCell(12, row => row.btuFactor, fmtBtu)}</td>
            {showResidueBtuFactor && <td className={td}>{avgCell(12, row => row.residueBtuFactor, fmtBtu)}</td>}
            {showResidueRealized && <td className={td}>{avgCell(12, row => row.residueGasRealizedPrice, fG)}</td>}
            {showImpliedDiff && <td className={td}>{avgCell(12, row => row.gptImpliedGasDiff, fG)}</td>}
            <td className={td}>{avgCell(12, row => row.nglPricePctWti, fP)}</td>
            <td className={td}>{avgCell(12, row => row.gptCostPerMcf, fG)}</td>
            {showGptResidueGas && <td className={td}>{avgCell(12, row => row.gptPerMcfResidueGas, fG)}</td>}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function fmt$(v) {
  if (v == null || !isFinite(v)) return '--'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
}

function fmtGal(v) {
  if (v == null || !isFinite(v)) return '--'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v)
}

// NGL Volume Build table — shows component waterfall per month (totalRollup only)
function NglBuildTable({ rows }) {
  // Only show months where at least one component has data
  const activeRows = rows.filter(r => r.nglComponents && Object.values(r.nglComponents).some(c => c != null))
  if (!activeRows.length) return null

  // Which components have any data across all rows?
  const activeComps = NGL_COMPONENTS.filter(comp =>
    activeRows.some(r => r.nglComponents?.[comp.id] != null)
  )
  if (!activeComps.length) return null

  return (
    <div className="bg-white border border-gray-200 rounded overflow-x-auto">
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
        <h3 className="text-sm font-semibold text-gray-800">NGL Volume Build — Component Detail</h3>
        <span className="text-xs text-gray-500">Theoretical → Recovery → POP Contract → After-POP (BBL)</span>
      </div>
      <table className="min-w-full text-xs">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-600 sticky left-0 bg-gray-50">Component</th>
            {activeRows.map(r => (
              <th key={r.monthKey} className="px-2 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">{r.monthDisp}</th>
            ))}
            <th className="px-2 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">L6M Avg</th>
            <th className="px-2 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">LTM Avg</th>
          </tr>
        </thead>
        <tbody>
          {activeComps.map((comp, ci) => {
            const bg = ci % 2 ? 'bg-white' : 'bg-gray-50/40'
            return (
              <React.Fragment key={comp.id}>
                {/* Theoretical Gallons */}
                <tr className={bg}>
                  <td className="px-3 py-1 text-gray-700 font-medium sticky left-0 bg-inherit whitespace-nowrap">
                    {comp.label} <span className="text-gray-400">({comp.abbr})</span>
                    <span className="ml-2 text-gray-400 font-normal">Theoretical Gal</span>
                  </td>
                  {activeRows.map(r => (
                    <td key={r.monthKey} className="px-2 py-1 text-right text-gray-600 font-mono">
                      {fmtGal(r.nglComponents?.[comp.id]?.theoreticalGal)}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right text-gray-600 font-mono">{fmtGal(meanLast(activeRows, 6, r => r.nglComponents?.[comp.id]?.theoreticalGal))}</td>
                  <td className="px-2 py-1 text-right text-gray-600 font-mono">{fmtGal(meanLast(activeRows, 12, r => r.nglComponents?.[comp.id]?.theoreticalGal))}</td>
                </tr>
                {/* Recovery % */}
                <tr className={bg}>
                  <td className="px-3 py-1 text-gray-500 sticky left-0 bg-inherit pl-6 whitespace-nowrap">
                    Recovery %
                  </td>
                  {activeRows.map(r => (
                    <td key={r.monthKey} className="px-2 py-1 text-right text-gray-600 font-mono">
                      {fmtPct(r.nglComponents?.[comp.id]?.recoveryPct)}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right text-gray-600 font-mono">{fmtPct(meanLast(activeRows, 6, r => r.nglComponents?.[comp.id]?.recoveryPct))}</td>
                  <td className="px-2 py-1 text-right text-gray-600 font-mono">{fmtPct(meanLast(activeRows, 12, r => r.nglComponents?.[comp.id]?.recoveryPct))}</td>
                </tr>
                {/* Allocated Gal */}
                <tr className={bg}>
                  <td className="px-3 py-1 text-gray-500 sticky left-0 bg-inherit pl-6 whitespace-nowrap">
                    Allocated Gal
                  </td>
                  {activeRows.map(r => (
                    <td key={r.monthKey} className="px-2 py-1 text-right text-gray-600 font-mono">
                      {fmtGal(r.nglComponents?.[comp.id]?.allocatedGal)}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right text-gray-600 font-mono">{fmtGal(meanLast(activeRows, 6, r => r.nglComponents?.[comp.id]?.allocatedGal))}</td>
                  <td className="px-2 py-1 text-right text-gray-600 font-mono">{fmtGal(meanLast(activeRows, 12, r => r.nglComponents?.[comp.id]?.allocatedGal))}</td>
                </tr>
                {/* After-POP BBL (bolded — the final marketable volume) */}
                <tr className={`${bg} border-b border-gray-200`}>
                  <td className="px-3 py-1 text-gray-800 font-semibold sticky left-0 bg-inherit pl-6 whitespace-nowrap">
                    After-POP BBL
                  </td>
                  {activeRows.map(r => (
                    <td key={r.monthKey} className="px-2 py-1 text-right text-gray-900 font-mono font-semibold">
                      {r.nglComponents?.[comp.id]?.popBbl != null
                        ? Number(r.nglComponents[comp.id].popBbl).toFixed(0)
                        : '--'}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right text-gray-900 font-mono font-semibold">{fmtYield(meanLast(activeRows, 6, r => r.nglComponents?.[comp.id]?.popBbl))}</td>
                  <td className="px-2 py-1 text-right text-gray-900 font-mono font-semibold">{fmtYield(meanLast(activeRows, 12, r => r.nglComponents?.[comp.id]?.popBbl))}</td>
                </tr>
              </React.Fragment>
            )
          })}
          {/* Total NGL row */}
          <tr className="bg-[#1F3864]/5 border-t-2 border-[#1F3864]/20">
            <td className="px-3 py-2 text-[#1F3864] font-bold sticky left-0 bg-[#1F3864]/5 whitespace-nowrap">
              Total NGL (BBL)
            </td>
            {activeRows.map(r => (
              <td key={r.monthKey} className="px-2 py-2 text-right text-[#1F3864] font-bold font-mono">
                {r.nglTotalBbl != null ? Number(r.nglTotalBbl).toFixed(0) : '--'}
              </td>
            ))}
            <td className="px-2 py-2 text-right text-[#1F3864] font-bold font-mono">{fmtYield(meanLast(activeRows, 6, r => r.nglTotalBbl))}</td>
            <td className="px-2 py-2 text-right text-[#1F3864] font-bold font-mono">{fmtYield(meanLast(activeRows, 12, r => r.nglTotalBbl))}</td>
          </tr>
          {/* NGL Yield row */}
          <tr className="bg-[#1F3864]/5">
            <td className="px-3 py-1 text-[#1F3864] font-semibold sticky left-0 bg-[#1F3864]/5 whitespace-nowrap text-xs">
              NGL Yield (BBL/MMcf)
            </td>
            {activeRows.map(r => (
              <td key={r.monthKey} className="px-2 py-1 text-right text-[#1F3864] font-semibold font-mono text-xs">
                {fmtYield(r.nglYieldFromComponents ?? r.nglYield)}
              </td>
            ))}
            <td className="px-2 py-1 text-right text-[#1F3864] font-semibold font-mono text-xs">{fmtYield(meanLast(activeRows, 6, r => r.nglYieldFromComponents ?? r.nglYield))}</td>
            <td className="px-2 py-1 text-right text-[#1F3864] font-semibold font-mono text-xs">{fmtYield(meanLast(activeRows, 12, r => r.nglYieldFromComponents ?? r.nglYield))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// NGL Composition table — gal/Mcf and % of stream by component over time
function NglCompositionTable({ rows }) {
  const activeRows = rows.filter(r => r.nglComponents && Object.values(r.nglComponents).some(c => c != null))
  if (!activeRows.length) return null

  const activeComps = NGL_COMPONENTS.filter(comp =>
    activeRows.some(r => r.nglComponents?.[comp.id] != null)
  )
  if (!activeComps.length) return null

  return (
    <div className="bg-white border border-gray-200 rounded overflow-x-auto">
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-800">NGL Stream Composition</h3>
        <p className="text-xs text-gray-500 mt-0.5">Gal/Mcf of inlet gas and % share of total NGL stream by component</p>
      </div>
      <table className="min-w-full text-xs">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-600 sticky left-0 bg-gray-50">Component</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-500 w-16">Metric</th>
            {activeRows.map(r => (
              <th key={r.monthKey} className="px-2 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">{r.monthDisp}</th>
            ))}
            <th className="px-2 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">L6M Avg</th>
            <th className="px-2 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">LTM Avg</th>
          </tr>
        </thead>
        <tbody>
          {activeComps.map((comp, ci) => {
            const bg = ci % 2 ? 'bg-white' : 'bg-gray-50/40'
            return (
              <React.Fragment key={comp.id}>
                <tr className={bg}>
                  <td className="px-3 py-1 text-gray-700 font-medium sticky left-0 bg-inherit whitespace-nowrap" rowSpan={2}>
                    {comp.label} ({comp.abbr})
                  </td>
                  <td className="px-2 py-1 text-gray-500 whitespace-nowrap">Gal/Mcf</td>
                  {activeRows.map(r => (
                    <td key={r.monthKey} className="px-2 py-1 text-right text-gray-800 font-mono">
                      {r.nglComponents?.[comp.id]?.galPerMcf != null
                        ? Number(r.nglComponents[comp.id].galPerMcf).toFixed(3)
                        : '--'}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right text-gray-800 font-mono">
                    {(() => {
                      const value = meanLast(activeRows, 6, r => r.nglComponents?.[comp.id]?.galPerMcf)
                      return value != null ? Number(value).toFixed(3) : '--'
                    })()}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-800 font-mono">
                    {(() => {
                      const value = meanLast(activeRows, 12, r => r.nglComponents?.[comp.id]?.galPerMcf)
                      return value != null ? Number(value).toFixed(3) : '--'
                    })()}
                  </td>
                </tr>
                <tr className={`${bg} border-b border-gray-200`}>
                  <td className="px-2 py-1 text-gray-500 whitespace-nowrap">% of NGL</td>
                  {activeRows.map(r => (
                    <td key={r.monthKey} className="px-2 py-1 text-right text-gray-800 font-mono">
                      {fmtPct(r.nglComponents?.[comp.id]?.pctOfNgl)}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right text-gray-800 font-mono">{fmtPct(meanLast(activeRows, 6, r => r.nglComponents?.[comp.id]?.pctOfNgl))}</td>
                  <td className="px-2 py-1 text-right text-gray-800 font-mono">{fmtPct(meanLast(activeRows, 12, r => r.nglComponents?.[comp.id]?.pctOfNgl))}</td>
                </tr>
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function GptTab({
  gptRows = [],
  setGptRows,
  gptWarnings = [],
  setGptWarnings,
  gptError = null,
  setGptError,
  gptFilename = '',
  setGptFilename,
  // Lifted to App.jsx so state survives tab switches
  pendingGptFile = null,
  setPendingGptFile,
  pricingRows = [],
}) {
  const [loading, setLoading] = useState(false)

  const onFile = useCallback(file => {
    const reader = new FileReader()
    reader.onload = e => setPendingGptFile({ text: e.target.result, filename: file.name })
    reader.onerror = () => setGptError?.('Failed to read midstream GPT statement file.')
    reader.readAsText(file)
  }, [setGptError])

  const handleGptMappingConfirm = useCallback(({ columnMap, unitOverrides, text, filename }) => {
    setPendingGptFile(null)
    setLoading(true)
    setGptError?.(null)
    setGptWarnings?.([])
    setTimeout(() => {
      try {
        const { rows, warnings } = parseMidstreamGptCSVWithMapping(text, columnMap, unitOverrides)
        setGptRows?.(rows)
        setGptWarnings?.(warnings || [])
        setGptFilename?.(filename || 'midstream_gpt_statement.csv')
      } catch (err) {
        setGptError?.(err.message)
      } finally {
        setLoading(false)
      }
    }, 50)
  }, [setGptRows, setGptWarnings, setGptError, setGptFilename])

  const rollup = useMemo(() => buildGptRollup(gptRows), [gptRows])

  const displayRollup = useMemo(() => {
    const priceByMonth = Object.fromEntries(
      (pricingRows || [])
        .filter(row => row?.monthKey)
        .map(row => [row.monthKey, pickHistoricalGasPrice(row)])
    )

    const enrichSeries = series => (series || []).map(row => {
      const residueGasRealizedPrice = (
        row.residueGasSales != null &&
        row.residueGasVolumeMcf != null &&
        isFinite(row.residueGasSales) &&
        isFinite(row.residueGasVolumeMcf) &&
        Number(row.residueGasVolumeMcf) > 0
      )
        ? Number(row.residueGasSales) / Number(row.residueGasVolumeMcf)
        : null

      const historicalGasPrice = priceByMonth[row.monthKey] ?? null
      const gptImpliedGasDiff = (
        residueGasRealizedPrice != null &&
        historicalGasPrice != null
      )
        ? residueGasRealizedPrice - historicalGasPrice
        : null

      return {
        ...row,
        historicalGasPrice,
        residueGasRealizedPrice,
        gptImpliedGasDiff,
      }
    })

    return {
      totalRollup: enrichSeries(rollup.totalRollup),
      byMeter: Object.fromEntries(
        Object.entries(rollup.byMeter || {}).map(([meter, rows]) => [meter, enrichSeries(rows)])
      ),
      meters: rollup.meters || [],
    }
  }, [pricingRows, rollup])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-500">
        Parsing midstream GPT statement...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">GPT Analysis</h2>
          <p className="text-xs text-gray-500 mt-1">
            Midstream statement analytics by meter and month. This tab is currently analytical-only and does not feed LOS assumptions.
          </p>
          {gptFilename && (
            <p className="text-xs text-gray-400 mt-1">Loaded file: {gptFilename}</p>
          )}
        </div>
      </div>

      {/* GPT column mapper */}
      {pendingGptFile && (
        <DataSourceMapper
          text={pendingGptFile.text}
          filename={pendingGptFile.filename}
          defaultSourceType="gpt"
          onConfirm={({ columnMap, unitOverrides, text }) =>
            handleGptMappingConfirm({ columnMap, unitOverrides, text, filename: pendingGptFile.filename })
          }
          onCancel={() => setPendingGptFile(null)}
        />
      )}

      {!pendingGptFile && !gptRows.length && (
        <>
          <UploadZone
            onFile={onFile}
            title="Drop midstream GPT statement CSV here or click to browse"
            subtitle="Supports variable headers · Date and Meter columns required"
            hint="After upload a field-mapping step opens — auto-matched from known column names"
          />
          {gptError && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700">{gptError}</div>
          )}
        </>
      )}
      {!pendingGptFile && gptRows.length > 0 && (
        <div className="space-y-4">
          <UploadZone
            onFile={onFile}
            compact
            compactLabel="Load new GPT statement"
          />
          {gptError && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700">{gptError}</div>
          )}
          {gptWarnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-1">
              <p className="text-amber-800 text-xs font-bold uppercase tracking-wide">GPT Parse Warnings</p>
              {gptWarnings.map((w, i) => (
                <p key={i} className="text-amber-800 text-xs">{w}</p>
              ))}
            </div>
          )}

          {displayRollup.totalRollup.length > 0 && (
            <MetricTable title="Total Rollup (All Meters)" rows={displayRollup.totalRollup} />
          )}

          {/* NGL component breakdown — only rendered when component-level data was mapped */}
          {displayRollup.totalRollup.length > 0 && hasNglComponentData(displayRollup.totalRollup) && (
            <>
              <NglBuildTable rows={displayRollup.totalRollup} />
              <NglCompositionTable rows={displayRollup.totalRollup} />
            </>
          )}

          {displayRollup.meters.map(meter => (
            <MetricTable
              key={meter}
              title={`Meter: ${meter}`}
              rows={displayRollup.byMeter[meter] || []}
            />
          ))}
        </div>
      )}
    </div>
  )
}
