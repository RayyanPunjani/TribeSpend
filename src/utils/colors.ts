// Default palette of soft, visually distinct colors for card/person row highlighting
// These are at full opacity — use at 15-20% opacity for row backgrounds
export const DEFAULT_PALETTE = [
  '#3b82f6', // Soft Blue
  '#10b981', // Sage Green
  '#f97316', // Warm Coral
  '#8b5cf6', // Lavender
  '#eab308', // Pale Gold
  '#06b6d4', // Mint Teal
  '#f43f5e', // Soft Rose
  '#14b8a6', // Light Teal
  '#fb923c', // Peach
  '#64748b', // Light Slate
  '#a78bfa', // Light Purple
  '#22c55e', // Fresh Green
]

/**
 * Given a hex color like "#3b82f6", return a CSS rgba string at the given opacity.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Return a style object with background color at 18% opacity.
 */
export function cardRowStyle(color: string): React.CSSProperties {
  return { backgroundColor: hexToRgba(color, 0.14) }
}

/**
 * Return the next available default color (cycle through palette).
 */
export function nextColor(usedColors: string[]): string {
  for (const color of DEFAULT_PALETTE) {
    if (!usedColors.includes(color)) return color
  }
  // If all used, cycle
  return DEFAULT_PALETTE[usedColors.length % DEFAULT_PALETTE.length]
}
