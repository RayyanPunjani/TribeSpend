import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useCategoryStore } from '@/stores/categoryStore'

interface Props {
  value: string
  onChange: (category: string) => void
  compact?: boolean
}

export default function CategoryDropdown({ value, onChange, compact }: Props) {
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const categoryNames = useCategoryStore((s) => s.categoryNames)
  const categoryColors = useCategoryStore((s) => s.categoryColors)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const rect = ref.current?.getBoundingClientRect()
      if (!rect) return
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(192, rect.width),
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  const color = categoryColors[value] ?? '#94a3b8'
  const options = categoryNames.includes(value) ? categoryNames : [value, ...categoryNames]

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

      {open && menuPosition && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[300] bg-white border border-slate-200 rounded-xl shadow-card-md p-1 max-h-64 overflow-y-auto animate-slide-in"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            minWidth: menuPosition.width,
          }}
        >
          {options.map((cat) => {
            const c = categoryColors[cat] ?? '#94a3b8'
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
        </div>,
        document.body,
      )}
    </div>
  )
}
