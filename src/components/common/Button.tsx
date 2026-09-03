import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

const variants = {
  primary:
    'bg-duo-green text-white border-b-[3px] border-duo-green-dark shadow-[0_12px_32px_-10px_rgba(88,204,2,0.4)] hover:brightness-110 active:scale-[0.97] disabled:opacity-50 disabled:shadow-none disabled:active:scale-100',
  secondary:
    'bg-surface-700 text-surface-50 border-b-[3px] border-surface-900 hover:bg-surface-600 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100',
  danger:
    'bg-danger text-white border-b-[3px] border-red-700 hover:brightness-110 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100',
  ghost:
    'bg-transparent text-surface-200 hover:bg-surface-800 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100',
}

const sizes = {
  sm: 'rounded-lg px-4 py-2 text-sm',
  md: 'rounded-xl px-5 py-2.5 text-sm',
  lg: 'rounded-xl px-6 py-3.5 text-base',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`font-bold transition-[transform,opacity,filter] duration-150 ease-[var(--ease-out)] ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
