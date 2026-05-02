import { create } from 'zustand'

export type SampleFlag = 'recurring' | 'reimbursement' | 'return' | 'hidden' | 'notes'

export type SampleTransaction = {
  id: string
  date: string
  merchant: string
  description: string
  category: string
  card: string
  person: string
  amount: number
}

export const SAMPLE_TRANSACTIONS: SampleTransaction[] = [
  {
    id: 'sample-streaming',
    date: 'May 1',
    merchant: 'Streaming Bundle',
    description: 'Monthly entertainment subscription',
    category: 'Entertainment',
    card: 'Example Card',
    person: 'Rayyan',
    amount: 46.99,
  },
  {
    id: 'sample-dinner',
    date: 'Apr 28',
    merchant: 'Urban Cafe',
    description: 'Group dinner with friends',
    category: 'Dining',
    card: 'Example Card',
    person: 'Nada',
    amount: 84.2,
  },
  {
    id: 'sample-headphones',
    date: 'Apr 24',
    merchant: 'Headphones Store',
    description: 'Return expected after drop-off',
    category: 'Shopping',
    card: 'Example Card',
    person: 'Rayyan',
    amount: 129,
  },
]

type SampleFlags = Record<string, Partial<Record<SampleFlag, boolean>>>

interface SampleTransactionState {
  transactions: SampleTransaction[]
  flags: SampleFlags
  notes: Record<string, string>
  toggleFlag: (id: string, flag: SampleFlag) => void
  setNote: (id: string, note: string) => void
}

export const useSampleTransactionStore = create<SampleTransactionState>((set) => ({
  transactions: SAMPLE_TRANSACTIONS,
  flags: {},
  notes: {},
  toggleFlag: (id, flag) => set((state) => ({
    flags: {
      ...state.flags,
      [id]: {
        ...state.flags[id],
        [flag]: !state.flags[id]?.[flag],
      },
    },
  })),
  setNote: (id, note) => set((state) => ({
    notes: {
      ...state.notes,
      [id]: note,
    },
  })),
}))
