import { DEFAULT_PALETTE } from '@/utils/colors'
import { useState } from 'react'
import { Check } from 'lucide-react'

interface Props {
  value: string
  onChange: (color: string) => void
}

export default function ColorPicker({ value, onChange }: Props) {
  const [customInput, setCustomInput] = useState('')

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {DEFAULT_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center"
          style={{
            backgroundColor: color,
            borderColor: value === color ? '#1e293b' : 'transparent',
          }}
          title={color}
        >
          {value === color && <Check size={12} className="text-white drop-shadow" />}
        </button>
      ))}

      {/* Custom color input */}
      <label className="relative cursor-pointer">
        <div
          className="w-7 h-7 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center hover:border-slate-400 transition-colors text-slate-400 text-xs"
          style={
            !DEFAULT_PALETTE.includes(value)
              ? { backgroundColor: value, borderColor: '#1e293b', borderStyle: 'solid' }
              : {}
          }
        >
          {!DEFAULT_PALETTE.includes(value) && value ? (
            <Check size={12} className="text-white drop-shadow" />
          ) : (
            '+'
          )}
        </div>
        <input
          type="color"
          className="sr-only"
          value={value || '#3b82f6'}
          onChange={(e) => {
            setCustomInput(e.target.value)
            onChange(e.target.value)
          }}
        />
      </label>
    </div>
  )
}
