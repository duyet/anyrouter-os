import { Copy, Stack } from '@phosphor-icons/react'
import { DemoFrame, LandingSection } from './tokens'
import { useDemoStep } from './useDemoStep'

const STEP_COUNT = 5
const INTERVAL_MS = 1300
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
        <div ref={containerRef} aria-hidden="true" className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <div
            className={`w-full max-w-[170px] rounded-xl border bg-kumo-base p-4 transition-colors duration-300 ${
              connecting || copying || done ? 'border-kumo-brand' : 'border-kumo-line'
            }`}
          >
            <Stack size={18} weight="duotone" className="text-kumo-brand" />
            <p className="mt-2 truncate text-[13px] font-medium text-kumo-default">Weekly report</p>
            <p className="text-[11px] text-kumo-subtle">Blueprint</p>
          </div>

          <div className="hidden w-16 shrink-0 items-center justify-center sm:flex">
            <svg
              viewBox="0 0 64 2"
              preserveAspectRatio="none"
              className="h-1 w-full text-kumo-line"
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
            className={`w-full max-w-[170px] rounded-xl border border-kumo-line bg-kumo-base p-4 transition-all duration-500 ${
              copying || done ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            }`}
          >
            <Copy size={18} weight="duotone" className="text-kumo-subtle" />
            <p className="mt-2 truncate text-[13px] font-medium text-kumo-default">Weekly report</p>
            <p className="text-[11px] text-kumo-subtle">Your copy</p>
            {done && <p className="mt-2 text-[10px] text-kumo-subtle">Own storage · Own bindings</p>}
          </div>
        </div>
      </DemoFrame>
    </LandingSection>
  )
}
