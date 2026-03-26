import type { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  color?: string
  variant?: 'solid' | 'outline'
}

export function Badge({ children, color = '#D4894A', variant = 'solid' }: BadgeProps) {
  if (variant === 'outline') {
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border"
        style={{ borderColor: color, color }}
      >
        {children}
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: color + '20', color }}
    >
      {children}
    </span>
  )
}
