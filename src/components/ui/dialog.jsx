import React from 'react'
import { createPortal } from 'react-dom'

// Minimal dialog implementation used by EventsPage
export const Dialog = ({ open, onOpenChange, children }) => {
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => {
          if (typeof onOpenChange === 'function') onOpenChange()
        }}
      />
      <div className="relative z-10 w-full max-w-4xl px-4">{children}</div>
    </div>,
    document.body
  )
}

export const DialogContent = ({ children, className = '' }) => {
  return (
    // max-h y overflow para que el contenido (formulario) no expanda todo el viewport
    <div className={`mx-auto bg-boreal-dark rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-auto ${className}`}>
      {children}
    </div>
  )
}

export const DialogHeader = ({ children }) => <div className="mb-4">{children}</div>

export const DialogTitle = ({ children, className = '' }) => (
  <h3 className={`text-2xl font-bold ${className}`}>{children}</h3>
)

export const DialogDescription = ({ children, className = '' }) => (
  <div className={`text-gray-300 ${className}`}>{children}</div>
)

export const DialogFooter = ({ children }) => (
  <div className="mt-6 flex items-center justify-end space-x-3">{children}</div>
)

export const DialogClose = ({ children, onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-2 rounded-md hover:bg-white/5 ${className}`}
  >
    {children}
  </button>
)

export default Dialog
