import React from 'react'

function alignClass(align) {
  return align === 'left' ? 'text-left' : 'text-right'
}

function renderValue(value, formatter) {
  if (value == null) return '--'
  if (formatter) return formatter(value)
  if (typeof value === 'number') {
    if (!isFinite(value)) return '--'
    return value.toLocaleString('en-US')
  }
  return String(value)
}

export function ChartDataTable({ table }) {
  if (!table?.rows?.length || !table?.columns?.length) return null

  return (
    <div className="mt-2 pt-2 border-t border-gray-100">
      <div className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-2">
        {table.title || 'Chart Data'}
      </div>
      <div className="overflow-x-auto border border-gray-200 rounded">
        <table className="min-w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {table.columns.map(column => (
                <th
                  key={column.key}
                  className={`px-2 py-1.5 font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200 last:border-r-0 ${alignClass(column.align)}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={row.__rowKey || `${row.monthKey || 'row'}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                {table.columns.map(column => (
                  <td
                    key={column.key}
                    className={`px-2 py-1.5 text-gray-700 border-r border-gray-100 last:border-r-0 font-mono ${column.emphasis ? 'font-bold text-gray-900' : ''} ${alignClass(column.align)}`}
                  >
                    {renderValue(row[column.key], column.formatter)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
