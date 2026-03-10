import React, { useState } from 'react'
import { ChartDataTable } from './ChartDataTable.jsx'

export function ChartCard({ title, children, ltmAvg, ltm6Avg, ltmFmt, hasVdrMy, detailTable }) {
  const [yMin, setYMin] = useState('')
  const [yMax, setYMax] = useState('')
  const [showYCtrl, setShowYCtrl] = useState(false)
  const [showOverlayMenu, setShowOverlayMenu] = useState(false)
  const [showDataTable, setShowDataTable] = useState(false)
  const [overlays, setOverlays] = useState({ vdr: true, my: true, ltm: true, ltm6: true })
  const [colors, setColors] = useState({ vdr: '#000000', my: '#C55A11', ltm: '#9CA3AF', ltm6: '#6B7280' })

  const hasCustomY = yMin !== '' || yMax !== ''
  const domain = [
    yMin !== '' && !isNaN(+yMin) ? +yMin : dataMin => (dataMin < 0 ? Math.floor(dataMin * 1.55) : 0),
    yMax !== '' && !isNaN(+yMax) ? +yMax : dataMax => Math.ceil(dataMax * 1.55),
  ]

  const toggle = (key, val) => setOverlays(prev => ({ ...prev, [key]: val }))
  const setCol = (key, val) => setColors(prev => ({ ...prev, [key]: val }))

  const CtrlBtn = ({ label, active, hilite, onClick }) => (
    <button
      onClick={onClick}
      style={{
        padding: '1px 7px',
        fontSize: '9px',
        fontWeight: 700,
        cursor: 'pointer',
        border: '1px solid',
        borderRadius: '3px',
        flexShrink: 0,
        transition: 'all 0.12s',
        background: hilite ? '#EFF6FF' : active ? '#F3F4F6' : 'white',
        color: hilite ? '#1F3864' : active ? '#374151' : '#9CA3AF',
        borderColor: hilite ? '#1F3864' : active ? '#9CA3AF' : '#E5E7EB',
      }}
    >
      {label}
    </button>
  )

  const overlayRows = [
    { key: 'ltm', label: 'LTM 12mo Avg' },
    { key: 'ltm6', label: 'LTM 6mo Avg' },
    ...(hasVdrMy ? [{ key: 'vdr', label: 'VDR Case' }, { key: 'my', label: 'My Case' }] : []),
  ]

  return (
    <div className="bg-white border border-gray-200 rounded p-4 flex flex-col" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div className="mb-1.5 flex-shrink-0 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-900 leading-tight">{title}</h3>
        <div className="flex items-center gap-1 flex-shrink-0">
          <CtrlBtn
            label="Lines"
            active={showOverlayMenu}
            hilite={false}
            onClick={() => {
              setShowOverlayMenu(v => !v)
              setShowYCtrl(false)
              setShowDataTable(false)
            }}
          />
          {detailTable?.rows?.length > 0 && (
            <CtrlBtn
              label="Data"
              active={showDataTable}
              hilite={showDataTable}
              onClick={() => {
                setShowDataTable(v => !v)
                setShowYCtrl(false)
                setShowOverlayMenu(false)
              }}
            />
          )}
          <CtrlBtn
            label="Y Axis"
            active={showYCtrl}
            hilite={hasCustomY}
            onClick={() => {
              setShowYCtrl(v => !v)
              setShowOverlayMenu(false)
              setShowDataTable(false)
            }}
          />
        </div>
      </div>

      {showOverlayMenu && (
        <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded" style={{ fontSize: '10px' }}>
          <div className="font-bold text-gray-400 uppercase tracking-wider mb-1.5">Reference Lines</div>
          {overlayRows.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2 mb-1">
              <input
                type="checkbox"
                checked={overlays[key]}
                onChange={e => toggle(key, e.target.checked)}
                style={{ cursor: 'pointer', flexShrink: 0 }}
              />
              <span className="text-gray-600 flex-1 select-none">{label}</span>
              <input
                type="color"
                value={colors[key]}
                title="Line color"
                onChange={e => setCol(key, e.target.value)}
                style={{
                  width: '22px',
                  height: '16px',
                  padding: 0,
                  border: '1px solid #D1D5DB',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {showYCtrl && (
        <div className="mb-2 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-gray-500 font-semibold">Y-axis:</span>
          <input
            type="number"
            step="any"
            placeholder="min"
            value={yMin}
            onChange={e => setYMin(e.target.value)}
            style={{ width: '68px', border: '1px solid #D1D5DB', borderRadius: '3px', padding: '2px 5px', fontSize: '11px', outline: 'none', color: '#374151' }}
          />
          <span className="text-[10px] text-gray-400">-</span>
          <input
            type="number"
            step="any"
            placeholder="max"
            value={yMax}
            onChange={e => setYMax(e.target.value)}
            style={{ width: '68px', border: '1px solid #D1D5DB', borderRadius: '3px', padding: '2px 5px', fontSize: '11px', outline: 'none', color: '#374151' }}
          />
          {hasCustomY ? (
            <button
              onClick={() => {
                setYMin('')
                setYMax('')
              }}
              style={{ padding: '2px 8px', fontSize: '10px', fontWeight: 600, border: '1px solid #D1D5DB', borderRadius: '3px', background: 'white', color: '#6B7280', cursor: 'pointer' }}
            >
              Reset
            </button>
          ) : (
            <span className="text-[10px] text-gray-400">blank = auto</span>
          )}
        </div>
      )}

      <div style={{ height: '224px', flexShrink: 0 }}>
        {typeof children === 'function' ? children(domain, overlays, colors) : children}
      </div>

      {((ltmAvg != null && isFinite(ltmAvg)) || (ltm6Avg != null && isFinite(ltm6Avg))) && (
        <div className="mt-2 pt-1.5 border-t border-gray-100 space-y-1">
          {ltmAvg != null && isFinite(ltmAvg) && (
            <div className="flex items-center justify-between">
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>LTM 12mo Avg</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151' }}>{ltmFmt ? ltmFmt(ltmAvg) : ltmAvg}</span>
            </div>
          )}
          {ltm6Avg != null && isFinite(ltm6Avg) && (
            <div className="flex items-center justify-between">
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>LTM 6mo Avg</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151' }}>{ltmFmt ? ltmFmt(ltm6Avg) : ltm6Avg}</span>
            </div>
          )}
        </div>
      )}

      {showDataTable && <ChartDataTable table={detailTable} />}
    </div>
  )
}
