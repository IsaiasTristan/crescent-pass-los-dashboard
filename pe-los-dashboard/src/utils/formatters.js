// ─── Shared display formatters ────────────────────────────────────────────────
// All functions return a string (or '--' for null/NaN/non-finite).

export const fD    = n => (n == null || isNaN(n)) ? '--' : n.toFixed(0)
export const fD1   = n => (n == null || isNaN(n)) ? '--' : n.toFixed(1)
export const fK    = n => (n == null || isNaN(n)) ? '--' : `$${(n / 1000).toFixed(0)}K`
export const f$    = n => (n == null || isNaN(n)) ? '--' : (Number(n) < 0 ? `($${Math.abs(Number(n)).toLocaleString('en-US', { maximumFractionDigits: 0 })})` : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`)
export const fB    = n => (n == null || isNaN(n)) ? '--' : (Number(n) < 0 ? `($${Math.abs(Number(n)).toFixed(2)})` : `$${Number(n).toFixed(2)}`)
export const fP    = n => (n == null || isNaN(n)) ? '--' : `${Number(n).toFixed(2)}%`
export const fG    = n => (n == null || isNaN(n)) ? '--' : (Number(n) < 0 ? `($${Math.abs(Number(n)).toFixed(3)})` : `$${Number(n).toFixed(3)}`)
export const fG1   = n => (n == null || isNaN(n)) ? '--' : (Number(n) < 0 ? `($${Math.abs(Number(n)).toFixed(1)})` : `$${Number(n).toFixed(1)}`)
export const fG2   = n => (n == null || isNaN(n)) ? '--' : (Number(n) < 0 ? `($${Math.abs(Number(n)).toFixed(2)})` : `$${Number(n).toFixed(2)}`)
export const fBoed = n => (n == null || isNaN(n) || !isFinite(n)) ? '--' : n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const fMcfd = n => (n == null || isNaN(n) || !isFinite(n)) ? '--' : n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const fMdol = n => (n == null || isNaN(n) || !isFinite(n)) ? '--' : (Number(n) < 0 ? `($${Math.abs(Number(n) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })})` : `$${(Number(n) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`)
