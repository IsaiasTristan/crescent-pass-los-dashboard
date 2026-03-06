import React, { useMemo } from 'react'
import ExportButton from './ExportButton'
import { exportAriesInputs } from '../utils/exportCSV'

const FIELDS = [
  {
    key: 'fixedPerWellMonth',
    label: 'Fixed Costs',
    unit: '$/well/month',
    lowerIsBetter: true,
    histKey: 'fixedPerWell',
    fmt: v => `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
  },
  {
    key: 'varOilPerBOE',
    label: 'Variable Oil Costs',
    unit: '$/BOE',
    lowerIsBetter: true,
    histKey: 'varOilPerBOE',
    fmt: v => `$${v.toFixed(2)}`,
  },
  {
    key: 'varWaterPerBBL',
    label: 'Variable Water Costs',
    unit: '$/BBL water',
    lowerIsBetter: true,
    histKey: null, // water volumes not in LOS
    fmt: v => `$${v.toFixed(2)}`,
  },
  {
    key: 'prodTaxPct',
    label: 'Production Taxes',
    unit: '% of revenue',
    lowerIsBetter: true,
    histKey: 'prodTaxPct',
    fmt: v => `${v.toFixed(2)}%`,
  },
  {
    key: 'oilDiff',
    label: 'Oil Differential',
    unit: '$/BBL vs. WTI',
    lowerIsBetter: false,
    histKey: null,
    fmt: v => `$${v.toFixed(2)}`,
  },
  {
    key: 'gasDiff',
    label: 'Gas Differential',
    unit: '$/MMBTU vs. Henry Hub',
    lowerIsBetter: false,
    histKey: null,
    fmt: v => `$${v.toFixed(3)}`,
  },
  {
    key: 'nglDiffPct',
    label: 'NGL Differential',
    unit: '% of WTI',
    lowerIsBetter: false,
    histKey: null,
    fmt: v => `${v.toFixed(1)}%`,
  },
]

function safeAvg(arr, key) {
  const vals = arr.map(m => m[key]).filter(v => v != null && isFinite(v) && v !== 0)
  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export default function InputsTab({ ariesInputs, setAriesInputs, monthlyRollup }) {
  const historicalAvgs = useMemo(() => {
    if (!monthlyRollup || monthlyRollup.length === 0) return {}
    const avgs = {}
    FIELDS.forEach(f => {
      if (f.histKey) avgs[f.key] = safeAvg(monthlyRollup, f.histKey)
    })
    return avgs
  }, [monthlyRollup])

  const handleChange = (caseType, key, value) => {
    setAriesInputs(prev => ({
      ...prev,
      [caseType]: { ...prev[caseType], [key]: value },
    }))
  }

  const variance = (field) => {
    const v = parseFloat(ariesInputs.vdrCase[field.key])
    const m = parseFloat(ariesInputs.myCase[field.key])
    if (isNaN(v) || isNaN(m)) return null
    const diff = m - v
    const pct = v !== 0 ? (diff / Math.abs(v)) * 100 : null
    return { diff, pct }
  }

  const varColor = (field, v) => {
    if (v === null) return 'text-[#4a4d5a]'
    const better = field.lowerIsBetter ? v.diff < 0 : v.diff > 0
    if (v.diff === 0) return 'text-[#8b8fa8]'
    return better ? 'text-emerald-400' : 'text-red-400'
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#f0f0f0]">ARIES Model Inputs</h2>
          <p className="text-xs text-[#8b8fa8] mt-1">
            Set forward-looking assumptions for your economic model. Changes instantly update chart overlays.
          </p>
        </div>
        <ExportButton onClick={() => exportAriesInputs(ariesInputs)}>
          Export Inputs to CSV
        </ExportButton>
      </div>

      {/* Main input table */}
      <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-lg overflow-hidden">
        {/* Column headers */}
        <div className="grid border-b border-[#2a2d3a]"
          style={{ gridTemplateColumns: '200px 1fr 1fr 160px 140px' }}>
          <div className="px-4 py-2.5 text-[10px] font-semibold text-[#8b8fa8] uppercase tracking-wider">
            Input
          </div>
          <div className="px-4 py-2.5 text-[10px] font-semibold text-[#8b8fa8] uppercase tracking-wider border-l border-[#2a2d3a]">
            VDR Case
          </div>
          <div className="px-4 py-2.5 text-[10px] font-semibold text-[#4e9af1] uppercase tracking-wider border-l border-[#2a2d3a]">
            My Case
          </div>
          <div className="px-4 py-2.5 text-[10px] font-semibold text-[#8b8fa8] uppercase tracking-wider border-l border-[#2a2d3a]">
            Variance
          </div>
          <div className="px-4 py-2.5 text-[10px] font-semibold text-[#8b8fa8] uppercase tracking-wider border-l border-[#2a2d3a]">
            Historical Avg
          </div>
        </div>

        {/* Data rows */}
        {FIELDS.map((field, idx) => {
          const v = variance(field)
          const color = varColor(field, v)
          const histVal = historicalAvgs[field.key]

          return (
            <div
              key={field.key}
              className={`grid hover:bg-[#1e2130] transition-colors ${idx < FIELDS.length - 1 ? 'border-b border-[#2a2d3a]' : ''}`}
              style={{ gridTemplateColumns: '200px 1fr 1fr 160px 140px' }}
            >
              {/* Label */}
              <div className="px-4 py-3">
                <div className="text-sm text-[#f0f0f0] font-medium">{field.label}</div>
                <div className="text-xs text-[#8b8fa8] mt-0.5">{field.unit}</div>
              </div>

              {/* VDR Case input */}
              <div className="px-4 py-3 border-l border-[#2a2d3a] flex items-center">
                <input
                  type="number"
                  step="any"
                  value={ariesInputs.vdrCase[field.key]}
                  onChange={e => handleChange('vdrCase', field.key, e.target.value)}
                  placeholder="—"
                  className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded px-2 py-1.5 text-sm text-[#f0f0f0] placeholder-[#4a4d5a] text-right outline-none focus:border-[#4a4d5a] focus:ring-0 transition-colors"
                />
              </div>

              {/* My Case input */}
              <div className="px-4 py-3 border-l border-[#2a2d3a] flex items-center">
                <input
                  type="number"
                  step="any"
                  value={ariesInputs.myCase[field.key]}
                  onChange={e => handleChange('myCase', field.key, e.target.value)}
                  placeholder="—"
                  className="w-full bg-[#0f1117] border border-[#4e9af1]/30 rounded px-2 py-1.5 text-sm text-[#f0f0f0] placeholder-[#4a4d5a] text-right outline-none focus:border-[#4e9af1] focus:ring-0 transition-colors"
                />
              </div>

              {/* Variance */}
              <div className={`px-4 py-3 border-l border-[#2a2d3a] flex flex-col justify-center ${color}`}>
                {v !== null ? (
                  <>
                    <div className="text-sm font-semibold">
                      {v.diff > 0 ? '+' : ''}{v.diff.toFixed(2)}
                    </div>
                    {v.pct !== null && (
                      <div className="text-xs mt-0.5">
                        {v.pct > 0 ? '+' : ''}{v.pct.toFixed(1)}%
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-[#4a4d5a]">—</span>
                )}
              </div>

              {/* Historical avg */}
              <div className="px-4 py-3 border-l border-[#2a2d3a] flex items-center justify-end">
                {histVal != null ? (
                  <span className="text-sm text-[#8b8fa8] font-mono">
                    {field.fmt(histVal)}
                  </span>
                ) : (
                  <span className="text-xs text-[#4a4d5a]">
                    {field.histKey === null ? 'N/A' : '—'}
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {/* GPT row — grayed out, Coming Soon */}
        <div
          className="grid border-t border-[#2a2d3a] opacity-35"
          style={{ gridTemplateColumns: '200px 1fr 1fr 160px 140px' }}
        >
          <div className="px-4 py-3">
            <div className="text-sm text-[#8b8fa8]">GPT</div>
            <div className="text-xs text-[#4a4d5a] mt-0.5">Gathering, Processing &amp; Transport</div>
          </div>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="px-4 py-3 border-l border-[#2a2d3a] flex items-center justify-end">
              <span
                className="text-xs text-[#4a4d5a] italic"
                title="GPT will be integrated from a separate file in a future update."
              >
                Coming Soon
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#8b8fa8] uppercase tracking-wider mb-2">
            Assumption Notes
          </h3>
          <ul className="space-y-1.5 text-xs text-[#4a4d5a]">
            <li>Fixed costs: flat $/well/month, no escalation</li>
            <li>Variable Oil: applied to oil + NGL production (BOE)</li>
            <li>Variable Water: applied to total water volumes (BBL) — water volumes not in LOS</li>
            <li>Production Taxes: % applied to gross revenue</li>
            <li>Oil differential: $/BBL vs. WTI (negative = discount)</li>
            <li>Gas differential: $/MMBTU vs. Henry Hub</li>
            <li>NGL differential: % of WTI realized (e.g., 35%)</li>
          </ul>
        </div>
        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#8b8fa8] uppercase tracking-wider mb-2">
            Variance Legend
          </h3>
          <ul className="space-y-1.5 text-xs">
            <li className="text-emerald-400">Green — My Case is better (lower cost / better differential)</li>
            <li className="text-red-400">Red — My Case is worse (higher cost / worse differential)</li>
            <li className="text-[#8b8fa8]">Gray — No variance (equal values)</li>
          </ul>
          <div className="mt-3 pt-3 border-t border-[#2a2d3a]">
            <h3 className="text-xs font-semibold text-[#8b8fa8] uppercase tracking-wider mb-2">
              ARIES Overlays
            </h3>
            <p className="text-xs text-[#4a4d5a]">
              My Case values appear as{' '}
              <span className="text-[#facc15]">gold dashed lines</span> on Rollup and Well-by-Well charts.
              VDR Case appears as{' '}
              <span className="text-[#94a3b8]">slate dotted lines</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
