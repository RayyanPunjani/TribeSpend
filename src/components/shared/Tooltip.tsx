import type { ReactNode } from 'react'

interface Props {
  text: string
  children: ReactNode
  side?: 'top' | 'bottom'
}

export default function Tooltip({ text, children, side = 'bottom' }: Props) {
  return (
    <span className="relative group inline-flex items-center">
      {children}
      <span
        className={`
          absolute left-1/2 -translate-x-1/2 whitespace-nowrap
          px-1.5 py-0.5 rounded bg-slate-800 text-white text-[10px] leading-snug
          pointer-events-none z-[100] select-none
          opacity-0 group-hover:opacity-100 transition-opacity duration-100 delay-300
          ${side === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'}
        `}
        role="tooltip"
      >
        {text}
      </span>
    </span>
  )
}
