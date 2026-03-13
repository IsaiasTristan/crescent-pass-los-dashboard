import React, { useMemo, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, LabelList,
} from 'recharts'
import { parseHistoricalPricingCSVText, parseHistoricalPricingCSVWithMapping } from '../../ingest/parseHistoricalPricingCsv.js'
import { parseHistoricalVolumesCSVText, parseHistoricalVolumesCSVWithMapping } from '../../ingest/parseHistoricalVolumesCsv.js'
import { CM, GP, AP, TP, LP, topLabel } from '../../charts/chartConfig.jsx'
import { DataSourceMapper } from '../DataSourceMapper.jsx'
import { UploadZone } from '../shared/UploadZone.jsx'

function fmt(v, d = 2) {
  return v == null ? '--' : `$${Number(v).toFixed(d)}`
}

function latest(rows, key) {
  if (!rows || !rows.length) return null
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = rows[i][key]
    if (v != null) return v
  }
  return null
}

export function HistoricalPricingTab({
  pricingRows = [],
  setPricingRows,
  pricingWarnings = [],
  setPricingWarnings,
  pricingError = null,
  setPricingError,
  pricingFilename = '',
  setPricingFilename,
  volumeRows = [],
  setVolumeRows,
  volumeWarnings = [],
  setVolumeWarnings,
  volumeError = null,
  setVolumeError,
  volumeFilename = '',
  setVolumeFilename,
  volumeMatchWarnings = [],
  histGrossWaterByMonth = [],
}) {
  const [loading, setLoading] = useState(false)
  const [volumeLoading, setVolumeLoading] = useState(false)

  // Pending file states for DataSourceMapper
  const [pendingPricingFile, setPendingPricingFile] = useState(null)
  const [pendingVolumeFile, setPendingVolumeFile] = useState(null)

  const onPricingFile = useCallback(file => {
    const reader = new FileReader()
    reader.onload = e => setPendingPricingFile({ text: e.target.result, filename: file.name })
    reader.onerror = () => setPricingError?.('Failed to read historical pricing file.')
    reader.readAsText(file)
  }, [setPricingError])

  const handlePricingMappingConfirm = useCallback(({ columnMap, unitOverrides, text, filename }) => {
    setPendingPricingFile(null)
    setLoading(true)
    setPricingError?.(null)
    setPricingWarnings?.([])
    setTimeout(() => {
      try {
        const { rows, warnings: parseWarnings } = parseHistoricalPricingCSVWithMapping(text, columnMap, unitOverrides)
        setPricingRows?.(rows)
        setPricingWarnings?.(parseWarnings || [])
        setPricingFilename?.(filename || 'historical_pricing.csv')
      } catch (err) {
        setPricingError?.(err.message)
      } finally {
        setLoading(false)
      }
    }, 50)
  }, [setPricingRows, setPricingWarnings, setPricingError, setPricingFilename])

  const onVolumeFile = useCallback(file => {
    const reader = new FileReader()
    reader.onload = e => setPendingVolumeFile({ text: e.target.result, filename: file.name })
    reader.onerror = () => setVolumeError?.('Failed to read historical gross-volume file.')
    reader.readAsText(file)
  }, [setVolumeError])

  const handleVolumeMappingConfirm = useCallback(({ columnMap, unitOverrides, text, filename }) => {
    setPendingVolumeFile(null)
    setVolumeLoading(true)
    setVolumeError?.(null)
    setVolumeWarnings?.([])
    setTimeout(() => {
      try {
        const { rows, warnings: parseWarnings } = parseHistoricalVolumesCSVWithMapping(text, columnMap, unitOverrides)
        setVolumeRows?.(rows)
        setVolumeWarnings?.(parseWarnings || [])
        setVolumeFilename?.(filename || 'historical_gross_volumes.csv')
      } catch (err) {
        setVolumeError?.(err.message)
      } finally {
        setVolumeLoading(false)
      }
    }, 50)
  }, [setVolumeRows, setVolumeWarnings, setVolumeError, setVolumeFilename])

  const chartRows = useMemo(
    () => pricingRows.map(r => ({
      label: r.monthDisp,
      wti: r.wti,
      meh: r.meh,
      hh: r.henryHub,
      hsc: r.hsc,
      mehBasis: r.mehBasis,
      hscBasis: r.hscBasis,
    })),
    [pricingRows]
  )

  // Use matched gross-water history when available; fall back to raw gross water
  // from the parsed rows before LOS matching has run.
  const waterChartRows = useMemo(() => {
    if (histGrossWaterByMonth.length > 0) {
      return histGrossWaterByMonth.map(r => ({
        label: r.monthDisp,
        grossWater: r.grossWater,
      }))
    }
    // Fallback: aggregate gross water directly from parsed volume rows.
    const months = {}
    volumeRows.forEach(row => {
      const key = row.monthKey
      if (!months[key]) months[key] = { label: row.monthDisp, grossWater: 0 }
      months[key].grossWater += row.grossWaterVolume || 0
    })
    return Object.entries(months)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, value]) => value)
  }, [histGrossWaterByMonth, volumeRows])

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Historical Inputs</h2>
          <p className="text-xs text-gray-500 mt-1">
            Upload monthly pricing plus gross volumes. Gross water history feeds the water unit-cost calculation directly.
          </p>
        </div>
        <div className="text-xs text-gray-500">
          {pricingFilename ? `Pricing: ${pricingFilename}` : 'No pricing file loaded'}
          {volumeFilename ? ` | Volumes: ${volumeFilename}` : ''}
        </div>
      </div>

      {/* Pricing column mapper */}
      {pendingPricingFile && (
        <DataSourceMapper
          text={pendingPricingFile.text}
          filename={pendingPricingFile.filename}
          defaultSourceType="pricing"
          onConfirm={({ columnMap, unitOverrides, text }) =>
            handlePricingMappingConfirm({ columnMap, unitOverrides, text, filename: pendingPricingFile.filename })
          }
          onCancel={() => setPendingPricingFile(null)}
        />
      )}

      {/* Volume column mapper */}
      {pendingVolumeFile && (
        <DataSourceMapper
          text={pendingVolumeFile.text}
          filename={pendingVolumeFile.filename}
          defaultSourceType="volumes"
          onConfirm={({ columnMap, unitOverrides, text }) =>
            handleVolumeMappingConfirm({ columnMap, unitOverrides, text, filename: pendingVolumeFile.filename })
          }
          onCancel={() => setPendingVolumeFile(null)}
        />
      )}

      {!pendingPricingFile && !pendingVolumeFile && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <UploadZone
            onFile={onPricingFile}
            title="Drop historical pricing CSV here or click to browse"
            subtitle="Supports variable headers · auto-mapping step opens after upload"
            hint="Expected: Date/Month · WTI · Henry Hub · MEH/HSC price or basis"
          />
          <UploadZone
            onFile={onVolumeFile}
            title="Drop historical gross-volume CSV here or click to browse"
            subtitle="Supports variable headers · auto-mapping step opens after upload"
            hint="Expected: Date/Month · Well Name or Applicable Tag · gross Oil/Gas/NGL/Water volumes"
          />
        </div>
      )}

      {loading && <div className="text-xs text-gray-500">Parsing historical pricing CSV...</div>}
      {volumeLoading && <div className="text-xs text-gray-500">Parsing historical gross-volume CSV...</div>}
      {!loading && pricingError && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700">{pricingError}</div>
      )}
      {!volumeLoading && volumeError && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700">{volumeError}</div>
      )}
      {!loading && pricingWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800 space-y-1">
          {pricingWarnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}
      {!volumeLoading && (volumeWarnings.length > 0 || volumeMatchWarnings.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800 space-y-1">
          {[...volumeWarnings, ...volumeMatchWarnings].map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}

      {pricingRows.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 rounded p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Latest WTI</div>
              <div className="text-base font-bold text-gray-900 mt-1">{fmt(latest(pricingRows, 'wti'))}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Latest MEH</div>
              <div className="text-base font-bold text-gray-900 mt-1">{fmt(latest(pricingRows, 'meh'))}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Latest Henry Hub</div>
              <div className="text-base font-bold text-gray-900 mt-1">{fmt(latest(pricingRows, 'henryHub'))}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Latest HSC</div>
              <div className="text-base font-bold text-gray-900 mt-1">{fmt(latest(pricingRows, 'hsc'))}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded p-3 h-[320px]">
              <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Oil Pricing ($/BBL)</h3>
              <ResponsiveContainer width="100%" height="92%">
                <BarChart data={chartRows} margin={CM}>
                  <CartesianGrid {...GP} />
                  <XAxis dataKey="label" {...AP} />
                  <YAxis {...AP} />
                  <Tooltip {...TP} formatter={v => fmt(v)} />
                  <Legend {...LP} />
                  <Bar dataKey="wti" name="WTI" fill="#1F3864">
                    <LabelList dataKey="wti" content={topLabel(v => fmt(v))} />
                  </Bar>
                  <Bar dataKey="meh" name="MEH" fill="#2E74B5">
                    <LabelList dataKey="meh" content={topLabel(v => fmt(v))} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white border border-gray-200 rounded p-3 h-[320px]">
              <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Gas Pricing ($/MMBTU)</h3>
              <ResponsiveContainer width="100%" height="92%">
                <BarChart data={chartRows} margin={CM}>
                  <CartesianGrid {...GP} />
                  <XAxis dataKey="label" {...AP} />
                  <YAxis {...AP} />
                  <Tooltip {...TP} formatter={v => fmt(v, 3)} />
                  <Legend {...LP} />
                  <Bar dataKey="hh" name="Henry Hub" fill="#C55A11">
                    <LabelList dataKey="hh" content={topLabel(v => fmt(v, 3))} />
                  </Bar>
                  <Bar dataKey="hsc" name="HSC" fill="#548235">
                    <LabelList dataKey="hsc" content={topLabel(v => fmt(v, 3))} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white border border-gray-200 rounded p-3 h-[300px] xl:col-span-2">
              <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Basis Differentials</h3>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={chartRows} margin={CM}>
                  <CartesianGrid {...GP} />
                  <XAxis dataKey="label" {...AP} />
                  <YAxis {...AP} />
                  <Tooltip {...TP} formatter={v => fmt(v, 3)} />
                  <Legend {...LP} />
                  <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="3 3" />
                  <Bar dataKey="mehBasis" name="MEH Basis vs WTI" fill="#4B5563">
                    <LabelList dataKey="mehBasis" content={topLabel(v => fmt(v, 3))} />
                  </Bar>
                  <Bar dataKey="hscBasis" name="HSC Basis vs Henry Hub" fill="#9CA3AF">
                    <LabelList dataKey="hscBasis" content={topLabel(v => fmt(v, 3))} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2">Month</th>
                  <th className="text-right px-3 py-2">WTI</th>
                  <th className="text-right px-3 py-2">MEH Basis</th>
                  <th className="text-right px-3 py-2">MEH (WTI + Basis)</th>
                  <th className="text-right px-3 py-2">Henry Hub</th>
                  <th className="text-right px-3 py-2">HSC Basis</th>
                  <th className="text-right px-3 py-2">HSC (HH + Basis)</th>
                </tr>
              </thead>
              <tbody>
                {pricingRows.map(r => (
                  <tr key={`${r.monthKey}-${r.rowNumber}`} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-700 font-semibold">{r.monthDisp}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.wti)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.mehBasis, 3)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.meh)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.henryHub, 3)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.hscBasis, 3)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.hsc, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {volumeRows.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 rounded p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Rows Loaded</div>
              <div className="text-base font-bold text-gray-900 mt-1">{volumeRows.length.toLocaleString()}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Latest Gross Water</div>
              <div className="text-base font-bold text-gray-900 mt-1">
                {waterChartRows.length
                  ? Number((waterChartRows[waterChartRows.length - 1].grossWater) || 0).toLocaleString('en-US', { maximumFractionDigits: 1 })
                  : '--'}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Historical Months</div>
              <div className="text-base font-bold text-gray-900 mt-1">{waterChartRows.length}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Applicable Tags</div>
              <div className="text-base font-bold text-gray-900 mt-1">{new Set(volumeRows.map(r => r.applicableTag).filter(Boolean)).size}</div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded p-3 h-[320px]">
            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
              Historical Gross Water Volume
            </h3>
            <ResponsiveContainer width="100%" height="92%">
              <BarChart data={waterChartRows} margin={CM}>
                <CartesianGrid {...GP} />
                <XAxis dataKey="label" {...AP} />
                <YAxis {...AP} />
                <Tooltip
                  {...TP}
                  formatter={(v, name) => [Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 1 }), name]}
                />
                <Legend {...LP} />
                <Bar dataKey="grossWater" name="Gross Water (BBL)" fill="#808080">
                  <LabelList dataKey="grossWater" content={topLabel(v => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }))} />
                </Bar>
                <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="3 3" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
