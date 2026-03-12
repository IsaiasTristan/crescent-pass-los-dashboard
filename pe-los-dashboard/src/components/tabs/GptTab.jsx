import React, { useMemo, useState } from 'react'
import { parseMidstreamGptCSVText } from '../../ingest/parseMidstreamGptCsv.js'
import { buildGptRollup } from '../../selectors/buildGptRollup.js'
import { fB, fP, fG } from '../../utils/formatters.js'

function UploadBox({ onFile }) {
  const [drag, setDrag] = useState(false)
  const onDrop = e => {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }
  const onPick = e => {
    const f = e.target.files[0]
    if (f) onFile(f)
  }

  return (
    <label
      onDrop={onDrop}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      className={`block border border-dashed rounded p-6 text-center cursor-pointer transition-colors ${
        drag ? 'border-[#1F3864] bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'
      }`}
    >
      <input type="file" accept=".csv,.txt" className="hidden" onChange={onPick} />
      <p className="text-sm text-gray-700 font-semibold">Drop midstream GPT statement CSV</p>
      <p className="text-xs text-gray-500 mt-1">
        Supports variable headers. Required: Date and Meter. All files are treated as Operated.
      </p>
    </label>
  )
}

function fmtYield(v) {
  return v == null || !isFinite(v) ? '--' : Number(v).toFixed(3)
}

function fmtBtu(v) {
  return v == null || !isFinite(v) ? '--' : Number(v).toFixed(2)
}

function fmtPct(v) {
  return v == null || !isFinite(v) ? '--' : `${Number(v).toFixed(2)}%`
}

function MetricTable({ title, rows }) {
  return (
    <div className="bg-white border border-gray-200 rounded overflow-x-auto">
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      <table className="min-w-full text-xs">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Date</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-600">NGL Yield (BBL/Mcf)</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-600">Gas Shrink (%)</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-600">BTU Factor</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-600">Gas Diff ($/Mcf)</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-600">NGL Price (% WTI)</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-600">GPT Cost ($/Mcf)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row.monthKey}-${idx}`} className={idx % 2 ? 'bg-white' : 'bg-gray-50/40'}>
              <td className="px-3 py-2 text-gray-700">{row.monthDisp}</td>
              <td className="px-3 py-2 text-right text-gray-900 font-mono">{fmtYield(row.nglYield)}</td>
              <td className="px-3 py-2 text-right text-gray-900 font-mono">{fmtPct(row.gasShrinkPct)}</td>
              <td className="px-3 py-2 text-right text-gray-900 font-mono">{fmtBtu(row.btuFactor)}</td>
              <td className="px-3 py-2 text-right text-gray-900 font-mono">{fG(row.gasDiff)}</td>
              <td className="px-3 py-2 text-right text-gray-900 font-mono">{fP(row.nglPricePctWti)}</td>
              <td className="px-3 py-2 text-right text-gray-900 font-mono">{fG(row.gptCostPerMcf)}</td>
            </tr>
          ))}
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
}) {
  const [loading, setLoading] = useState(false)

  const onFile = file => {
    setLoading(true)
    setGptError?.(null)
    setGptWarnings?.([])
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const { rows, warnings } = parseMidstreamGptCSVText(e.target.result)
        setGptRows?.(rows)
        setGptWarnings?.(warnings || [])
        setGptFilename?.(file.name || 'midstream_gpt_statement.csv')
      } catch (err) {
        setGptError?.(err.message)
      } finally {
        setLoading(false)
      }
    }
    reader.onerror = () => {
      setGptError?.('Failed to read midstream GPT statement file.')
      setLoading(false)
    }
    reader.readAsText(file)
  }

  const rollup = useMemo(() => buildGptRollup(gptRows), [gptRows])

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
            Midstream statement analytics by meter and month. Output drives operated GP&amp;T cost and differential assumptions.
          </p>
          {gptFilename && (
            <p className="text-xs text-gray-400 mt-1">Loaded file: {gptFilename}</p>
          )}
        </div>
      </div>

      {!gptRows.length && (
        <>
          <UploadBox onFile={onFile} />
          {gptError && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700">{gptError}</div>
          )}
        </>
      )}
      {gptRows.length > 0 && (
        <div className="space-y-4">
          <UploadBox onFile={onFile} />
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

          {rollup.totalRollup.length > 0 && (
            <MetricTable title="Total Rollup (All Meters)" rows={rollup.totalRollup} />
          )}

          {rollup.meters.map(meter => (
            <MetricTable
              key={meter}
              title={`Meter: ${meter}`}
              rows={rollup.byMeter[meter] || []}
            />
          ))}
        </div>
      )}
    </div>
  )
}
