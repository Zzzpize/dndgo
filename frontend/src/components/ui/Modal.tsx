'use client'

import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-dark-card border border-dark-border p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="heading-fantasy text-xl">{title}</h2>
          <button onClick={onClose} className="text-parchment/40 hover:text-parchment text-xl leading-none">✕</button>
        </div>
        <hr className="divider-gold mb-4" />
        {children}
      </div>
    </div>
  )
}
