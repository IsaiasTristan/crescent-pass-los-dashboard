import React from 'react'

export default function ExportButton({ onClick, children, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium
        bg-[#1a1d27] border border-[#2a2d3a] transition-colors
        ${disabled
          ? 'text-[#4a4d5a] cursor-not-allowed'
          : 'text-[#8b8fa8] hover:text-[#f0f0f0] hover:border-[#4a4d5a] cursor-pointer'
        }
      `}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 1v8M4 6l3 3 3-3M2 10v2a1 1 0 001 1h8a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {children}
    </button>
  )
}
