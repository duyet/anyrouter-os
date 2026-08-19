import { Check, CircleNotch, HourglassSimple, ShieldCheck } from '@phosphor-icons/react'
import { DEMO_BTN_PRIMARY, DEMO_BTN_SECONDARY, DemoFrame, LandingSection } from './tokens'
import { useDemoStep } from './useDemoStep'

const STEP_COUNT = 6
const INTERVAL_MS = 700
// Read pending -> done, then write pending -> approved: the most complete static frame for
// prefers-reduced-motion, since it shows both halves of the rule at once.
const READY_APPROVED_STEP = 4

/**
 * Second demo: a gatekeeper handling a read and a write. Grounded directly in
 * `gatekeeper-mcp/src/mcp.ts` ("Reads happen straight away. Anything that writes waits for your
 * approval.") — the one universal fact about gatekeepers, true of every vendor a deployment might
 * configure, so the demo names generic actions rather than a specific connected service.
 *
 * The Approve/Deny buttons are real controls, not just animation: clicking either jumps the demo
 * straight to that outcome instead of waiting for the next tick.
 */
export default function DemoGatekeeperApproval() {
  const { step, containerRef, advance } = useDemoStep(STEP_COUNT, INTERVAL_MS, READY_APPROVED_STEP)

  const readPending = step === 1
  const readDone = step >= 2
  const writePending = step === 3
  const writeApproved = step >= 4

  return (
    <LandingSection
      eyebrow="Demo — gatekeepers"
      title="Reads run instantly. Writes wait for you"
      body="Gatekeepers moderate every connection a gadget or agent makes to the outside world: reads happen straight away, and anything that writes waits for your approval — now, or later, whenever it's convenient."
    >
      <DemoFrame>
        <div ref={containerRef} className="flex flex-col gap-3">
          {/* Read action */}
          <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-background px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <ShieldCheck size={18} weight="duotone" aria-hidden="true" className="shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-[14px] text-foreground">
                Read: check this week's report
              </span>
            </div>
            <span
              aria-hidden="true"
              className="flex items-center gap-1.5 pl-8 text-[12px] font-medium text-muted-foreground sm:shrink-0 sm:pl-0"
            >
              {step === 0 && <span className="text-muted-foreground">Queued</span>}
              {readPending && (
                <>
                  <CircleNotch size={12} className="animate-spin" aria-hidden="true" />
                  Reading…
                </>
              )}
              {readDone && (
                <>
                  <Check size={14} weight="bold" aria-hidden="true" className="text-success" />
                  Done
                </>
              )}
            </span>
          </div>

          {/* Write action */}
          <div className="rounded-xl border border-border bg-background px-3 py-3 sm:px-4">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <ShieldCheck size={18} weight="duotone" aria-hidden="true" className="shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-[14px] text-foreground">
                  Write: share it with the team
                </span>
              </div>
              <span aria-hidden="true" className="flex items-center gap-1.5 pl-8 text-[12px] font-medium sm:shrink-0 sm:pl-0">
                {step < 3 && <span className="text-muted-foreground">Queued</span>}
                {writePending && (
                  <span className="flex items-center gap-1.5 text-warning">
                    <HourglassSimple size={12} />
                    Waiting for your approval
                  </span>
                )}
                {writeApproved && (
                  <span className="flex items-center gap-1.5 text-success">
                    <Check size={14} weight="bold" />
                    Approved
                  </span>
                )}
              </span>
            </div>
            {writePending && (
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => advance(0)}
                  aria-label="Deny: share it with the team"
                  className={DEMO_BTN_SECONDARY}
                >
                  Deny
                </button>
                <button
                  type="button"
                  onClick={() => advance(READY_APPROVED_STEP)}
                  aria-label="Approve: share it with the team"
                  className={DEMO_BTN_PRIMARY}
                >
                  Approve
                </button>
              </div>
            )}
          </div>
        </div>
      </DemoFrame>
    </LandingSection>
  )
}
