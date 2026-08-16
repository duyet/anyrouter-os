import { useEffect, useRef, useState } from 'react'

/**
 * Drives a small looping animation through `stepCount` frames without wasting cycles or
 * overriding a visitor's motion preference: the timer only runs while the demo is scrolled into
 * view, and a user with `prefers-reduced-motion: reduce` is pinned to `finalStep` (the most
 * informative frame) instead of ever animating. `advance` lets a click jump straight to a step
 * (used for the one demo with a real button), which briefly pauses the timer so the click isn't
 * immediately overwritten by the next tick.
 */
export function useDemoStep(
  stepCount: number,
  intervalMs: number,
  finalStep: number = stepCount - 1,
): {
  step: number
  containerRef: React.RefObject<HTMLDivElement | null>
  advance: (step: number) => void
} {
  const containerRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [step, setStep] = useState(0)
  // Set on manual `advance()`; suppresses one auto-tick so a click doesn't feel overridden.
  const heldRef = useRef(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(query.matches)
    const onChange = () => setReducedMotion(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.2 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (reducedMotion || !inView) return
    const id = window.setInterval(() => {
      if (heldRef.current) {
        heldRef.current = false
        return
      }
      setStep((current) => (current + 1) % stepCount)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [reducedMotion, inView, stepCount, intervalMs])

  return {
    step: reducedMotion ? finalStep : step,
    containerRef,
    advance: (next: number) => {
      heldRef.current = true
      setStep(next)
    },
  }
}
