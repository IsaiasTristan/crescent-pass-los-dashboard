import React, { useState, useMemo } from 'react'
import { buildLOSCatData } from '../../selectors/buildRollups.js'
import { RECURRING_LOE_NAMES, KNOWN_BUCKETS } from '../../constants/losMapping.js'
import { daysInMonth, GAS_BOE } from '../../domain/metrics.js'

export function LOSTableTab({ rawRows, wellData }) {
  const [selWell,  setSelWell]  = useState('__all__')
  const [mode,     setMode]     = useState('net')
  const [perBoe,   setPerBoe]   = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  const wellNames = useMemo(() => (wellData || []).map(w => w.wellName).sort(), [wellData])

  const tableRows = useMemo(() => {
    if (!rawRows) return []
    return selWell === '__all__' ? rawRows : rawRows.filter(r => r.wellName === selWell)
  }, [rawRows, selWell])

  const { months, catMap } = useMemo(
    () => buildLOSCatData(tableRows, mode === 'gross'),
    [tableRows, mode]
  )

  const visibleMonths = useMemo(() => {
    let ms = months
    if (dateFrom) ms = ms.filter(m => m.key >= dateFrom)
    if (dateTo)   ms = ms.filter(m => m.key <= dateTo)
    return ms
  }, [months, dateFrom, dateTo])

  const ltmMonths = useMemo(() => visibleMonths.slice(-12), [visibleMonths])

  if (!rawRows || !rawRows.length) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
      No data loaded -- upload a CSV to view the LOS table.
    </div>
  )

  const byCat = bucket => Object.entries(catMap)
    .filter(([, v]) => v.bucket === bucket)
    .sort(([a], [b]) => a.localeCompare(b))

  const oilCats  = byCat('oil')
  const gasCats  = byCat('gas')
  const nglCats  = byCat('ngl')
  const directLoeCats = Object.entries(catMap)
    .filter(([los, v]) => ['variable_oil','variable_water','fixed'].includes(v.bucket) && !RECURRING_LOE_NAMES.has(los))
    .sort(([a], [b]) => a.localeCompare(b))
  const recurringLoeCats = Object.entries(catMap)
    .filter(([los]) => RECURRING_LOE_NAMES.has(los))
    .sort(([a], [b]) => a.localeCompare(b))
  const workoverCats  = byCat('workover')
  const midstreamCats = byCat('midstream')
  const gptCats       = byCat('gpt')
  const prodTaxCats   = byCat('prod_taxes')
  const capexCats     = byCat('capex')
  const unknownCats   = Object.entries(catMap)
    .filter(([los, v]) => !KNOWN_BUCKETS.has(v.bucket) && !RECURRING_LOE_NAMES.has(los))
    .sort(([a], [b]) => a.localeCompare(b))

  const sumAmt = (cats, mk) => cats.reduce((s, [, v]) => s + (v.months[mk]?.amount || 0), 0)
  const sumVol = (cats, mk) => cats.reduce((s, [, v]) => s + (v.months[mk]?.volume || 0), 0)
  const gasVol       = mk => sumVol(gasCats, mk)
  const oilVol       = mk => sumVol(oilCats, mk)
  const nglVol       = mk => sumVol(nglCats, mk)
  const totalBOE     = mk => oilVol(mk) + nglVol(mk) + gasVol(mk) / GAS_BOE
  const boed         = mk => { const mo = months.find(m => m.key === mk); return mo ? totalBOE(mk) / daysInMonth(mo.date) : 0 }
  const gasRev       = mk => sumAmt(gasCats, mk)
  const oilRev       = mk => sumAmt(oilCats, mk)
  const nglRev       = mk => sumAmt(nglCats, mk)
  const totalRev     = mk => gasRev(mk) + oilRev(mk) + nglRev(mk)
  const directLoeTot    = mk => sumAmt(directLoeCats, mk)
  const recurringLoeTot = mk => directLoeTot(mk) + sumAmt(recurringLoeCats, mk)
  const midstreamTot    = mk => sumAmt(midstreamCats, mk)
  const totalOpex       = mk => recurringLoeTot(mk) + sumAmt(workoverCats, mk) + midstreamTot(mk) + sumAmt(gptCats, mk) + sumAmt(prodTaxCats, mk)
  const capexTot        = mk => sumAmt(capexCats, mk)
  const unknownTot      = mk => sumAmt(unknownCats, mk)
  const opMargin        = mk => totalRev(mk) - totalOpex(mk)
  const assetFCF        = mk => opMargin(mk) - capexTot(mk) - unknownTot(mk)

  const avg = fn => {
    const vals = ltmMonths.map(m => fn(m.key)).filter(v => v != null && isFinite(v) && v !== 0)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }

  const bw = fn => perBoe ? mk => { const b = totalBOE(mk); return b > 0 ? fn(mk) / b : 0 } : fn

  const fV  = n => n > 0 ? Math.round(n).toLocaleString('en-US') : '--'
  const fBd = n => n > 0 ? n.toFixed(2) : '--'
  const fM  = n => {
    if (!n || !isFinite(n)) return '--'
    if (perBoe) return `$${Math.abs(n).toFixed(2)}`
    const abs = Math.round(Math.abs(n)).toLocaleString('en-US')
    return n < 0 ? `($${abs})` : `$${abs}`
  }
  const fDol = fM

  const sH   = { background:'#1F3864', color:'white', fontWeight:700, fontSize:'11px', padding:'6px 10px', textAlign:'right', whiteSpace:'nowrap', borderRight:'1px solid #2E4A7A' }
  const sH1  = { ...sH, textAlign:'left', position:'sticky', left:0, zIndex:2, minWidth:'220px' }
  const sTd  = { padding:'4px 8px', textAlign:'right', fontSize:'11px', whiteSpace:'nowrap', borderRight:'1px solid #F3F4F6', color:'#374151' }
  const sL1  = { ...sTd, textAlign:'left', position:'sticky', left:0, zIndex:1, borderRight:'1px solid #E5E7EB', minWidth:'220px', paddingLeft:'20px', color:'#111827' }
  const sSb  = { padding:'5px 8px', textAlign:'right', fontSize:'11px', fontWeight:700, whiteSpace:'nowrap', background:'#EBF0F8', color:'#1F3864', borderRight:'1px solid #C5D5E8' }
  const sSb1 = { ...sSb, textAlign:'left', position:'sticky', left:0, zIndex:1, paddingLeft:'10px', minWidth:'220px' }
  const sTt  = { padding:'5px 8px', textAlign:'right', fontSize:'11px', fontWeight:700, whiteSpace:'nowrap', background:'#1F3864', color:'white', borderRight:'1px solid #2E4A7A' }
  const sTt1 = { ...sTt, textAlign:'left', position:'sticky', left:0, zIndex:1, paddingLeft:'10px', minWidth:'220px' }
  const sGn  = { padding:'5px 8px', textAlign:'right', fontSize:'11px', fontWeight:700, whiteSpace:'nowrap', background:'#548235', color:'white', borderRight:'1px solid #3e6126' }
  const sGn1 = { ...sGn, textAlign:'left', position:'sticky', left:0, zIndex:1, paddingLeft:'10px', minWidth:'220px' }
  const sAvg  = { borderLeft:'5px solid #CBD5E1', borderRight:'none' }
  const sAvgS = { borderLeft:'5px solid #93B4D4', borderRight:'none' }
  const sAvgT = { borderLeft:'5px solid #162C54', borderRight:'none' }
  const sAvgG = { borderLeft:'5px solid #2A5220', borderRight:'none' }
  const sSpc  = { height:'5px', background:'#F1F5F9' }
  const sSecLabel = { position:'sticky', left:0, zIndex:1, padding:'10px 10px 3px', fontWeight:700, fontSize:'11px', color:'#111827', background:'white', borderRight:'1px solid #E5E7EB', minWidth:'220px', whiteSpace:'nowrap' }
  const sSecCell  = { background:'white', borderRight:'1px solid #F3F4F6', padding:0 }

  let ri = 0
  const alt = () => { ri++; return ri % 2 === 0 ? '#F9FAFB' : '#FFFFFF' }

  const rHdr = label => (
    <tr key={'h-'+label}>
      <td style={sSecLabel}>{label}</td>
      {visibleMonths.map(m => <td key={m.key} style={sSecCell}/>)}
      <td style={{...sSecCell, borderRight:'none'}}/>
    </tr>
  )
  const rRow = (label, fn, fmt, opts={}) => {
    const bg = opts.bg !== undefined ? opts.bg : alt()
    const a  = avg(fn)
    return (
      <tr key={'r-'+label} style={{background:bg}}>
        <td style={{...sL1, background:bg, paddingLeft: opts.ni ? '10px' : '20px', fontWeight: opts.bold ? 700 : 400}}>{label}</td>
        {visibleMonths.map(m => {
          const v = fn(m.key)
          return <td key={m.key} style={{...sTd, background:bg, fontWeight: opts.bold ? 700 : 400}}>{fmt(v)}</td>
        })}
        <td style={{...sTd, ...sAvg, background:bg, fontWeight:700, color:'#1F3864'}}>{a != null ? fmt(a) : '--'}</td>
      </tr>
    )
  }
  const rSub = (label, fn, fmt) => {
    const a = avg(fn)
    return (
      <tr key={'s-'+label}>
        <td style={sSb1}>{label}</td>
        {visibleMonths.map(m => <td key={m.key} style={sSb}>{fmt(fn(m.key))}</td>)}
        <td style={{...sSb, ...sAvgS}}>{a != null ? fmt(a) : '--'}</td>
      </tr>
    )
  }
  const rTot = (label, fn, fmt) => {
    const a = avg(fn)
    return (
      <tr key={'t-'+label}>
        <td style={sTt1}>{label}</td>
        {visibleMonths.map(m => <td key={m.key} style={sTt}>{fmt(fn(m.key))}</td>)}
        <td style={{...sTt, ...sAvgT}}>{a != null ? fmt(a) : '--'}</td>
      </tr>
    )
  }
  const rMargin = (label, fn, fmt) => {
    const a = avg(fn)
    return (
      <tr key={'m-'+label}>
        <td style={sGn1}>{label}</td>
        {visibleMonths.map(m => <td key={m.key} style={sGn}>{fmt(fn(m.key))}</td>)}
        <td style={{...sGn, ...sAvgG}}>{a != null ? fmt(a) : '--'}</td>
      </tr>
    )
  }
  const rSpc = k => (
    <tr key={'sp-'+k} style={sSpc}>
      <td style={{...sSpc, position:'sticky', left:0}}/>
      {visibleMonths.map(m => <td key={m.key} style={sSpc}/>)}
      <td style={sSpc}/>
    </tr>
  )

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-gray-900">LOS Statement {perBoe ? '($/BOE)' : '($)'}</h2>
            <p className="text-xs text-gray-500 mt-1">
              {selWell === '__all__' ? `${wellNames.length} wells — Portfolio Total` : selWell} | {visibleMonths.length}{visibleMonths.length < months.length ? ` of ${months.length}` : ''} months | LTM Avg = last {ltmMonths.length} months
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 font-semibold whitespace-nowrap">View:</label>
              <select value={selWell} onChange={e => setSelWell(e.target.value)}
                className="px-3 py-1.5 bg-white border-2 border-[#1F3864] rounded text-xs text-[#1F3864] font-bold outline-none cursor-pointer"
                style={{maxWidth:'240px'}}>
                <option value="__all__">Portfolio Total</option>
                {wellNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div style={{display:'flex', borderRadius:'4px', overflow:'hidden', border:'2px solid #1F3864'}}>
              {['net','gross'].map(m => (
                <button key={m} onClick={() => setMode(m)}
                  style={{ padding:'6px 16px', fontSize:'11px', fontWeight:700, cursor:'pointer', border:'none',
                    background: mode===m ? '#1F3864' : 'white', color: mode===m ? 'white' : '#1F3864', transition:'all 0.15s' }}>
                  {m === 'net' ? 'Net' : 'Gross'}
                </button>
              ))}
            </div>
            <div style={{display:'flex', borderRadius:'4px', overflow:'hidden', border:'2px solid #C55A11'}}>
              {[{v:false,label:'$'},{v:true,label:'$/BOE'}].map(o => (
                <button key={String(o.v)} onClick={() => setPerBoe(o.v)}
                  style={{ padding:'6px 14px', fontSize:'11px', fontWeight:700, cursor:'pointer', border:'none',
                    background: perBoe===o.v ? '#C55A11' : 'white', color: perBoe===o.v ? 'white' : '#C55A11', transition:'all 0.15s' }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {months.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap px-1">
            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">Period:</span>
            <select value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{padding:'4px 8px', fontSize:'11px', border:'1px solid #D1D5DB', borderRadius:'4px', background:'white', color:'#374151', outline:'none', cursor:'pointer'}}>
              <option value="">Earliest</option>
              {months.map(m => <option key={m.key} value={m.key}>{m.disp}</option>)}
            </select>
            <span className="text-xs text-gray-400">→</span>
            <select value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{padding:'4px 8px', fontSize:'11px', border:'1px solid #D1D5DB', borderRadius:'4px', background:'white', color:'#374151', outline:'none', cursor:'pointer'}}>
              <option value="">Latest</option>
              {months.map(m => <option key={m.key} value={m.key}>{m.disp}</option>)}
            </select>
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo('') }}
                style={{padding:'4px 10px', fontSize:'11px', fontWeight:600, border:'1px solid #D1D5DB', borderRadius:'4px', background:'white', color:'#6B7280', cursor:'pointer'}}>
                Reset
              </button>
            )}
            <span className="text-xs text-gray-400">|</span>
            <span className="text-xs text-gray-400">LTM Avg uses last {ltmMonths.length} month{ltmMonths.length !== 1 ? 's' : ''} shown</span>
          </div>
        )}
      </div>

      <div style={{overflowX:'auto', border:'1px solid #E5E7EB', borderRadius:'4px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
        <table style={{borderCollapse:'collapse', fontSize:'11px', width:'100%', tableLayout:'auto'}}>
          <thead>
            <tr style={{background:'#1F3864'}}>
              <th style={{...sH1, padding:'8px 10px'}}>{selWell === '__all__' ? 'Portfolio Total' : selWell}</th>
              {visibleMonths.map(m => <th key={m.key} style={{...sH, padding:'8px 10px', minWidth:'76px'}}>{m.disp}</th>)}
              <th style={{...sH, ...sAvgT, padding:'8px 10px', minWidth:'80px'}}>LTM Avg</th>
            </tr>
          </thead>
          <tbody>
            {rHdr('Volumes')}
            {rRow('Gas (MCF)',           gasVol,  fV)}
            {rRow('Oil (BBL)',           oilVol,  fV)}
            {rRow('NGL (BBL)',           nglVol,  fV)}
            {rSub('Total Volumes (BOE)', totalBOE, fV)}
            {rRow('Daily Rate (BOE/d)',  boed,    fBd, {bg:'#F9FAFB'})}
            {rSpc('v')}

            {rHdr('Revenues')}
            {rRow('Gas', bw(gasRev), fDol)}
            {rRow('Oil', bw(oilRev), fDol)}
            {rRow('NGL', bw(nglRev), fDol)}
            {rSub('Total Revenues', bw(totalRev), fDol)}
            {rSpc('r')}

            {rHdr('Direct LOE')}
            {directLoeCats.map(([los, v]) => rRow(los, bw(mk => v.months[mk]?.amount || 0), fDol))}
            {rSub('Total Direct LOE', bw(directLoeTot), fDol)}
            {rSpc('dl')}

            {recurringLoeCats.length > 0 && rHdr('Recurring LOE')}
            {recurringLoeCats.map(([los, v]) => rRow(los, bw(mk => v.months[mk]?.amount || 0), fDol))}
            {recurringLoeCats.length > 0 && rSub('Total Recurring LOE', bw(recurringLoeTot), fDol)}
            {recurringLoeCats.length > 0 && rSpc('rl')}

            {rHdr('Other Operating Expenses')}
            {workoverCats.map(([los, v]) =>  rRow(los, bw(mk => v.months[mk]?.amount || 0), fDol))}
            {midstreamCats.map(([los, v]) => rRow(los, bw(mk => v.months[mk]?.amount || 0), fM))}
            {gptCats.map(([los, v]) =>       rRow(los, bw(mk => v.months[mk]?.amount || 0), fDol))}
            {prodTaxCats.map(([los, v]) =>   rRow(los, bw(mk => v.months[mk]?.amount || 0), fDol))}
            {rTot('Total Operating Expenses', bw(totalOpex), fDol)}
            {rSpc('oe')}

            {rMargin('Operating Margin', bw(opMargin), fM)}
            {rSpc('om')}

            {capexCats.length > 0 && rHdr('CAPEX')}
            {capexCats.map(([los, v]) => rRow(los, bw(mk => v.months[mk]?.amount || 0), fDol))}
            {capexCats.length > 0 && rSub('Total CAPEX', bw(capexTot), fDol)}
            {capexCats.length > 0 && rSpc('cx')}

            {unknownCats.length > 0 && rHdr('Other Midstream')}
            {unknownCats.map(([los, v]) => rRow(los, bw(mk => v.months[mk]?.amount || 0), fDol))}
            {unknownCats.length > 0 && rSpc('unk')}

            {rMargin('Asset Free Cash Flow', bw(assetFCF), fM)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
