interface Props {
  start: string
  end: string
  onStartChange: (val: string) => void
  onEndChange: (val: string) => void
}

export default function DateRangePicker({ start, end, onStartChange, onEndChange }: Props) {
  return (
    <div className="flex gap-2 items-center">
      <input
        type="date"
        value={start}
        onChange={(e) => onStartChange(e.target.value)}
        className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
      />
      <span className="text-slate-400 text-sm">to</span>
      <input
        type="date"
        value={end}
        onChange={(e) => onEndChange(e.target.value)}
        className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
      />
    </div>
  )
}
