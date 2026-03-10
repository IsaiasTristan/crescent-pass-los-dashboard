import React, { useState, useMemo } from 'react'
import { CHART_COLORS as C, ARIES_INPUT_FIELDS } from '../../constants/losMapping.js'
import { parseAriesImport } from '../../export/exportCsv.js'
import { exportInputs } from '../../export/exportCsv.js'
import { safeAvg } from '../../charts/chartConfig.jsx'

export function InputsTab({ ariesInputs, setAriesInputs, monthlyRollup }) {
  const [importStatus, setImportStatus] = useState(null)
  const [importMsg,    setImportMsg]    = useState('')
  const [importDrag,   setImportDrag]   = useState(false)

  const hAvgs = useMemo(() => {
    if (!monthlyRollup.length) return {}
    const out = {}
    ARIES_INPUT_FIELDS.forEach(f => { if (f.histKey) out[f.key] = safeAvg(monthlyRollup, f.histKey) })
    return out
  }, [monthlyRollup])

  const onImportFile = file => {
    if (!file) return
    const r = new FileReader()
    r.onload = e => {
      try {
        const parsed = parseAriesImport(e.target.result)
        setAriesInputs(parsed)
        setImportStatus('ok')
        setImportMsg(`Loaded inputs from ${file.name}`)
        setTimeout(() => setImportStatus(null), 4000)
      } catch (err) {
        setImportStatus('err')
        setImportMsg(err.message)
        setTimeout(() => setImportStatus(null), 6000)
      }
    }
    r.onerror = () => {
      setImportStatus('err')
      setImportMsg('Failed to read file.')
      setTimeout(() => setImportStatus(null), 6000)
    }
    r.readAsText(file)
  }

  const onChange = (ct, sub, key, val) =>
    setAriesInputs(prev => ({ ...prev, [ct]: { ...prev[ct], [sub]: { ...prev[ct][sub], [key]: val } } }))

  const variance = (field, sub) => {
    const v = parseFloat(ariesInputs.vdrCase[sub][field.key])
    const m = parseFloat(ariesInputs.myCase[sub][field.key])
    if (isNaN(v) || isNaN(m)) return null
    const diff = m - v
    return { diff, pct: v !== 0 ? (diff / Math.abs(v)) * 100 : null }
  }

  const vColor = (field, varObj) => {
    if (!varObj) return '#9CA3AF'
    if (varObj.diff === 0) return '#6B7280'
    return (field.lowerIsBetter ? varObj.diff < 0 : varObj.diff > 0) ? '#059669' : '#DC2626'
  }

  const thG = { padding:'7px 10px', textAlign:'center', fontWeight:700, fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.06em', borderLeft:'1px solid #E5E7EB', whiteSpace:'nowrap' }
  const thS = { padding:'4px 10px', textAlign:'center', fontWeight:600, fontSize:'10px', color:'#9CA3AF', borderLeft:'1px solid #E5E7EB', whiteSpace:'nowrap' }
  const tdL = { padding:'10px 14px', verticalAlign:'middle', minWidth:'170px' }
  const tdI = { padding:'6px 8px',   verticalAlign:'middle', minWidth:'108px' }
  const tdV = { padding:'8px 10px',  textAlign:'right', verticalAlign:'middle', minWidth:'95px', fontSize:'12px' }
  const tdH = { padding:'8px 14px',  textAlign:'right', verticalAlign:'middle', minWidth:'110px', borderLeft:'2px solid #E5E7EB', fontSize:'12px', fontFamily:'monospace' }
  const inp = (ct, sub) => ({
    width:'100%', border:`1px solid ${ct==='myCase' ? (sub==='op' ? '#1F3864' : '#2E74B5') : '#D1D5DB'}`,
    borderRadius:'4px', padding:'5px 7px', textAlign:'right', fontSize:'12px', outline:'none', background:'white', color:'#111827',
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">ARIES Model Inputs</h2>
          <p className="text-xs text-gray-500 mt-1">
            Separate operated / non-operated assumptions. Active filter (nav bar) determines which set drives chart reference lines.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <label
            onDrop={e => { e.preventDefault(); setImportDrag(false); onImportFile(e.dataTransfer.files[0]) }}
            onDragOver={e => { e.preventDefault(); setImportDrag(true) }}
            onDragLeave={() => setImportDrag(false)}
            className={`flex items-center gap-2 px-3 py-2 rounded border border-dashed text-xs cursor-pointer transition-colors font-semibold
              ${importDrag ? 'border-[#1F3864] text-[#1F3864] bg-blue-50' : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700'}`}>
            <input type="file" accept=".csv" className="hidden" onChange={e => onImportFile(e.target.files[0])}/>
            ↓ Import Inputs CSV
          </label>
          <button onClick={() => exportInputs(ariesInputs, hAvgs)}
            className="px-4 py-2 bg-white border border-gray-300 rounded text-sm text-gray-600 hover:text-gray-900 hover:border-gray-400 transition-colors cursor-pointer font-semibold">
            Export Inputs to CSV
          </button>
        </div>
      </div>

      {importStatus === 'ok' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-700 font-semibold">
          <span>✓</span> {importMsg}
        </div>
      )}
      {importStatus === 'err' && (
        <div className="px-4 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
          <strong>Import failed:</strong> {importMsg}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded overflow-x-auto" style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
        <table style={{borderCollapse:'collapse', width:'100%', fontSize:'12px'}}>
          <thead>
            <tr style={{background:'#F9FAFB', borderBottom:'1px solid #E5E7EB'}}>
              <th style={{...thG, textAlign:'left', color:'#6B7280', borderLeft:'none', minWidth:'170px'}}>Input</th>
              <th colSpan={2} style={{...thG, background:'#F0F4FF', color:'#1F3864'}}>VDR Case</th>
              <th colSpan={2} style={{...thG, background:'#F0F4FF', color:'#1F3864', borderLeft:'2px solid #1F3864'}}>My Case</th>
              <th colSpan={2} style={{...thG, color:'#6B7280'}}>Variance (My − VDR)</th>
              <th style={{...thG, color:'#6B7280', borderLeft:'2px solid #E5E7EB'}}>Hist Avg</th>
            </tr>
            <tr style={{background:'#F9FAFB', borderBottom:'2px solid #E5E7EB'}}>
              <th style={{...thS, borderLeft:'none'}}></th>
              <th style={{...thS}}>Operated</th>
              <th style={{...thS}}>Non-Op</th>
              <th style={{...thS, borderLeft:'2px solid #1F3864'}}>Operated</th>
              <th style={{...thS}}>Non-Op</th>
              <th style={{...thS}}>Operated</th>
              <th style={{...thS}}>Non-Op</th>
              <th style={{...thS, borderLeft:'2px solid #E5E7EB', color:'#6B7280'}}>filtered avg</th>
            </tr>
          </thead>
          <tbody>
            {ARIES_INPUT_FIELDS.map((field, idx) => {
              const vOp  = variance(field, 'op')
              const vObo = variance(field, 'obo')
              const hv   = hAvgs[field.key]
              return (
                <tr key={field.key} style={{borderBottom: idx < ARIES_INPUT_FIELDS.length-1 ? '1px solid #F3F4F6' : 'none'}}
                  className="hover:bg-gray-50 transition-colors">
                  <td style={tdL}>
                    <div style={{fontWeight:600, color:'#111827', fontSize:'13px'}}>{field.label}</div>
                    <div style={{fontSize:'10px', color:'#9CA3AF', marginTop:'2px'}}>{field.unit}</div>
                  </td>
                  <td style={{...tdI, borderLeft:'1px solid #E5E7EB'}}>
                    <input type="number" step="any" placeholder="--"
                      value={ariesInputs.vdrCase.op[field.key]}
                      onChange={e => onChange('vdrCase','op',field.key,e.target.value)}
                      style={inp('vdrCase','op')}/>
                  </td>
                  <td style={{...tdI, borderLeft:'1px solid #F3F4F6'}}>
                    <input type="number" step="any" placeholder="--"
                      value={ariesInputs.vdrCase.obo[field.key]}
                      onChange={e => onChange('vdrCase','obo',field.key,e.target.value)}
                      style={inp('vdrCase','obo')}/>
                  </td>
                  <td style={{...tdI, borderLeft:'2px solid #1F3864'}}>
                    <input type="number" step="any" placeholder="--"
                      value={ariesInputs.myCase.op[field.key]}
                      onChange={e => onChange('myCase','op',field.key,e.target.value)}
                      style={inp('myCase','op')}/>
                  </td>
                  <td style={{...tdI, borderLeft:'1px solid #F3F4F6'}}>
                    <input type="number" step="any" placeholder="--"
                      value={ariesInputs.myCase.obo[field.key]}
                      onChange={e => onChange('myCase','obo',field.key,e.target.value)}
                      style={inp('myCase','obo')}/>
                  </td>
                  <td style={{...tdV, borderLeft:'1px solid #E5E7EB', color: vColor(field, vOp)}}>
                    {vOp ? (
                      <>
                        <div style={{fontWeight:700}}>{vOp.diff>0?'+':''}{vOp.diff.toFixed(2)}</div>
                        {vOp.pct!=null && <div style={{fontSize:'10px'}}>{vOp.pct>0?'+':''}{vOp.pct.toFixed(1)}%</div>}
                      </>
                    ) : <span style={{color:'#D1D5DB'}}>--</span>}
                  </td>
                  <td style={{...tdV, borderLeft:'1px solid #F3F4F6', color: vColor(field, vObo)}}>
                    {vObo ? (
                      <>
                        <div style={{fontWeight:700}}>{vObo.diff>0?'+':''}{vObo.diff.toFixed(2)}</div>
                        {vObo.pct!=null && <div style={{fontSize:'10px'}}>{vObo.pct>0?'+':''}{vObo.pct.toFixed(1)}%</div>}
                      </>
                    ) : <span style={{color:'#D1D5DB'}}>--</span>}
                  </td>
                  <td style={{...tdH}}>
                    {hv != null
                      ? <span style={{fontWeight:700, color:'#374151'}}>{field.fmt(hv)}</span>
                      : <span style={{color:'#D1D5DB', fontStyle:'italic'}}>{field.histKey===null?'N/A':'--'}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Assumption Notes</h3>
          <ul className="space-y-1.5 text-xs text-gray-500">
            <li>JP and RP fixed costs use their own rolling well counts for the monthly denominator</li>
            <li>JP and RP workover costs use gross workover cost divided by their own rolling well counts</li>
            <li>Oil unit cost uses gross oil cost divided by gross oil volume</li>
            <li>GP&amp;T uses gross GP&amp;T cost divided by gross gas volume</li>
            <li>Midstream revenue uses gross midstream cost divided by gross gas volume</li>
            <li>Variable Water uses gross water cost divided by uploaded gross water volume</li>
            <li>Production Taxes: % of gross revenue</li>
            <li>Oil differential: $/BBL vs. WTI (negative = discount)</li>
            <li>Gas differential: $/MMBTU vs. Henry Hub</li>
            <li>NGL differential: % of WTI realized (e.g., 35%)</li>
          </ul>
        </div>
        <div className="bg-white border border-gray-200 rounded p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Variance Legend</h3>
          <ul className="space-y-1.5 text-xs">
            <li className="text-emerald-600 font-semibold">Green - My Case better (lower cost / better differential)</li>
            <li className="text-red-500 font-semibold">Red - My Case worse (higher cost / worse differential)</li>
            <li className="text-gray-500">Gray - Equal values</li>
          </ul>
          <div className="mt-3 pt-3 border-t border-gray-200">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">ARIES Overlays on Charts</h3>
            <p className="text-xs text-gray-500">
              My Case: <span className="font-bold" style={{color:C.myCase}}>red dotted</span> reference lines.
              VDR Case: <span className="font-bold text-gray-500">gray dotted</span> reference lines.
              Active overlay uses the <strong>Operated</strong> column when viewing Operated wells,
              <strong> Non-Op</strong> column when viewing Non-Operated.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
