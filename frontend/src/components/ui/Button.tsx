import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
}

export function Button({ variant = 'primary', loading, children, disabled, className = '', ...props }: ButtonProps) {
  const base = 'px-4 py-2 font-fantasy text-sm tracking-wider uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-ember hover:bg-ember-dark text-parchment',
    secondary: 'border border-gold text-gold hover:bg-dark-hover',
    ghost: 'text-parchment/60 hover:text-parchment',
    danger: 'bg-red-900 hover:bg-red-800 text-parchment border border-red-700',
  }
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? '...' : children}
    </button>
  )
}
