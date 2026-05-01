export function buildCardDisplayName(personName?: string | null, cardName?: string | null): string {
  const person = personName?.trim() || 'Account'
  const card = cardName?.trim() || 'Card'
  return `${person}'s ${card}`
}
