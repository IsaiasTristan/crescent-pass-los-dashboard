import React, { useMemo, useState, useCallback, useRef } from 'react'
import Papa from 'papaparse'
import { autoMapColumns, detectSourceType, normalizeHeader } from '../ingest/autoMapper.js'
import { FIELD_REGISTRY, DATA_SOURCES, UNIT_CHOICES, UNIT_OPTIONS } from '../constants/fieldRegistry.js'
import { NGL_COMPONENTS, NGL_COMPONENT_FIELD_SUFFIXES } from '../constants/gptConfig.js'

// ─── Field-group definitions per source type ──────────────────────────────────
// Each entry defines the order and section headers for the mapping table.
// Fields not listed here still appear at the bottom under "Other".

const SOURCE_FIELD_GROUPS = {
  los: [
    { label: 'Identity',  fields: ['wellName', 'propertyNum', 'propertyName', 'serviceDate', 'opStatus', 'opObo', 'jpRp'] },
    { label: 'LOS Data',  fields: ['costCategory', 'losCategory', 'netAmount', 'netVolume', 'grossAmount', 'grossVolume', 'wi', 'nri'] },
  ],
  volumes: [
    { label: 'Identity',    fields: ['wellName', 'propertyNum', 'propertyName', 'meterTag', 'serviceDate'] },
    { label: 'Production',  fields: ['grossOilVolume', 'grossGasVolume', 'grossNGLVolume', 'grossWaterVolume', 'wi', 'nri'] },
  ],
  pricing: [
    { label: 'Date',          fields: ['serviceDate'] },
    { label: 'Benchmarks',    fields: ['wtiPrice', 'henryHub', 'mehPrice', 'hscPrice'] },
    { label: 'Differentials', fields: ['mehBasis', 'hscBasis'] },
  ],
  gpt: [
    { label: 'Identity',       fields: ['serviceDate', 'meterName'] },
    { label: 'Gas Volumes',    fields: ['inletVolumeMcf', 'inletVolumeMmBtu', 'fieldFuelMcf', 'fieldFuelMmBtu', 'netDeliveredMcf', 'netDeliveredMmBtu', 'totalShrinkMmBtu', 'plantFuelLossMmBtu', 'gasShrinkMcf', 'btuFactor'] },
    { label: 'Residue Gas',    fields: ['settlementResidueMmBtu', 'globalContractPct', 'settlementResWithContract', 'residuePricePerMmBtu', 'residueGasVolumeMcf', 'residueGasSales'] },
    { label: 'NGL Totals',     fields: ['nglVolumeBbl', 'nglYield', 'nglSales', 'nglRealizedPrice', 'nglDifferentialPct', 'wtiPrice'] },
    { label: 'Midstream Fees', fields: ['fee1Label', 'fee1Amount', 'fee2Label', 'fee2Amount', 'fee3Label', 'fee3Amount', 'fee4Label', 'fee4Amount'] },
    // NGL components rendered separately as a compact grid below
  ],
}

// Set of all NGL component field IDs (e.g. "ethaneTheoreticalGal") — rendered as a grid
const NGL_COMP_FIELD_IDS = new Set(
  NGL_COMPONENTS.flatMap(c => NGL_COMPONENT_FIELD_SUFFIXES.map(s => `${c.id}${s.suffix}`))
)

// ─── Header parsing ───────────────────────────────────────────────────────────

function parseRawHeaders(text) {
  const cleaned = (text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  let bestResult = null
  let bestColCount = 0
  for (const delimiter of ['\t', ',', ';']) {
    const result = Papa.parse(cleaned, { delimiter, header: false, skipEmptyLines: true, preview: 8 })
    if (result.data?.length) {
      const colCount = result.data[0].length
      if (colCount > bestColCount) { bestColCount = colCount; bestResult = result }
    }
  }
  if (!bestResult) return { headers: [], sampleRows: [] }
  const headers = (bestResult.data[0] || []).map(v => String(v ?? ''))
  return { headers, sampleRows: bestResult.data.slice(1, 6) }
}

// ─── Invert autoMapper proposals: source-col → field, to field → source-col ──

function invertProposals(proposedMappings) {
  const confOrder = { exact: 3, high: 2, low: 1 }
  const result = {}
  for (const m of proposedMappings) {
    if (!m.canonicalFieldId) continue
    const existing = result[m.canonicalFieldId]
    const newScore = confOrder[m.confidence] ?? 0
    const oldScore = confOrder[existing?.confidence] ?? 0
    if (!existing || newScore > oldScore) {
      result[m.canonicalFieldId] = {
        headerIdx: m.headerIdx,
        confidence: m.confidence,
        suggestedUnit: m.suggestedUnit,
      }
    }
  }
  return result
}

// ─── Confidence indicator ─────────────────────────────────────────────────────

const CONF = {
  exact:  { icon: '●', cls: 'text-emerald-600', title: 'Auto-matched exactly' },
  high:   { icon: '◐', cls: 'text-amber-500',   title: 'Auto-matched (partial)' },
  low:    { icon: '○', cls: 'text-orange-500',  title: 'Auto-matched (low confidence)' },
  manual: { icon: '✎', cls: 'text-blue-500',    title: 'Manually assigned' },
  null:   { icon: '—', cls: 'text-gray-300',    title: 'No match found' },
}

function ConfDot({ conf }) {
  const c = CONF[conf] ?? CONF.null
  return <span className={`text-[11px] font-bold ${c.cls}`} title={c.title}>{c.icon}</span>
}

// ─── Main component ────────────────────────────────────────────────────────────

/**
 * DataSourceMapper — field-first mapping UI.
 *
 * Lists every canonical field used in the project for the selected source type.
 * The user maps each field to a column in their CSV via a dropdown.
 * Auto-matcher pre-populates suggestions which the user can override.
 *
 * Props:
 *   text              {string}   Raw CSV text
 *   filename          {string}   Filename for display
 *   defaultSourceType {string}   Pre-selected source type
 *   onConfirm         {fn}       Called with { sourceType, columnMap, unitOverrides, text }
 *   onCancel          {fn}       Called when user cancels
 */
export function DataSourceMapper({ text, filename, defaultSourceType, onConfirm, onCancel }) {
  const { headers, sampleRows } = useMemo(() => parseRawHeaders(text), [text])

  const detectedType = useMemo(() => detectSourceType(headers), [headers])
  const [sourceType, setSourceType] = useState(() => defaultSourceType || detectedType || '')

  // proposedMappings from autoMapper (source-column direction)
  const proposedMappings = useMemo(
    () => autoMapColumns(headers, sampleRows, sourceType || null),
    [headers, sampleRows, sourceType]
  )

  // Inverted: { [canonicalFieldId]: { headerIdx, confidence, suggestedUnit } }
  const invertedProposals = useMemo(() => invertProposals(proposedMappings), [proposedMappings])

  // User overrides: { [canonicalFieldId]: headerIdx }
  // -1 = user explicitly cleared a field; undefined = use auto-proposed
  const [fieldToHeaderOverrides, setFieldToHeaderOverrides] = useState({})

  // Unit selections: { [canonicalFieldId]: unitKey }
  const [unitSelections, setUnitSelections] = useState({})

  const [loadMappingError, setLoadMappingError] = useState(null)
  const loadMappingInputRef = useRef(null)

  const activeFieldIds = useMemo(() => {
    const groups = SOURCE_FIELD_GROUPS[sourceType] || []
    const grouped = groups
      .flatMap(g => g.fields)
      .filter(fid => {
        const field = FIELD_REGISTRY[fid]
        return field && (!sourceType || !field.sources || field.sources.includes(sourceType))
      })

    const includeNglComp = sourceType === 'gpt'
      ? Array.from(NGL_COMP_FIELD_IDS).filter(fid => {
          const field = FIELD_REGISTRY[fid]
          return field && (!field.sources || field.sources.includes('gpt'))
        })
      : []

    if (sourceType === 'gpt') {
      return Array.from(new Set([...grouped, ...includeNglComp]))
    }

    const defined = new Set([...grouped, ...Array.from(NGL_COMP_FIELD_IDS)])
    const ungrouped = Object.entries(FIELD_REGISTRY)
      .filter(([fid, field]) => {
        if (defined.has(fid)) return false
        if (sourceType && field.sources && !field.sources.includes(sourceType)) return false
        return true
      })
      .map(([fid]) => fid)

    return Array.from(new Set([...grouped, ...ungrouped]))
  }, [sourceType])

  const handleSourceTypeChange = useCallback((newType) => {
    setSourceType(newType)
    setFieldToHeaderOverrides({})
    setUnitSelections({})
  }, [])

  // Effective field → header index (merges overrides on top of auto-proposals)
  const effectiveFieldToHeader = useMemo(() => {
    const result = {}
    for (const fieldId of activeFieldIds) {
      result[fieldId] = fieldToHeaderOverrides[fieldId] !== undefined
        ? fieldToHeaderOverrides[fieldId]
        : (invertedProposals[fieldId]?.headerIdx ?? -1)
    }
    return result
  }, [activeFieldIds, invertedProposals, fieldToHeaderOverrides])

  // Confidence for display (manual if user overrode, else auto-proposed confidence)
  const fieldConfidence = useMemo(() => {
    const result = {}
    for (const fieldId of activeFieldIds) {
      if (fieldToHeaderOverrides[fieldId] !== undefined) {
        result[fieldId] = fieldToHeaderOverrides[fieldId] >= 0 ? 'manual' : 'null'
      } else {
        result[fieldId] = invertedProposals[fieldId]?.confidence ?? 'null'
      }
    }
    return result
  }, [activeFieldIds, invertedProposals, fieldToHeaderOverrides])

  // Stats: count of fields with a valid source column assigned
  const stats = useMemo(() => {
    let mapped = 0, unmapped = 0
    for (const fieldId of activeFieldIds) {
      if (effectiveFieldToHeader[fieldId] >= 0) mapped++
      else unmapped++
    }
    return { mapped, unmapped }
  }, [activeFieldIds, effectiveFieldToHeader])

  const handleFieldHeaderChange = useCallback((fieldId, headerIdx) => {
    setFieldToHeaderOverrides(prev => ({ ...prev, [fieldId]: Number(headerIdx) }))
  }, [])

  const handleUnitChange = useCallback((fieldId, unitKey) => {
    setUnitSelections(prev => ({ ...prev, [fieldId]: unitKey }))
  }, [])

  // Get effective current unit for a field
  const getUnit = useCallback((fieldId) => {
    return unitSelections[fieldId]
      || invertedProposals[fieldId]?.suggestedUnit
      || null
  }, [unitSelections, invertedProposals])

  // Get sample values for a given header index
  const getSamples = useCallback((headerIdx) => {
    if (headerIdx < 0 || headerIdx >= headers.length) return []
    return sampleRows
      .map(r => r[headerIdx])
      .filter(v => v != null && String(v).trim() !== '')
      .slice(0, 3)
  }, [headers, sampleRows])

  // ── Export mapping to CSV ────────────────────────────────────────────────────
  const handleSaveMapping = useCallback(() => {
    const esc = v => {
      const s = v == null ? '' : String(v)
      return (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? `"${s.replace(/"/g, '""')}"` : s
    }
    const cols = ['Source Type', 'Canonical Field ID', 'Label', 'Source Column', 'Unit']
    const dataRows = []
    for (const [fieldId, headerIdx] of Object.entries(effectiveFieldToHeader)) {
      if (headerIdx < 0) continue
      const field = FIELD_REGISTRY[fieldId]
      if (!field) continue
      const sourceCol = headers[headerIdx] || ''
      if (!sourceCol) continue
      const unit = unitSelections[fieldId] || invertedProposals[fieldId]?.suggestedUnit || ''
      dataRows.push([sourceType || '', fieldId, field.label, sourceCol, unit])
    }
    if (!dataRows.length) return
    const csv = [cols.map(esc).join(','), ...dataRows.map(r => r.map(esc).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `${sourceType || 'field'}_mapping.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }, [effectiveFieldToHeader, sourceType, unitSelections, invertedProposals, headers])

  // ── Import mapping from CSV ──────────────────────────────────────────────────
  const handleLoadMappingFile = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoadMappingError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const result = Papa.parse(
          (ev.target.result || '').replace(/^\uFEFF/, ''),
          { header: true, skipEmptyLines: true }
        )
        const rows = result.data || []
        if (!rows.length) throw new Error('Mapping file appears empty.')

        const fileSourceType = (rows[0]['Source Type'] || '').trim()
        if (fileSourceType) setSourceType(fileSourceType)

        // Build header lookup (first-occurrence wins for duplicates)
        const byExact = {}; const byLower = {}
        headers.forEach((h, idx) => {
          if (byExact[h] === undefined) byExact[h] = idx
          const lo = h.trim().toLowerCase()
          if (byLower[lo] === undefined) byLower[lo] = idx
        })

        const newOverrides = {}; const newUnits = {}
        let matched = 0; const unmatched = []

        for (const row of rows) {
          const canonicalFieldId = (row['Canonical Field ID'] || '').trim()
          const rawLabel         = (row['Source Column']      || '').trim()
          const unit             = (row['Unit']               || '').trim()
          if (!canonicalFieldId || !rawLabel) continue

          const exactIdx = byExact[rawLabel] !== undefined ? byExact[rawLabel] : -1
          const lowerIdx = byLower[rawLabel.trim().toLowerCase()] !== undefined
            ? byLower[rawLabel.trim().toLowerCase()] : -1
          const idx = exactIdx >= 0 ? exactIdx : lowerIdx

          if (idx >= 0) {
            newOverrides[canonicalFieldId] = idx
            if (unit) newUnits[canonicalFieldId] = unit
            matched++
          } else {
            unmatched.push(rawLabel)
          }
        }

        setFieldToHeaderOverrides(newOverrides)
        setUnitSelections(newUnits)

        if (unmatched.length) {
          setLoadMappingError(
            `${matched} field(s) restored. ${unmatched.length} source column(s) not found in this file: ` +
            `${unmatched.slice(0, 5).join(', ')}${unmatched.length > 5 ? '…' : ''}`
          )
        }
      } catch (err) {
        setLoadMappingError(`Could not load mapping: ${err.message}`)
      }
      e.target.value = ''
    }
    reader.onerror = () => setLoadMappingError('Failed to read mapping file.')
    reader.readAsText(file)
  }, [headers])

  // ── Confirm ──────────────────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    const columnMap = {}; const unitOverrides = {}
    for (const fieldId of activeFieldIds) {
      const headerIdx = effectiveFieldToHeader[fieldId]
      if (headerIdx >= 0) {
        columnMap[fieldId] = headerIdx
        const unit = unitSelections[fieldId] || invertedProposals[fieldId]?.suggestedUnit
        if (unit) unitOverrides[fieldId] = unit
      }
    }
    onConfirm({ sourceType, columnMap, unitOverrides, text })
  }, [activeFieldIds, effectiveFieldToHeader, sourceType, unitSelections, invertedProposals, text, onConfirm])

  if (!headers.length) {
    return (
      <div className="border border-red-200 rounded p-4 bg-red-50 text-red-700 text-sm">
        Could not read CSV headers from "{filename}". Make sure the file is a valid CSV.
      </div>
    )
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  // Build the header dropdown options (first option = "Not in this file")
  const headerOptions = [
    { value: -1, label: '— Not in this file —' },
    ...headers.map((h, idx) => ({ value: idx, label: h || `(column ${idx + 1})` })),
  ]

  // Render a single field row
  function FieldRow({ fieldId, altBg }) {
    const field = FIELD_REGISTRY[fieldId]
    if (!field) return null
    const headerIdx = effectiveFieldToHeader[fieldId] ?? -1
    const conf = fieldConfidence[fieldId]
    const samples = getSamples(headerIdx)
    const unitChoiceKeys = field.canonicalUnit ? UNIT_CHOICES[field.canonicalUnit] : null
    const hasUnitChoice = unitChoiceKeys && unitChoiceKeys.length > 1
    const currentUnit = getUnit(fieldId) || (unitChoiceKeys ? unitChoiceKeys[0] : null)

    return (
      <tr className={altBg ? 'bg-gray-50/40' : 'bg-white'}>
        {/* Confidence dot */}
        <td className="px-2 py-1.5 text-center w-6">
          <ConfDot conf={conf} />
        </td>
        {/* Field label */}
        <td className="px-3 py-1.5 text-[11px] font-medium text-gray-800 max-w-[180px]">
          {field.label}
          {field.required?.[sourceType] && <span className="text-red-500 ml-1">*</span>}
        </td>
        {/* Source column dropdown */}
        <td className="px-2 py-1.5">
          <select
            value={headerIdx}
            onChange={e => handleFieldHeaderChange(fieldId, e.target.value)}
            className={`w-full text-[11px] border rounded px-1.5 py-1 bg-white focus:outline-none
              focus:border-[#1F3864] ${headerIdx >= 0 ? 'border-gray-200' : 'border-gray-100 text-gray-400'}`}
          >
            {headerOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </td>
        {/* Unit selector */}
        <td className="px-2 py-1.5 w-28">
          {hasUnitChoice ? (
            <select
              value={currentUnit || ''}
              onChange={e => handleUnitChange(fieldId, e.target.value)}
              className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-1 bg-white
                focus:border-[#1F3864] focus:outline-none"
            >
              {unitChoiceKeys.map(key => (
                <option key={key} value={key}>{UNIT_OPTIONS[key]?.label ?? key}</option>
              ))}
            </select>
          ) : field.canonicalUnit ? (
            <span className="text-[10px] text-gray-400">{field.canonicalUnit}</span>
          ) : null}
        </td>
        {/* Sample values */}
        <td className="px-3 py-1.5 text-[10px] text-gray-400 max-w-[140px] truncate">
          {samples.length ? samples.join(', ') : <span className="italic">—</span>}
        </td>
      </tr>
    )
  }

  // Build field groups for the current source type
  const definedGroups = SOURCE_FIELD_GROUPS[sourceType] || []
  const definedFieldIds = new Set([
    ...definedGroups.flatMap(g => g.fields),
    ...Array.from(NGL_COMP_FIELD_IDS),
  ])

  // "Other" group: relevant fields not explicitly grouped
  const otherFields = sourceType === 'gpt'
    ? []
    : Object.entries(FIELD_REGISTRY)
      .filter(([fid, f]) => {
        if (definedFieldIds.has(fid)) return false
        if (sourceType && f.sources && !f.sources.includes(sourceType)) return false
        return true
      })
      .map(([fid]) => fid)

  // NGL component fields relevant to GPT
  const showNglCompSection = sourceType === 'gpt'

  return (
    <div className="border border-gray-200 rounded bg-white overflow-hidden">

      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800 truncate">{filename}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">{headers.length} columns detected · {stats.mapped} field(s) mapped</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <label className="text-xs text-gray-600 font-medium">Source type:</label>
          <select
            value={sourceType}
            onChange={e => handleSourceTypeChange(e.target.value)}
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
          >
            <option value="">— Select type —</option>
            {Object.entries(DATA_SOURCES).map(([id, ds]) => (
              <option key={id} value={id}>{ds.label}</option>
            ))}
          </select>

          <label
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-dashed
              border-gray-300 text-xs font-semibold text-gray-500 cursor-pointer transition-colors
              hover:border-gray-400 hover:text-gray-700"
            title="Load a previously saved column mapping (.csv)"
          >
            <input ref={loadMappingInputRef} type="file" accept=".csv" className="hidden" onChange={handleLoadMappingFile} />
            ↓ Import Mapping CSV
          </label>

          <button
            onClick={handleSaveMapping}
            disabled={stats.mapped === 0}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-semibold
              text-gray-600 hover:text-gray-900 hover:border-gray-400 transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed"
            title="Download current mapping as .csv to reuse later"
          >
            Export Mapping to CSV
          </button>
        </div>
      </div>

      {/* Load mapping error banner */}
      {loadMappingError && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-start justify-between gap-2">
          <p className="text-[11px] text-amber-800">{loadMappingError}</p>
          <button onClick={() => setLoadMappingError(null)}
            className="text-amber-500 hover:text-amber-700 shrink-0 text-xs leading-none mt-0.5">✕</button>
        </div>
      )}

      {/* ── Mapping table ───────────────────────────────────────────────────── */}
      <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 w-6" />
              <th className="px-3 py-2 text-left text-gray-600 font-semibold">Project Field</th>
              <th className="px-3 py-2 text-left text-gray-600 font-semibold">Source Column (from your file)</th>
              <th className="px-2 py-2 text-left text-gray-600 font-semibold w-28">Unit</th>
              <th className="px-3 py-2 text-left text-gray-600 font-semibold">Sample Values</th>
            </tr>
          </thead>
          <tbody>
            {/* ── Source-type defined groups ─────────────────────────────── */}
            {definedGroups.map(group => {
              const groupFields = group.fields.filter(fid => {
                const f = FIELD_REGISTRY[fid]
                return f && (!sourceType || !f.sources || f.sources.includes(sourceType))
              })
              if (!groupFields.length) return null
              return (
                <React.Fragment key={group.label}>
                  <tr className="bg-[#1F3864]/5 border-t border-b border-[#1F3864]/10">
                    <td colSpan={5} className="px-3 py-1.5 text-[10px] font-bold text-[#1F3864] uppercase tracking-wider">
                      {group.label}
                    </td>
                  </tr>
                  {groupFields.map((fid, i) => <FieldRow key={fid} fieldId={fid} altBg={i % 2 !== 0} />)}
                </React.Fragment>
              )
            })}

            {/* ── Other (ungrouped relevant fields) ─────────────────────── */}
            {otherFields.length > 0 && (
              <React.Fragment>
                <tr className="bg-gray-100 border-t border-b border-gray-200">
                  <td colSpan={5} className="px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Other</td>
                </tr>
                {otherFields.map((fid, i) => <FieldRow key={fid} fieldId={fid} altBg={i % 2 !== 0} />)}
              </React.Fragment>
            )}

            {/* ── NGL Component grid (GPT only) ──────────────────────────── */}
            {showNglCompSection && (
              <React.Fragment>
                <tr className="bg-[#548235]/10 border-t border-b border-[#548235]/20">
                  <td colSpan={5} className="px-3 py-1.5 text-[10px] font-bold text-[#548235] uppercase tracking-wider">
                    NGL Components
                    <span className="ml-2 font-normal text-gray-500 normal-case">
                      Theoretical → Allocated → Contract % → After-POP Gal · Price · Value
                    </span>
                  </td>
                </tr>
                {NGL_COMPONENTS.map(comp => (
                  <React.Fragment key={comp.id}>
                    <tr className="bg-[#548235]/5">
                      <td colSpan={5} className="px-4 py-1 text-[10px] font-semibold text-[#548235]">
                        {comp.label} <span className="text-gray-400 font-normal">({comp.abbr})</span>
                      </td>
                    </tr>
                    {NGL_COMPONENT_FIELD_SUFFIXES.map((sf, i) => (
                      <FieldRow key={`${comp.id}${sf.suffix}`} fieldId={`${comp.id}${sf.suffix}`} altBg={i % 2 !== 0} />
                    ))}
                  </React.Fragment>
                ))}
              </React.Fragment>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-[10px] text-gray-400">
          ● exact auto-match &nbsp;◐ partial &nbsp;○ low-confidence &nbsp;✎ manual &nbsp;— unmatched
          &nbsp;·&nbsp; * required field
        </p>
        <div className="flex items-center gap-2">
          <button onClick={onCancel}
            className="text-xs px-3 py-1.5 border border-gray-300 rounded text-gray-600 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={!sourceType}
            className="text-xs px-4 py-1.5 rounded font-semibold transition-colors
              bg-[#1F3864] text-white hover:bg-[#162a4e]
              disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed">
            Confirm Mapping →
          </button>
        </div>
      </div>
    </div>
  )
}
