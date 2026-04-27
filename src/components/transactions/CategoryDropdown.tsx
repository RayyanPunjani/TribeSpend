import { useState, useRef, useEffect } from 'react'
import { CATEGORIES, CATEGORY_COLORS } from '@/utils/categories'

interface Props {
  value: string
  onChange: (category: string) => void
  compact?: boolean
}

export default function CategoryDropdown({ value, onChange, compact }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const color = CATEGORY_COLORS[value] ?? '#94a3b8'

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-full border transition-colors hover:opacity-80 ${
          compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
        }`}
        style={{
          backgroundColor: color + '22',
          borderColor: color + '55',
          color,
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        {value}
        <span className="text-current opacity-50">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-card-md p-1 min-w-48 max-h-64 overflow-y-auto animate-slide-in">
          {CATEGORIES.map((cat) => {
            const c = CATEGORY_COLORS[cat] ?? '#94a3b8'
            return (
              <button
                key={cat}
                type="button"
                onClick={() => { onChange(cat); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs hover:bg-slate-50 flex items-center gap-2 transition-colors ${
                  cat === value ? 'bg-slate-50 font-medium' : ''
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c }} />
                {cat}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
