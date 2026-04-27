import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm text-parchment/70 font-fantasy tracking-wide uppercase">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`bg-dark border ${error ? 'border-ember' : 'border-dark-border'} text-parchment px-3 py-2 text-sm focus:outline-none focus:border-gold placeholder-parchment/30 ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-ember">{error}</p>}
    </div>
  )
}
