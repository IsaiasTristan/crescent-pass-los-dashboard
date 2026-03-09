// ─── Shared Recharts config and helpers ───────────────────────────────────────
// These are imported by RollupTab, WellMiniChart, and any other chart component.

import React from 'react'
import { ReferenceLine } from 'recharts'

export const fmtMoney = (n, decimals = 1) => {
  if (n == null || isNaN(n) || !isFinite(n)) return '--'
  const abs = Math.abs(Number(n)).toFixed(decimals)
  return Number(n) < 0 ? `($${abs})` : `$${abs}`
}

export const fmtMoneyScaled = (n, scale = 1, decimals = 1) => {
  if (n == null || isNaN(n) || !isFinite(n)) return '--'
  return fmtMoney(Number(n) / scale, decimals)
}

// ─── Shared chart props ───────────────────────────────────────────────────────

export const CM = { top: 30, right: 20, left: 0, bottom: 24 }

export const GP = { stroke: '#9CA3AF', strokeDasharray: '0', vertical: false }

export const AP = {
  tick:     { fill: '#111827', fontSize: 10 },
  axisLine: { stroke: '#374151' },
  tickLine: { stroke: '#374151' },
}

export const TP = {
  contentStyle: { backgroundColor: '#fff', border: '1px solid #D1D5DB', borderRadius: '4px', fontSize: '12px', color: '#111827' },
  labelStyle:   { color: '#6B7280', fontWeight: 600 },
  cursor:       { fill: 'rgba(0,0,0,0.04)' },
}

export const LP = { wrapperStyle: { fontSize: '10px', paddingTop: '4px', color: '#374151' } }

// Smaller axis/tooltip props for well mini-charts
export const WAP = {
  tick:     { fill: '#374151', fontSize: 9 },
  axisLine: { stroke: '#D1D5DB' },
  tickLine: { stroke: '#D1D5DB' },
}
export const WCM = { top: 28, right: 6, left: 0, bottom: 18 }

// ─── LabelList content factories ─────────────────────────────────────────────

// White label inside a bar segment (hidden when bar is too short)
export const segLabel = fmt => ({ x, y, width, height, value }) => {
  if (!value || !isFinite(value) || value === 0 || height < 14) return null
  return (
    <text x={x + width / 2} y={y + height / 2 + 3}
      textAnchor="middle" fill="rgba(255,255,255,0.88)" fontSize={8} fontWeight={600}>
      {fmt(value)}
    </text>
  )
}

// Dark vertical label above positive bars and below negative bars (total label)
export const topLabel = fmt => ({ x, y, width, height, value }) => {
  if (!value || !isFinite(value) || value === 0) return null
  const xPos = x + width / 2
  const barTop = Math.min(y, y + height)
  const barBottom = Math.max(y, y + height)
  const gap = value < 0 ? 8 : 7
  const yPos = value < 0 ? (barBottom + gap) : (barTop - gap)
  const angle = -90
  const anchor = value < 0 ? 'end' : 'start'
  return (
    <text x={xPos} y={yPos}
      textAnchor={anchor} fill="#374151" fontSize={9} fontWeight={700}
      transform={`rotate(${angle} ${xPos} ${yPos})`}>
      {fmt(value)}
    </text>
  )
}

// ─── Reference line helper ────────────────────────────────────────────────────
// Renders a single ReferenceLine inside a ChartCard render-prop child.
// overlays and colors come from the ChartCard callback.

export function rl(key, y, overlays, colors, fmt, label, dashArray = '5 3') {
  if (!overlays[key] || y == null || !isFinite(y)) return null
  return (
    <ReferenceLine
      key={key} y={y}
      stroke={colors[key]}
      strokeDasharray={dashArray}
      strokeWidth={1.5}
      label={{
        value:     `${label}: ${fmt ? fmt(y) : y}`,
        fill:      colors[key],
        fontSize:  8,
        fontWeight: 700,
        position:  key === 'vdr' ? 'insideBottomRight' : 'insideTopRight',
      }}
    />
  )
}

// ─── Auto unit scaler ─────────────────────────────────────────────────────────
// pref: 'auto' | 'MBoed' | 'Boed' | 'MMcfd' | 'Mcfd' | '$MM' | '$M' | '$'
// maxVal: peak raw value in the data series
// Returns { label, tickFmt, segFmt, labelFmt }

export function smartUnit(type, pref, maxVal) {
  if (type === 'prod') {
    const useM  = pref === 'MBoed' || (pref === 'auto' && maxVal >= 300)
    const label = useM ? 'MBoed' : 'Boed'
    const tf    = useM ? n => (n / 1000).toFixed(2) : n => n.toFixed(1)
    const lf    = useM ? n => `${(n / 1000).toFixed(2)} MBoed` : n => `${n.toFixed(1)} Boed`
    return { label, tickFmt: tf, segFmt: tf, labelFmt: lf }
  }
  if (type === 'gas') {
    const useM  = pref === 'MMcfd' || (pref === 'auto' && maxVal >= 300)
    const label = useM ? 'MMcfd' : 'Mcfd'
    const tf    = useM ? n => (n / 1000).toFixed(2) : n => n.toFixed(1)
    const lf    = useM ? n => `${(n / 1000).toFixed(2)} MMcfd` : n => `${n.toFixed(1)} Mcfd`
    return { label, tickFmt: tf, segFmt: tf, labelFmt: lf }
  }
  if (type === 'cost') {
    const useMM = pref === '$MM' || (pref === 'auto' && maxVal >= 500000)
    const useM  = !useMM && (pref === '$M' || (pref === 'auto' && maxVal >= 5000))
    const label = useMM ? '$MM' : useM ? '$M' : '$'
    const tf = useMM
      ? n => fmtMoneyScaled(n, 1e6, 1)
      : useM
        ? n => fmtMoneyScaled(n, 1e3, 0)
        : n => fmtMoney(n, 0)
    return { label, tickFmt: tf, segFmt: tf, labelFmt: tf }
  }
  const fallback = n => n.toFixed(1)
  return { label: '', tickFmt: fallback, segFmt: fallback, labelFmt: fallback }
}

// ─── LTM average builder ──────────────────────────────────────────────────────

export function buildLTM(data, key) {
  if (!data || !data.length) return null
  const recent = data.slice(-12)
  const vals   = recent.map(d => d[key]).filter(v => v != null && isFinite(v))
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

// ─── General helpers shared across chart components ───────────────────────────

export function safeAvg(arr, key) {
  const vals = arr.map(d => d[key]).filter(v => v != null && isFinite(v) && v !== 0)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}
