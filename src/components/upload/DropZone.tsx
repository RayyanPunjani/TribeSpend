import { useCallback, useState } from 'react'
import { Sheet } from 'lucide-react'

interface Props {
  onFiles: (files: File[]) => void
}

export function isCsvFile(file: File) {
  return file.name.toLowerCase().endsWith('.csv')
}

export default function DropZone({ onFiles }: Props) {
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const files = Array.from(e.dataTransfer.files).filter(isCsvFile)
      if (files.length) onFiles(files)
    },
    [onFiles],
  )

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      className={`relative border-2 border-dashed rounded-2xl p-14 text-center transition-all ${
        dragging
          ? 'border-accent-500 bg-accent-50'
          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
      }`}
    >
      <div className="flex flex-col items-center gap-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
          dragging ? 'bg-accent-100' : 'bg-slate-100'
        }`}>
          <Sheet size={26} className={dragging ? 'text-accent-600' : 'text-slate-400'} />
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="text-base font-semibold text-slate-700">
            Drop your CSV statement here
          </p>
          <label className="cursor-pointer">
            <span className="text-sm text-accent-600 hover:text-accent-700 underline underline-offset-2">
              Browse files
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []).filter(isCsvFile)
                if (files.length) onFiles(files)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </div>
    </div>
  )
}
