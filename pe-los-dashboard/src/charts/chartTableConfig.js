function isFiniteNumber(value) {
  return value != null && Number.isFinite(value)
}

function rowValue(row, key) {
  if (!key) return null
  const value = row?.[key]
  return isFiniteNumber(value) ? value : null
}

export function buildMonthlyChartTable(data, config) {
  if (!data?.length || !config?.valueKey) return null

  const parts = config.parts || []
  const rows = data.map((row, index) => {
    const out = {
      __rowKey: `${row.monthKey || 'row'}-${index}`,
      monthDisp: row.monthDisp,
      monthKey: row.monthKey,
    }
    parts.forEach(part => {
      out[part.key] = rowValue(row, part.key)
    })
    out[config.valueKey] = rowValue(row, config.valueKey)
    return out
  })

  return {
    title: config.title || 'Chart Data',
    columns: [
      { key: 'monthDisp', label: 'Month', align: 'left', formatter: v => v || '--' },
      { key: 'monthKey', label: 'Month Key', align: 'left', formatter: v => v || '--' },
      ...parts.map(part => ({
        key: part.key,
        label: part.label,
        align: part.align || 'right',
        formatter: part.formatter,
      })),
      {
        key: config.valueKey,
        label: config.valueLabel || 'Result',
        align: 'right',
        formatter: config.valueFormatter,
        emphasis: true,
      },
    ],
    rows,
  }
}

export function buildWellChartTableConfig(typeDef) {
  if (!typeDef) return null

  if (typeDef.chartType === 'boeStackD') {
    return {
      title: 'Chart Data',
      valueKey: 'netBOEd',
      valueLabel: 'Total',
      valueFormatter: typeDef.fmt,
      parts: [
        { key: 'netOild', label: 'Oil', formatter: v => `${v.toFixed(1)} Bopd` },
        { key: 'netNGLd', label: 'NGL', formatter: v => `${v.toFixed(1)} Bbl/d` },
        { key: 'netGasBOEd', label: 'Gas In BOE', formatter: v => `${v.toFixed(1)} Boed` },
      ],
    }
  }

  if (typeDef.chartType === 'boeStackM') {
    return {
      title: 'Chart Data',
      valueKey: 'netBOE',
      valueLabel: 'Total',
      valueFormatter: typeDef.fmt,
      parts: [
        { key: 'oil_vol', label: 'Oil', formatter: v => `${v.toFixed(0)} Bbl` },
        { key: 'ngl_vol', label: 'NGL', formatter: v => `${v.toFixed(0)} Bbl` },
        { key: 'netGasBOE', label: 'Gas In BOE', formatter: v => `${v.toFixed(0)} BOE` },
      ],
    }
  }

  if (typeDef.chartType === 'grossBoeStackD') {
    return {
      title: 'Chart Data',
      valueKey: 'grossBOEd',
      valueLabel: 'Total',
      valueFormatter: typeDef.fmt,
      parts: [
        { key: 'grossOild', label: 'Oil', formatter: v => `${v.toFixed(1)} Bopd` },
        { key: 'grossNGLd', label: 'NGL', formatter: v => `${v.toFixed(1)} Bbl/d` },
        { key: 'grossGasBOEd', label: 'Gas In BOE', formatter: v => `${v.toFixed(1)} Boed` },
      ],
    }
  }

  if (typeDef.chartType === 'grossBoeStackM') {
    return {
      title: 'Chart Data',
      valueKey: 'grossBOE',
      valueLabel: 'Total',
      valueFormatter: typeDef.fmt,
      parts: [
        { key: 'gross_oil', label: 'Oil', formatter: v => `${v.toFixed(0)} Bbl` },
        { key: 'gross_ngl', label: 'NGL', formatter: v => `${v.toFixed(0)} Bbl` },
        { key: 'grossGasBOE', label: 'Gas In BOE', formatter: v => `${v.toFixed(0)} BOE` },
      ],
    }
  }

  if (typeDef.chartType === 'costStack') {
    return {
      title: 'Chart Data',
      valueKey: 'totalLOS',
      valueLabel: 'Total LOS',
      valueFormatter: typeDef.fmt,
      parts: [
        { key: 'var_oil', label: 'Var Oil', formatter: v => `$${(v / 1e6).toFixed(2)} MM` },
        { key: 'var_water', label: 'Water', formatter: v => `$${(v / 1e6).toFixed(2)} MM` },
        { key: 'totalFixed', label: 'Fixed + Workover', formatter: v => `$${(v / 1e6).toFixed(2)} MM` },
        { key: 'gpt', label: 'GP&T', formatter: v => `$${(v / 1e6).toFixed(2)} MM` },
        { key: 'prod_taxes', label: 'Taxes', formatter: v => `$${(v / 1e6).toFixed(2)} MM` },
      ],
    }
  }

  return {
    title: 'Chart Data',
    valueKey: typeDef.pk,
    valueLabel: typeDef.tableLabel || typeDef.label,
    valueFormatter: typeDef.fmt,
    parts: typeDef.tableParts || [],
  }
}
