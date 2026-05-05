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
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
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
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const rect = ref.current?.getBoundingClientRect()
      if (!rect) return
      const spaceBelow = window.innerHeight - rect.bottom - 12
      const spaceAbove = rect.top - 12
      const shouldOpenDown = spaceBelow >= 180 || spaceBelow >= spaceAbove
      const maxHeight = Math.max(160, Math.min(280, shouldOpenDown ? spaceBelow : spaceAbove))
      setMenuPosition({
        top: shouldOpenDown ? rect.bottom + 4 : Math.max(12, rect.top - maxHeight - 4),
        left: rect.left,
        width: Math.max(192, rect.width),
        maxHeight,
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
  const options = (categoryNames.includes(value) ? categoryNames : [value, ...categoryNames])
    .slice()
    .sort((a, b) => a.localeCompare(b))

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex max-w-[180px] items-center gap-1.5 rounded-full border transition-colors hover:opacity-80 ${
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
        <span className="min-w-0 truncate">{value}</span>
        <span className="text-current opacity-50">▾</span>
      </button>

      {open && menuPosition && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[300] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-card-md animate-slide-in"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            minWidth: menuPosition.width,
            maxHeight: menuPosition.maxHeight,
          }}
        >
          {options.map((cat) => {
            const c = categoryColors[cat] ?? '#94a3b8'
            return (
              <button
                key={cat}
                type="button"
                onClick={() => { onChange(cat); setOpen(false) }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs transition-colors hover:bg-slate-50 ${
                  cat === value ? 'bg-slate-50 font-medium' : ''
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c }} />
                <span className="min-w-0 truncate">{cat}</span>
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
