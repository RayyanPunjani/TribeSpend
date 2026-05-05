import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TOUR_CURRENT_STEP_KEY, TOUR_HAS_SEEN_KEY, TOUR_STEPS } from '@/lib/onboardingTour'

interface GuidedTourProps {
  active: boolean
  onSkip: () => void
  onFinish: () => Promise<void> | void
}

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

interface TooltipSize {
  width: number
  height: number
}

const TARGET_PADDING = 8
const VIEWPORT_MARGIN = 12
const ROUTE_RENDER_DELAY_MS = 320
const STEP_FADE_MS = 180

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getStoredStep() {
  const value = Number(localStorage.getItem(TOUR_CURRENT_STEP_KEY) ?? 0)
  return Number.isFinite(value) ? clamp(value, 0, TOUR_STEPS.length - 1) : 0
}

function getTooltipPosition(rect: TargetRect, tooltipSize: TooltipSize) {
  const width = Math.min(360, window.innerWidth - VIEWPORT_MARGIN * 2)
  const height = Math.min(tooltipSize.height || 280, window.innerHeight - VIEWPORT_MARGIN * 2)
  const gap = 14
  const spaceAbove = rect.top
  const spaceBelow = window.innerHeight - rect.top - rect.height
  const spaceRight = window.innerWidth - rect.left - rect.width
  const spaceLeft = rect.left
  const centeredLeft = clamp(rect.left + rect.width / 2 - width / 2, VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN)

  if (spaceBelow >= height + gap + VIEWPORT_MARGIN) {
    return {
      width,
      top: clamp(rect.top + rect.height + gap, VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN),
      left: centeredLeft,
    }
  }

  if (spaceAbove >= height + gap + VIEWPORT_MARGIN) {
    return {
      width,
      top: clamp(rect.top - height - gap, VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN),
      left: centeredLeft,
    }
  }

  if (spaceRight >= width + gap + VIEWPORT_MARGIN) {
    return {
      width,
      top: clamp(rect.top + rect.height / 2 - height / 2, VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN),
      left: clamp(rect.left + rect.width + gap, VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN),
    }
  }

  if (spaceLeft >= width + gap + VIEWPORT_MARGIN) {
    return {
      width,
      top: clamp(rect.top + rect.height / 2 - height / 2, VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN),
      left: clamp(rect.left - width - gap, VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN),
    }
  }

  return {
    width,
    top: clamp(window.innerHeight - height - VIEWPORT_MARGIN, VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN),
    left: VIEWPORT_MARGIN,
  }
}

export default function GuidedTour({ active, onSkip, onFinish }: GuidedTourProps) {
  const [stepIndex, setStepIndex] = useState(() => getStoredStep())
  const [finishing, setFinishing] = useState(false)
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const [targetMissing, setTargetMissing] = useState(false)
  const [stepVisible, setStepVisible] = useState(false)
  const [tooltipSize, setTooltipSize] = useState<TooltipSize>({ width: 360, height: 280 })
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipRef = useRef<HTMLElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const step = TOUR_STEPS[stepIndex]

  const clearTransitionTimer = () => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = null
    }
  }

  const showStepAfterDelay = (delay = STEP_FADE_MS) => {
    clearTransitionTimer()
    transitionTimerRef.current = setTimeout(() => {
      setStepVisible(true)
      transitionTimerRef.current = null
    }, delay)
  }

  const moveToStep = (nextStep: number) => {
    setStepVisible(false)
    clearTransitionTimer()
    transitionTimerRef.current = setTimeout(() => {
      setStepIndex(clamp(nextStep, 0, TOUR_STEPS.length - 1))
      transitionTimerRef.current = null
    }, STEP_FADE_MS)
  }

  useEffect(() => {
    if (!active) return
    setStepIndex(getStoredStep())
    setStepVisible(false)
  }, [active])

  useLayoutEffect(() => {
    if (!active || !tooltipRef.current) return
    const rect = tooltipRef.current.getBoundingClientRect()
    setTooltipSize({
      width: rect.width,
      height: rect.height,
    })
  }, [active, stepIndex, targetRect, targetMissing])

  useEffect(() => () => clearTransitionTimer(), [])

  useEffect(() => {
    if (!active) return
    localStorage.setItem(TOUR_CURRENT_STEP_KEY, String(stepIndex))
  }, [active, stepIndex])

  useEffect(() => {
    if (!active || !step) return
    if (location.pathname !== step.route) {
      setTargetRect(null)
      setStepVisible(false)
      navigate(step.route)
    }
  }, [active, location.pathname, navigate, step])

  useEffect(() => {
    if (!active || !step) return
    if (location.pathname !== step.route) return
    let cancelled = false
    let attempts = 0
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    setStepVisible(false)

    const update = () => {
      if (cancelled) return
      const element = document.querySelector<HTMLElement>(step.selector)
      if (element) {
        const rect = element.getBoundingClientRect()
        setTargetRect({
          top: Math.max(0, rect.top - TARGET_PADDING),
          left: Math.max(0, rect.left - TARGET_PADDING),
          width: Math.min(window.innerWidth, rect.width + TARGET_PADDING * 2),
          height: Math.min(window.innerHeight, rect.height + TARGET_PADDING * 2),
        })
        setTargetMissing(false)
        element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
        showStepAfterDelay(STEP_FADE_MS)
        return
      }

      attempts += 1
      if (attempts > 30) {
        setTargetRect(null)
        setTargetMissing(true)
        showStepAfterDelay(STEP_FADE_MS)
        return
      }
      timeoutId = setTimeout(update, 100)
    }

    timeoutId = setTimeout(update, ROUTE_RENDER_DELAY_MS)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [active, location.pathname, step])

  const tooltipStyle = useMemo(() => {
    if (!targetRect) {
      return {
        width: Math.min(360, window.innerWidth - VIEWPORT_MARGIN * 2),
        top: VIEWPORT_MARGIN,
        left: VIEWPORT_MARGIN,
      }
    }
    return getTooltipPosition(targetRect, tooltipSize)
  }, [targetRect, tooltipSize])

  if (!active || !step) return null

  const finish = async () => {
    setFinishing(true)
    localStorage.setItem(TOUR_HAS_SEEN_KEY, 'true')
    localStorage.removeItem(TOUR_CURRENT_STEP_KEY)
    try {
      await onFinish()
    } finally {
      setFinishing(false)
    }
  }

  const goNext = () => {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      void finish()
      return
    }
    moveToStep(stepIndex + 1)
  }

  const goBack = () => {
    moveToStep(stepIndex - 1)
  }

  const skip = () => {
    onSkip()
  }

  return (
    <div className="fixed inset-0 z-[90] pointer-events-none">
      <style>{`
        @keyframes tribespendTourGlow {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.42), 0 0 0 2px rgba(45, 212, 191, 0.75), 0 0 18px rgba(45, 212, 191, 0.28); }
          50% { box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.42), 0 0 0 5px rgba(45, 212, 191, 0.32), 0 0 28px rgba(45, 212, 191, 0.42); }
        }
      `}</style>
      {targetRect ? (
        <div
          className={`fixed rounded-2xl ring-2 ring-accent-400 pointer-events-none transition-all duration-200 ${stepVisible ? 'opacity-100' : 'opacity-0'}`}
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.42), 0 0 18px rgba(45, 212, 191, 0.28)',
            animation: stepVisible ? 'tribespendTourGlow 1.8s ease-in-out infinite' : undefined,
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-950/40" />
      )}

      <section
        ref={tooltipRef}
        className={`fixed max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl pointer-events-auto transition-opacity duration-200 ${stepVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{
          top: tooltipStyle.top,
          left: tooltipStyle.left,
          width: tooltipStyle.width,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">
            Step {stepIndex + 1} of {TOUR_STEPS.length}
          </p>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-accent-500 transition-all duration-300"
              style={{ width: `${((stepIndex + 1) / TOUR_STEPS.length) * 100}%` }}
            />
          </div>
        </div>
        <h2 className="mt-2 text-base font-bold text-slate-900">{step.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{step.description}</p>
        {step.details && (
          <ul className="mt-3 space-y-1.5 text-xs leading-5 text-slate-500">
            {step.details.map((detail) => (
              <li key={detail} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent-500" />
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        )}
        {step.example && (
          <div className="mt-3 rounded-xl border border-accent-100 bg-accent-50 p-2">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent-700">{step.example.label}</p>
            <div className="space-y-1">
              {step.example.rows.map((row) => (
                <div key={`${row.name}-${row.detail}`} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">{row.name}</p>
                    <p className="truncate text-[11px] text-slate-400">{row.detail}</p>
                  </div>
                  {row.value && <span className="shrink-0 text-xs font-semibold text-slate-700">{row.value}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {targetMissing && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            This part of the page is not visible right now. You can continue the tour or come back later.
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={skip}
            disabled={finishing}
            className="min-h-10 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          >
            Skip
          </button>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0 || finishing}
              className="min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={finishing}
              className="min-h-10 rounded-lg bg-accent-600 px-3 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:cursor-wait disabled:opacity-60"
            >
              {finishing ? 'Finishing...' : stepIndex === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
