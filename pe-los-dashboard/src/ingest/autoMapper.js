// ─── Auto-mapping engine ──────────────────────────────────────────────────────
// Given raw CSV headers (and optional sample rows), proposes a canonical field
// mapping using three-level matching: exact alias → contains → Levenshtein ≤ 2.
// Also detects the likely source type from header composition.

import { FIELD_REGISTRY, FIELD_ALIASES, SOURCE_TYPE_SIGNALS } from '../constants/fieldRegistry.js'

export function normalizeHeader(value) {
  return (value || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Levenshtein distance (edit distance) between two strings.
function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    prev.splice(0, prev.length, ...curr)
  }
  return prev[b.length]
}

// Build a Map<normalizedAlias, canonicalFieldId> for the given source type.
// If sourceTypeId is null, includes all fields from all sources.
function buildAliasLookup(sourceTypeId) {
  const lookup = new Map()
  for (const [fieldId, aliases] of Object.entries(FIELD_ALIASES)) {
    const field = FIELD_REGISTRY[fieldId]
    if (!field) continue
    if (sourceTypeId && field.sources && !field.sources.includes(sourceTypeId)) continue
    for (const alias of aliases) {
      const norm = normalizeHeader(alias)
      if (norm && !lookup.has(norm)) lookup.set(norm, fieldId)
    }
  }
  return lookup
}

// Returns the canonical field ID and confidence for a single normalized header.
// confidence: 'exact' | 'high' | 'low' | null
function matchHeader(norm, lookup) {
  if (!norm) return { canonicalFieldId: null, confidence: null }

  // Level 1: exact normalized alias match
  if (lookup.has(norm)) {
    return { canonicalFieldId: lookup.get(norm), confidence: 'exact' }
  }

  // Level 2: contains-match (alias substring of header or vice versa)
  // Require minimum length of 3 to avoid spurious short matches.
  for (const [aliasNorm, fieldId] of lookup) {
    if (aliasNorm.length >= 3 && norm.length >= 3) {
      if (norm.includes(aliasNorm) || aliasNorm.includes(norm)) {
        return { canonicalFieldId: fieldId, confidence: 'high' }
      }
    }
  }

  // Level 3: Levenshtein distance ≤ 2 against all known aliases
  let bestFieldId = null
  let bestDist = Infinity
  for (const [aliasNorm, fieldId] of lookup) {
    // Skip if length difference is too large — avoids expensive calculations
    if (Math.abs(norm.length - aliasNorm.length) > 4) continue
    const dist = levenshtein(norm, aliasNorm)
    if (dist <= 2 && dist < bestDist) {
      bestDist = dist
      bestFieldId = fieldId
    }
  }
  if (bestFieldId) {
    return { canonicalFieldId: bestFieldId, confidence: 'low' }
  }

  return { canonicalFieldId: null, confidence: null }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Proposes a canonical field mapping for an array of raw CSV headers.
 *
 * @param {string[]} rawHeaders - Raw header strings from the CSV first row.
 * @param {string[][]} sampleRows - Up to 5 data rows for preview in the UI.
 * @param {string|null} sourceTypeId - 'los' | 'volumes' | 'pricing' | 'gpt' | null
 * @returns {Array<{
 *   headerIdx: number,
 *   rawLabel: string,
 *   sampleValues: string[],
 *   canonicalFieldId: string|null,
 *   confidence: 'exact'|'high'|'low'|null,
 *   suggestedUnit: string|null,
 * }>}
 */
export function autoMapColumns(rawHeaders, sampleRows, sourceTypeId) {
  const lookup = buildAliasLookup(sourceTypeId)

  return rawHeaders.map((rawLabel, headerIdx) => {
    const norm = normalizeHeader(rawLabel)
    const samples = (sampleRows || [])
      .map(r => r[headerIdx])
      .filter(v => v != null && String(v).trim() !== '')
      .slice(0, 3)
      .map(v => String(v).trim())

    const { canonicalFieldId, confidence } = matchHeader(norm, lookup)
    const field = canonicalFieldId ? FIELD_REGISTRY[canonicalFieldId] : null

    return {
      headerIdx,
      rawLabel,
      sampleValues: samples,
      canonicalFieldId,
      confidence,
      suggestedUnit: field?.canonicalUnit ?? null,
    }
  })
}

/**
 * Detects the most likely source type from a set of raw headers.
 *
 * @param {string[]} rawHeaders
 * @returns {'los'|'volumes'|'pricing'|'gpt'|null}
 */
export function detectSourceType(rawHeaders) {
  const lookup = buildAliasLookup(null)

  // Map each header to its best canonical field
  const detectedFields = new Set()
  for (const rawLabel of rawHeaders) {
    const norm = normalizeHeader(rawLabel)
    const { canonicalFieldId } = matchHeader(norm, lookup)
    if (canonicalFieldId) detectedFields.add(canonicalFieldId)
  }

  // Score each source type by how many of its signals are present
  let bestType = null
  let bestScore = 0
  for (const [sourceType, signals] of Object.entries(SOURCE_TYPE_SIGNALS)) {
    const score = signals.filter(f => detectedFields.has(f)).length
    if (score > bestScore) {
      bestScore = score
      bestType = sourceType
    }
  }

  return bestScore > 0 ? bestType : null
}

/**
 * Converts a confirmed mapping + unit override to an actual numeric value.
 * Used by parsers when applying the user-confirmed unit selection.
 *
 * @param {number|null} value - The raw parsed number.
 * @param {string|null} canonicalUnit - The field's canonical unit (from FIELD_REGISTRY).
 * @param {string|null} unitOverride - The user-selected unit (e.g. 'gallons', 'percent').
 * @returns {number|null}
 */
export function applyUnitConversion(value, canonicalUnit, unitOverride) {
  if (value == null || !isFinite(value)) return value
  if (!unitOverride || unitOverride === canonicalUnit) return value

  // Percent → decimal
  if (unitOverride === 'percent' && canonicalUnit === 'decimal') return value / 100
  // Gallons → BBL
  if (unitOverride === 'gallons' && canonicalUnit === 'BBL') return value / 42
  // CF → MCF
  if (unitOverride === 'CF' && canonicalUnit === 'MCF') return value / 1000
  // MMBTU → MCF
  if (unitOverride === 'MMBTU' && canonicalUnit === 'MCF') return value / 1.02

  return value
}

/**
 * Converts a DataSourceMapper columnMap (canonicalFieldId → colIndex) to a
 * plain { [colIndex]: canonicalFieldId } reverse lookup for display purposes.
 */
export function reverseColumnMap(columnMap) {
  const rev = {}
  for (const [fieldId, colIdx] of Object.entries(columnMap || {})) {
    if (colIdx != null) rev[colIdx] = fieldId
  }
  return rev
}
