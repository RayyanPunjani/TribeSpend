export function chunkText(text: string, size = 50000): string[] {
  if (size <= 0) return [text]
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size))
  }
  return chunks.length > 0 ? chunks : ['']
}
