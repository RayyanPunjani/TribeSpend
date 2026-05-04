import { useEffect, useState, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { DollarSign, RefreshCw, StickyNote, AlertCircle, EyeOff, PackageOpen, Undo2 } from 'lucide-react'
import type { Transaction, CreditCard, Person } from '@/types'
import { formatDate, formatAmount } from '@/utils/formatters'
import { hexToRgba } from '@/utils/colors'
import CategoryDropdown from './CategoryDropdown'
import ReimbursementPopover from './ReimbursementPopover'
import ExpectedReturnPopover from './ExpectedReturnPopover'
import Tooltip from '@/components/shared/Tooltip'
import { useTransactionStore } from '@/stores/transactionStore'
import { useCardStore } from '@/stores/cardStore'
import { usePersonStore } from '@/stores/personStore'
import { isReviewCategory } from '@/utils/categoryFallback'

interface Props {
  transaction: Transaction
  card?: CreditCard
  person?: Person
  selectionControl?: ReactNode
  onRuleChange: (transaction: Transaction, change: PendingRuleChange) => void
}

type OpenPopover = 'reimb' | 'return' | 'note' | null
export type PendingRuleChange = {
  category?: string
  cardId?: string
  personId?: string
  cardholderName?: string
}

export default function TransactionRow({ transaction: t, card, person, selectionControl, onRuleChange }: Props) {
  const { update, transactions } = useTransactionStore()
  const { cards } = useCardStore()
  const { persons } = usePersonStore()
  const [openPopover, setOpenPopover] = useState<OpenPopover>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [noteText, setNoteText] = useState(t.notes ?? '')
  const [showHideConfirm, setShowHideConfirm] = useState(false)

  const reimbBtnRef = useRef<HTMLButtonElement>(null)
  const returnBtnRef = useRef<HTMLButtonElement>(null)
  const noteBtnRef = useRef<HTMLButtonElement>(null)

  const openWith = (name: OpenPopover, ref: RefObject<HTMLButtonElement | null>) => {
    if (openPopover === name) { setOpenPopover(null); return }
    const rect = ref.current?.getBoundingClientRect() ?? null
    setAnchorRect(rect)
    setOpenPopover(name)
  }

  const closeAll = () => setOpenPopover(null)

  const rowColor = card?.color ?? person?.color ?? '#94a3b8'
  const bgStyle = t.deleted
    ? { backgroundColor: 'rgba(148,163,184,0.08)' }
    : t.isPayment || t.isCredit
    ? { backgroundColor: hexToRgba('#22c55e', 0.10) }
    : t.expectingReturn && t.returnStatus === 'pending'
    ? { backgroundColor: hexToRgba('#a855f7', 0.08) }
    : { backgroundColor: hexToRgba(rowColor, 0.13) }

  const handleCategoryChange = (newCat: string) => {
    if (newCat === t.category) return
    onRuleChange(t, { category: newCat })
  }

  const handleCardChange = (cardId: string) => {
    if (cardId === t.cardId) return
    onRuleChange(t, { cardId })
  }

  const handlePersonChange = (personId: string) => {
    if (personId === (t.personId ?? '')) return
    const nextPerson = persons.find((p) => p.id === personId)
    onRuleChange(t, {
      personId,
      cardholderName: nextPerson?.name ?? '',
    })
  }

  const saveNote = async () => {
    await update(t.id, { notes: noteText || undefined })
    closeAll()
  }

  const handleHide = async () => {
    await update(t.id, { deleted: true })
    setShowHideConfirm(false)
  }

  const handleUnhide = async () => {
    await update(t.id, { deleted: false })
  }

  const isNeedsReview = isReviewCategory(t.category)
  const textClass = t.deleted ? 'opacity-45 grayscale' : ''
  const hasDistinctPostDate = Boolean(t.postDate) && t.postDate !== t.transDate
  const popoverOpensUp = anchorRect
    ? anchorRect.top > (typeof window === 'undefined' ? 0 : window.innerHeight * 0.55)
    : false
  const linkedRefundOriginal = t.refundForId
    ? transactions.find((tx) => tx.id === t.refundForId)
    : undefined
  const cardColor = card?.color ?? '#94a3b8'
  const cardLabel = card
    ? card.isPaymentMethod || !card.lastFour ? card.name : `...${card.lastFour}`
    : 'No card'
  const personLabel = person?.name ?? t.cardholderName ?? 'Unassigned'
  const personDotColor = person?.color ?? '#94a3b8'

  useEffect(() => {
    if (!openPopover) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [openPopover])

  return (
    <>
      <tr
        style={bgStyle}
        className={`border-b border-slate-100 hover:brightness-95 transition-all ${
          isNeedsReview && !t.deleted ? 'ring-1 ring-inset ring-amber-300' : ''
        }`}
      >
        {selectionControl && (
          <td className="px-3 py-2.5 align-middle">
            {selectionControl}
          </td>
        )}
        {/* Date */}
        <td className={`px-4 py-2.5 whitespace-nowrap ${textClass}`}>
          <div className="flex flex-col gap-1">
            {hasDistinctPostDate ? (
              <>
                <div>
                  <p className="text-sm font-medium text-slate-800">{formatDate(t.postDate, 'MMM d')}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Posted</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{formatDate(t.transDate, 'MMM d')}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Purchased</p>
                </div>
              </>
            ) : (
              <div>
                <p className="text-sm font-medium text-slate-800">{formatDate(t.transDate, 'MMM d')}</p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Purchased</p>
              </div>
            )}
          </div>
        </td>

        {/* Description */}
        <td className={`px-4 py-2.5 max-w-xs ${textClass}`}>
          <div className="flex items-start gap-1.5">
            {isNeedsReview && !t.deleted && (
              <AlertCircle size={13} className="text-amber-500 mt-0.5 shrink-0" />
            )}
            {t.expectingReturn && t.returnStatus === 'pending' && (
              <PackageOpen size={13} className="text-purple-500 mt-0.5 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{t.cleanDescription}</p>
                {t.source && (
                  <span
                    className={`shrink-0 text-[10px] font-bold px-1 py-0.5 rounded uppercase tracking-wide ${
                      t.source === 'plaid'
                        ? 'bg-blue-100 text-blue-600'
                        : t.source === 'csv'
                        ? 'bg-green-100 text-green-600'
                        : t.source === 'pdf'
                        ? 'bg-purple-100 text-purple-600'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {t.source}
                  </span>
                )}
              </div>
              <p
                className="text-xs text-slate-400 truncate"
                title={t.description}
              >
                {t.description}
              </p>
              {(t.hasRefund || t.refundForId || t.refundReviewPending) && (
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {t.hasRefund && (
                    <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-[10px] font-semibold">
                      Refunded
                    </span>
                  )}
                  {t.refundForId && (
                    <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-[10px] font-medium">
                      Refund for {linkedRefundOriginal?.cleanDescription ?? 'purchase'}
                    </span>
                  )}
                  {t.refundReviewPending && (
                    <Link
                      to="/app/returns?tab=review"
                      className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 px-2 py-0.5 text-[10px] font-semibold"
                    >
                      Needs Match
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </td>

        {/* Category */}
        <td className="px-4 py-2.5">
          <CategoryDropdown value={t.category} onChange={handleCategoryChange} compact />
        </td>

        {/* Card */}
        <td className="px-4 py-2.5">
          <label
            className="relative inline-flex max-w-[150px] items-center rounded-full border px-2 py-0.5 pr-5 text-xs transition-colors hover:opacity-80 focus-within:ring-1 focus-within:ring-accent-500"
            style={{
              backgroundColor: `${cardColor}22`,
              borderColor: `${cardColor}55`,
              color: cardColor,
            }}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: cardColor }}
              />
              <span className="truncate">{cardLabel}</span>
              <span className="pointer-events-none absolute right-2 text-current opacity-50">▾</span>
            </span>
            <select
              value={t.cardId || ''}
              onChange={(event) => handleCardChange(event.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full opacity-0"
              aria-label={`Card for ${t.cleanDescription || t.description}`}
            >
              <option value="">No card</option>
              {cards.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.isPaymentMethod || !option.lastFour ? option.name : `${option.name} ...${option.lastFour}`}
                </option>
              ))}
            </select>
          </label>
        </td>

        {/* Person */}
        <td className={`px-4 py-2.5 ${textClass}`}>
          <label
            className="relative inline-flex max-w-[130px] items-center rounded-full border px-2 py-0.5 pr-5 text-xs transition-colors hover:opacity-80 focus-within:ring-1 focus-within:ring-accent-500"
            style={{
              backgroundColor: `${personDotColor}22`,
              borderColor: `${personDotColor}55`,
              color: personDotColor,
            }}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: personDotColor }}
              />
              <span className="truncate">{personLabel}</span>
              <span className="pointer-events-none absolute right-2 text-current opacity-50">▾</span>
            </span>
            <select
              value={t.personId || person?.id || ''}
              onChange={(event) => handlePersonChange(event.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full opacity-0"
              aria-label={`Person for ${t.cleanDescription || t.description}`}
            >
              <option value="">Unassigned</option>
              {persons.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          </label>
        </td>

        {/* Amount */}
        <td className={`px-4 py-2.5 text-right font-semibold text-sm whitespace-nowrap ${textClass} ${
          t.isPayment || t.isCredit ? 'text-green-600' : 'text-slate-800'
        }`}>
          {(t.isPayment || t.isCredit) ? '−' : ''}
          {formatAmount(Math.abs(t.amount))}
          {t.originalCurrency && (
            <div className="text-xs font-normal text-slate-400">
              {t.originalCurrency} {t.originalAmount?.toFixed(2)}
            </div>
          )}
        </td>

        {/* Actions */}
        <td className="px-4 py-2.5">
          {t.deleted ? (
            <Tooltip text="Unhide transaction" side="bottom">
              <button
                onClick={handleUnhide}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
              >
                <Undo2 size={13} /> Unhide
              </button>
            </Tooltip>
          ) : showHideConfirm ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Hide?</span>
              <button
                onClick={handleHide}
                className="text-xs text-slate-700 font-medium hover:text-slate-900"
              >
                Yes
              </button>
              <button
                onClick={() => setShowHideConfirm(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                No
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* Reimbursement */}
              <Tooltip text="Reimbursement">
                <button
                  ref={reimbBtnRef}
                  onClick={() => openWith('reimb', reimbBtnRef)}
                  className={`transition-colors ${
                    t.reimbursementStatus !== 'none'
                      ? 'text-orange-500 hover:text-orange-600'
                      : 'text-slate-300 hover:text-slate-500'
                  }`}
                >
                  <DollarSign size={14} />
                </button>
              </Tooltip>

              {/* Expected return */}
              {!t.isPayment && !t.isCredit && (
                <Tooltip text="Expected Return / Refund">
                  <button
                    ref={returnBtnRef}
                    onClick={() => openWith('return', returnBtnRef)}
                    className={`transition-colors ${
                      t.expectingReturn && t.returnStatus === 'pending'
                        ? 'text-purple-500 hover:text-purple-600'
                        : t.expectingReturn && t.returnStatus === 'completed'
                        ? 'text-green-500 hover:text-green-600'
                        : 'text-slate-300 hover:text-slate-500'
                    }`}
                  >
                    <PackageOpen size={14} />
                  </button>
                </Tooltip>
              )}

              {/* Recurring */}
              <Tooltip text={t.isRecurring ? 'Remove Recurring' : 'Mark as Recurring'}>
                <button
                  onClick={() => {
                    if (t.isRecurring) {
                      // Un-flagging: if auto-detected, mark dismissed so detector won't re-flag
                      update(t.id, {
                        isRecurring: false,
                        ...(t.recurringAutoDetected ? { recurringDismissed: true } : {}),
                      })
                    } else {
                      // Manually flagging: clear any auto-detection state
                      update(t.id, { isRecurring: true, recurringAutoDetected: false, recurringDismissed: false })
                    }
                  }}
                  className={`transition-colors ${
                    t.isRecurring
                      ? 'text-blue-500 hover:text-blue-600'
                      : 'text-slate-300 hover:text-slate-500'
                  }`}
                >
                  <RefreshCw size={14} />
                </button>
              </Tooltip>

              {/* Notes */}
              <Tooltip text="Add Note">
                <button
                  ref={noteBtnRef}
                  onClick={() => openWith('note', noteBtnRef)}
                  className={`transition-colors ${
                    t.notes
                      ? 'text-accent-500 hover:text-accent-600'
                      : 'text-slate-300 hover:text-slate-500'
                  }`}
                >
                  <StickyNote size={14} />
                </button>
              </Tooltip>

              {/* Hide */}
              <Tooltip text="Hide transaction">
                <button
                  onClick={() => setShowHideConfirm(true)}
                  className="text-slate-300 hover:text-slate-500 transition-colors"
                >
                  <EyeOff size={14} />
                </button>
              </Tooltip>
            </div>
          )}
        </td>
      </tr>

      {/* Popover portal — renders outside the table to avoid overflow clipping */}
      {openPopover && anchorRect && createPortal(
        <>
          {/* Transparent backdrop catches outside clicks */}
          <div className="fixed inset-0 z-[199]" onClick={closeAll} />

          {/* Popover positioned below and right-aligned to the anchor button */}
          <div
            className="fixed z-[200]"
            style={{
              ...(popoverOpensUp
                ? { bottom: window.innerHeight - anchorRect.top + 4 }
                : { top: anchorRect.bottom + 4 }),
              right: window.innerWidth - anchorRect.right,
            }}
          >
            {openPopover === 'reimb' && (
              <ReimbursementPopover transaction={t} onClose={closeAll} />
            )}
            {openPopover === 'return' && (
              <ExpectedReturnPopover transaction={t} onClose={closeAll} />
            )}
            {openPopover === 'note' && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-card-md p-3 pb-6 w-56 max-h-[80vh] overflow-y-auto animate-slide-in">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note…"
                  rows={3}
                  autoFocus
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-accent-500 resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={saveNote}
                    className="flex-1 text-xs bg-accent-600 text-white rounded-lg py-1.5 hover:bg-accent-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setNoteText(t.notes ?? ''); closeAll() }}
                    className="text-xs text-slate-400 hover:text-slate-600 px-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  )
}
