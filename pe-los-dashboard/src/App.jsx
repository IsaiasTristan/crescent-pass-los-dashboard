import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { parseCSVText } from './utils/parseCSV'
import { buildMonthlyRollup, buildWellData } from './utils/aggregations'
import InputsTab from './components/InputsTab'
import RollupTab from './components/RollupTab'
import WellByWellTab from './components/WellByWellTab'

// ─── Default ARIES input state ────────────────────────────────────────────────
const EMPTY_CASE = {
  fixedPerWellMonth: '',
  varOilPerBOE:      '',
  varWaterPerBBL:    '',
  prodTaxPct:        '',
  oilDiff:           '',
  gasDiff:           '',
  nglDiffPct:        '',
}

const DEFAULT_INPUTS = {
  vdrCase: { ...EMPTY_CASE },
  myCase:  { ...EMPTY_CASE },
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'inputs',    label: 'ARIES Inputs' },
  { id: 'rollup',   label: 'Portfolio Rollup' },
  { id: 'wellbywell', label: 'Well by Well' },
]

// ─── Upload zone component ────────────────────────────────────────────────────
function UploadZone({ onFile, compact = false }) {
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  if (compact) {
    return (
      <label
        className={`flex items-center gap-2 px-3 py-1.5 rounded border border-dashed text-xs cursor-pointer transition-colors ${
          dragging
            ? 'border-[#4e9af1] text-[#4e9af1] bg-[#4e9af1]/5'
            : 'border-[#2a2d3a] text-[#4a4d5a] hover:border-[#4a4d5a] hover:text-[#8b8fa8]'
        }`}
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
      >
        <input
          type="file"
          accept=".csv,.txt,.tsv"
          className="hidden"
          onChange={e => e.target.files[0] && onFile(e.target.files[0])}
        />
        Reload CSV
      </label>
    )
  }

  return (
    <label
      className={`block border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors ${
        dragging
          ? 'border-[#4e9af1] bg-[#4e9af1]/5'
          : 'border-[#2a2d3a] hover:border-[#4a4d5a]'
      }`}
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
    >
      <input
        type="file"
        accept=".csv,.txt,.tsv"
        className="hidden"
        onChange={e => e.target.files[0] && onFile(e.target.files[0])}
      />
      <div className="flex flex-col items-center gap-3">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-[#2a2d3a]">
          <rect x="8" y="6" width="24" height="28" rx="3" stroke="currentColor" strokeWidth="2"/>
          <path d="M14 14h12M14 20h12M14 26h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="30" cy="30" r="8" fill="#0f1117" stroke="currentColor" strokeWidth="2"/>
          <path d="M30 26v8M27 29l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div>
          <p className="text-sm text-[#8b8fa8] font-medium">Drop <code className="text-[#f0f0f0]">los_data.csv</code> here or click to browse</p>
          <p className="text-xs text-[#4a4d5a] mt-1">Tab-delimited · 22 columns · Service End Date format M/DD/YY</p>
        </div>
        <div className="text-xs text-[#4a4d5a] bg-[#1a1d27] border border-[#2a2d3a] rounded px-3 py-1.5 leading-relaxed">
          Expected: Well Name · Cost Category · Gross Up By · NRI · WI · Gross Amount · Gross Volume · Net Amount(1) ·
          JP/RP · x · Comp · <strong className="text-[#8b8fa8]">Service End Date</strong> · Property # · Property Name · JP/RP ·
          OP/OBO · <strong className="text-[#8b8fa8]">LOS CATEGORY</strong> · Main · Sub · Alloc LOE ·
          <strong className="text-[#8b8fa8]">Net Volume</strong> · <strong className="text-[#8b8fa8]">Net Amount</strong>
        </div>
      </div>
    </label>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab,    setActiveTab]    = useState('inputs')
  const [rawRows,      setRawRows]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [ariesInputs,  setAriesInputs]  = useState(DEFAULT_INPUTS)
  const [loadedFileName, setLoadedFileName] = useState(null)

  // Process raw CSV text → parsed rows
  const processText = useCallback((text, filename) => {
    setLoading(true)
    setError(null)
    // Defer to allow spinner to render
    setTimeout(() => {
      try {
        const rows = parseCSVText(text)
        setRawRows(rows)
        setLoadedFileName(filename || 'los_data.csv')
        setError(null)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }, 50)
  }, [])

  // Process a File object
  const processFile = useCallback((file) => {
    const reader = new FileReader()
    reader.onload = e => processText(e.target.result, file.name)
    reader.onerror = () => {
      setError('Failed to read file.')
      setLoading(false)
    }
    reader.readAsText(file)
  }, [processText])

  // On mount: try fetching the default data file from public/data/
  useEffect(() => {
    fetch('/data/los_data.csv')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then(text => processText(text, 'los_data.csv'))
      .catch(() => {
        // No file at /data/los_data.csv — show upload zone
        setLoading(false)
      })
  }, [processText])

  // Aggregate data (memoized)
  const monthlyRollup = useMemo(() => {
    if (!rawRows) return []
    return buildMonthlyRollup(rawRows)
  }, [rawRows])

  const wellData = useMemo(() => {
    if (!rawRows) return []
    return buildWellData(rawRows)
  }, [rawRows])

  // Summary stats for header
  const stats = rawRows
    ? `${rawRows.length.toLocaleString()} rows · ${wellData.length} wells · ${monthlyRollup.length} months`
    : null

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#f0f0f0]">
      {/* ── Top header ─────────────────────────────────────────────── */}
      <header className="border-b border-[#2a2d3a] sticky top-0 z-20 bg-[#0f1117]/95 backdrop-blur">
        <div className="max-w-[1440px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div>
              <h1 className="text-base font-semibold tracking-tight text-white leading-tight">
                E&amp;P LOS Dashboard
              </h1>
              <p className="text-[10px] text-[#8b8fa8] leading-tight">
                PE Due Diligence · Lease Operating Statement Analysis
              </p>
            </div>
            {rawRows && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <span className="text-xs text-[#8b8fa8] truncate">{loadedFileName}</span>
                <span className="text-xs text-[#4a4d5a]">{stats}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {rawRows && <UploadZone onFile={processFile} compact />}
          </div>
        </div>
      </header>

      {/* ── Tab navigation ─────────────────────────────────────────── */}
      <nav className="border-b border-[#2a2d3a] bg-[#0f1117]">
        <div className="max-w-[1440px] mx-auto px-6 flex">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#4e9af1] text-[#4e9af1]'
                  : 'border-transparent text-[#8b8fa8] hover:text-[#f0f0f0] hover:border-[#4a4d5a]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main className="max-w-[1440px] mx-auto px-6 py-6">

        {/* Loading spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-2 border-[#2a2d3a]" />
              <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-t-[#4e9af1] animate-spin" />
            </div>
            <p className="text-sm text-[#8b8fa8]">Parsing LOS data…</p>
          </div>
        )}

        {/* Parse error */}
        {!loading && error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-5 max-w-2xl">
            <div className="flex items-start gap-3">
              <svg className="text-red-400 flex-shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <div>
                <p className="text-red-400 text-sm font-semibold">Parse Error</p>
                <p className="text-red-300 text-xs mt-1 leading-relaxed">{error}</p>
                <p className="text-[#8b8fa8] text-xs mt-2">
                  Check that the file is tab-delimited with 22 columns and dates in M/DD/YY format.
                </p>
              </div>
            </div>
            <div className="mt-4">
              <UploadZone onFile={processFile} compact />
            </div>
          </div>
        )}

        {/* No data — show large upload zone */}
        {!loading && !error && !rawRows && (
          <UploadZone onFile={processFile} />
        )}

        {/* Tab content */}
        {!loading && rawRows && (
          <>
            {activeTab === 'inputs' && (
              <InputsTab
                ariesInputs={ariesInputs}
                setAriesInputs={setAriesInputs}
                monthlyRollup={monthlyRollup}
              />
            )}
            {activeTab === 'rollup' && (
              <RollupTab
                monthlyRollup={monthlyRollup}
                ariesInputs={ariesInputs}
                wellData={wellData}
              />
            )}
            {activeTab === 'wellbywell' && (
              <WellByWellTab
                wellData={wellData}
                ariesInputs={ariesInputs}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}
