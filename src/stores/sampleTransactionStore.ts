import { createContext, createElement, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type SampleFlag = 'recurring' | 'reimbursement' | 'return' | 'hidden' | 'notes'
export type SampleReturnStatus = 'expected' | 'review' | 'completed'

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

export interface SampleReimbursementDetails {
  person: string
  amount: number
  note: string
  paid: boolean
}

export interface SampleReturnDetails {
  amount: number
  note: string
  status: SampleReturnStatus
}

export const SAMPLE_TRANSACTIONS: SampleTransaction[] = [
  {
    id: 'sample_1',
    date: 'May 1',
    merchant: 'Streaming Bundle',
    description: 'Monthly entertainment subscription',
    category: 'Entertainment',
    card: 'Example Card',
    person: 'Rayyan',
    amount: 46.99,
  },
  {
    id: 'sample_2',
    date: 'Apr 28',
    merchant: 'Urban Cafe',
    description: 'Group dinner with friends',
    category: 'Dining',
    card: 'Example Card',
    person: 'Nada',
    amount: 84.2,
  },
  {
    id: 'sample_3',
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

export interface SampleTransactionState {
  transactions: SampleTransaction[]
  flags: SampleFlags
  notes: Record<string, string>
  reimbursements: Record<string, SampleReimbursementDetails>
  returns: Record<string, SampleReturnDetails>
  toggleFlag: (id: string, flag: SampleFlag) => void
  toggleRecurring: (id: string) => void
  toggleHidden: (id: string) => void
  setNote: (id: string, note: string) => void
  setReimbursement: (id: string, details: SampleReimbursementDetails) => void
  clearReimbursement: (id: string) => void
  setReturn: (id: string, details: SampleReturnDetails) => void
  clearReturn: (id: string) => void
}

const SampleTransactionContext = createContext<SampleTransactionState | null>(null)

export function SampleTransactionProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<SampleFlags>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [reimbursements, setReimbursements] = useState<Record<string, SampleReimbursementDetails>>({})
  const [returns, setReturns] = useState<Record<string, SampleReturnDetails>>({})

  const updateFlag = useCallback((id: string, patch: Partial<Record<SampleFlag, boolean>>) => {
    setFlags((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
      },
    }))
  }, [])

  const value = useMemo<SampleTransactionState>(() => ({
    transactions: SAMPLE_TRANSACTIONS,
    flags,
    notes,
    reimbursements,
    returns,
    toggleFlag: (id, flag) => {
      setFlags((current) => ({
        ...current,
        [id]: {
          ...current[id],
          [flag]: !current[id]?.[flag],
        },
      }))
    },
    toggleRecurring: (id) => {
      setFlags((current) => ({
        ...current,
        [id]: {
          ...current[id],
          recurring: !current[id]?.recurring,
        },
      }))
    },
    toggleHidden: (id) => {
      setFlags((current) => ({
        ...current,
        [id]: {
          ...current[id],
          hidden: !current[id]?.hidden,
        },
      }))
    },
    setNote: (id, note) => {
      setNotes((current) => ({ ...current, [id]: note }))
      updateFlag(id, { notes: note.trim().length > 0 })
    },
    setReimbursement: (id, details) => {
      setReimbursements((current) => ({ ...current, [id]: details }))
      updateFlag(id, { reimbursement: true })
    },
    clearReimbursement: (id) => {
      setReimbursements((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      updateFlag(id, { reimbursement: false })
    },
    setReturn: (id, details) => {
      setReturns((current) => ({ ...current, [id]: details }))
      updateFlag(id, { return: true })
    },
    clearReturn: (id) => {
      setReturns((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      updateFlag(id, { return: false })
    },
  }), [flags, notes, reimbursements, returns, updateFlag])

  return createElement(SampleTransactionContext.Provider, { value }, children)
}

export function useSampleTransactionStore<T>(selector: (state: SampleTransactionState) => T): T {
  const state = useContext(SampleTransactionContext)
  if (!state) {
    throw new Error('useSampleTransactionStore must be used within SampleTransactionProvider')
  }
  return selector(state)
}

export function isSampleTransactionId(id: string): boolean {
  return id.startsWith('sample_')
}
