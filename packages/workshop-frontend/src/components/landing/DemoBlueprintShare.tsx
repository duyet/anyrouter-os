import { Copy, Stack } from '@phosphor-icons/react'
import { DemoFrame, LandingSection } from './tokens'
import { useDemoStep } from './useDemoStep'

const STEP_COUNT = 5
const INTERVAL_MS = 650
// "Copied, with its own storage" — the most informative static frame for reduced motion.
const DONE_STEP = 3

/**
 * Fourth demo: a blueprint being stamped into a fresh, independent gadget. Grounded in
 * `docs/blueprints.md` — a blueprint captures source code, not chat history or storage, so each
 * gadget created from it gets its own bindings, storage, and chat history.
 */
export default function DemoBlueprintShare() {
  const { step, containerRef } = useDemoStep(STEP_COUNT, INTERVAL_MS, DONE_STEP)

  const connecting = step === 1
  const copying = step === 2
  const done = step >= DONE_STEP

  return (
    <LandingSection
      eyebrow="Demo — blueprints"
      title="Start from what someone already built"
      body="A blueprint shares a gadget's source code, not its data. Anyone with the link can create their own copy, pointed at their own storage and their own connections."
    >
      <DemoFrame>
        <div ref={containerRef} aria-hidden="true" className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
          <div
            className={`w-full rounded-xl border bg-background p-4 transition-colors duration-150 sm:max-w-[200px] ${
              connecting || copying || done ? 'border-primary' : 'border-border'
            }`}
          >
            <Stack size={18} weight="duotone" className="text-primary" />
            <p className="mt-2 truncate text-[13px] font-medium text-foreground">Weekly report</p>
            <p className="text-[11px] text-muted-foreground">Blueprint</p>
          </div>

          <div className="hidden w-16 shrink-0 items-center justify-center sm:flex">
            <svg
              viewBox="0 0 64 2"
              preserveAspectRatio="none"
              className="h-1 w-full text-border"
              fill="none"
            >
              <path
                d="M0 1 H64"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeDasharray="3 7"
                className={connecting ? 'connectors-hero-flow-line' : ''}
              />
            </svg>
          </div>

          <div
            className={`w-full rounded-xl border border-border bg-background p-4 transition-all duration-200 sm:max-w-[200px] ${
              copying || done ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            }`}
          >
            <Copy size={18} weight="duotone" className="text-muted-foreground" />
            <p className="mt-2 truncate text-[13px] font-medium text-foreground">Weekly report</p>
            <p className="text-[11px] text-muted-foreground">Your copy</p>
            {done && <p className="mt-2 text-[10px] text-muted-foreground">Own storage · Own bindings</p>}
          </div>
        </div>
      </DemoFrame>
    </LandingSection>
  )
}
