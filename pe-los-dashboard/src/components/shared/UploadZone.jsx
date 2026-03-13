import React, { useState } from 'react'

/**
 * Shared drag-and-drop upload zone used by every data input in the project.
 * Matches the visual style of the LOS data upload zone.
 *
 * Props:
 *   onFile     (file) => void   — called with the File object when picked/dropped
 *   title      string           — primary label, e.g. "Drop GPT statement CSV here"
 *   subtitle   string           — secondary label, e.g. "Tab or comma delimited · …"
 *   hint       string | null    — optional footer hint (shown in a pill), e.g. "Required: Date, Meter"
 *   accept     string           — file accept attribute (default ".csv,.txt,.tsv")
 *   compact    bool             — renders a small inline reload button instead of the full zone
 *   compactLabel string         — label for compact mode (default "Reload CSV")
 *   icon       ReactNode | null — override the default document-upload SVG
 */
export function UploadZone({
  onFile,
  title       = 'Drop CSV here or click to browse',
  subtitle    = '',
  hint        = null,
  accept      = '.csv,.txt,.tsv',
  compact     = false,
  compactLabel = 'Reload CSV',
}) {
  const [drag, setDrag] = useState(false)

  const onDrop = e => {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }
  const onDragOver = e => { e.preventDefault(); setDrag(true) }
  const onDragLeave = () => setDrag(false)
  const onPick = e => { if (e.target.files?.[0]) onFile(e.target.files[0]) }

  if (compact) {
    return (
      <label
        onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
        className={`flex items-center gap-2 px-3 py-1.5 rounded border border-dashed text-xs
          cursor-pointer transition-colors ${drag
          ? 'border-blue-500 text-blue-600 bg-blue-50'
          : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700'}`}
      >
        <input type="file" accept={accept} className="hidden" onChange={onPick} />
        {compactLabel}
      </label>
    )
  }

  return (
    <label
      onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
      className={`block border-2 border-dashed rounded p-12 text-center cursor-pointer
        transition-colors ${drag
        ? 'border-blue-400 bg-blue-50'
        : 'border-gray-300 hover:border-gray-400 bg-white'}`}
    >
      <input type="file" accept={accept} className="hidden" onChange={onPick} />
      <div className="flex flex-col items-center gap-4">

        {/* Upload icon */}
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-gray-400">
          <rect x="8" y="6" width="32" height="36" rx="4" stroke="currentColor" strokeWidth="2"/>
          <path d="M16 18h16M16 26h16M16 34h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="36" cy="36" r="10" fill="white" stroke="currentColor" strokeWidth="2"/>
          <path d="M36 30v12M31 35l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>

        <div>
          <p className="text-sm text-gray-700 font-semibold">{title}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>

        {hint && (
          <div className="text-[10px] text-gray-500 bg-gray-50 border border-gray-200 rounded
            px-4 py-2 leading-relaxed max-w-lg text-center">
            {hint}
          </div>
        )}
      </div>
    </label>
  )
}
