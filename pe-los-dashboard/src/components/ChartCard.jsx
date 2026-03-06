import React from 'react'

function MiniTable({ rows, formatter }) {
  if (!rows || rows.length === 0) return null
  return (
    <div className="mt-3 pt-3 border-t border-[#2a2d3a] overflow-x-auto">
      <table className="w-full text-xs">
        <tbody>
          <tr>
            <td className="text-[#4a4d5a] pr-3 pb-0.5 whitespace-nowrap">Period</td>
            {rows.map(r => (
              <td key={r.label} className="text-[#8b8fa8] text-right pb-0.5 px-2 whitespace-nowrap">
                {r.label}
              </td>
            ))}
          </tr>
          <tr>
            <td className="text-[#4a4d5a] pr-3 whitespace-nowrap">Value</td>
            {rows.map(r => (
              <td key={r.label} className="text-[#f0f0f0] text-right px-2 font-medium whitespace-nowrap">
                {formatter ? formatter(r.value) : r.value}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function buildMiniRows(data, key, formatter) {
  if (!data || data.length === 0) return []
  const last3 = data.slice(-3)
  const nonZero = data.filter(d => d[key] != null && d[key] !== 0)
  const avg = nonZero.length > 0
    ? nonZero.reduce((s, d) => s + (d[key] || 0), 0) / nonZero.length
    : 0
  return [
    ...last3.map(d => ({ label: d.monthDisplay, value: d[key] || 0 })),
    { label: 'Avg', value: avg },
  ]
}

export default function ChartCard({ title, subtitle, children, miniRows, miniFormatter }) {
  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-lg p-5 flex flex-col">
      <div className="mb-3 flex-shrink-0">
        <h3 className="text-sm font-semibold text-[#f0f0f0] leading-tight">{title}</h3>
        {subtitle && (
          <p className="text-xs text-[#8b8fa8] mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="flex-1" style={{ height: '224px' }}>
        {children}
      </div>
      {miniRows && miniRows.length > 0 && (
        <MiniTable rows={miniRows} formatter={miniFormatter} />
      )}
    </div>
  )
}
