import { ArrowRight, ChatCircleText, Circle, CircleNotch, X as XIcon } from '@phosphor-icons/react'
import { DemoFrame, LandingSection } from './tokens'
import { useDemoStep } from './useDemoStep'

// A real "try this" prompt from the README, not an invented one — the tic-tac-toe example is one
// of the repo's own suggested first prompts.
const PROMPT = 'Make a tic tac toe game.'
const TYPE_STEPS = PROMPT.length
const BUILD_STEPS = 6
const READY_STEPS = 8
const STEP_COUNT = TYPE_STEPS + BUILD_STEPS + READY_STEPS
const INTERVAL_MS = 45

// Diagonal so the finished board reads as "in progress", not "solved".
const FILLED_CELLS: Record<number, 'x' | 'o'> = { 0: 'x', 4: 'o', 8: 'x' }

/**
 * First demo on the landing page: types out a real example prompt, then "builds" it into a tiny
 * live-looking app preview. Carries the page's headline claim — chat becomes a running app — by
 * showing it happen rather than describing it.
 */
export default function DemoPromptToApp() {
  const { step, containerRef } = useDemoStep(STEP_COUNT, INTERVAL_MS)

  const typedLen = Math.min(step, TYPE_STEPS)
  const typing = step < TYPE_STEPS
  const building = step >= TYPE_STEPS && step < TYPE_STEPS + BUILD_STEPS
  const ready = step >= TYPE_STEPS + BUILD_STEPS

  return (
    <LandingSection
      eyebrow="Demo — describe it"
      title="Chat what you want, get a running app"
      body="Type a prompt and it gets written, run, and iterated on for you — no separate build step, no deploy button."
    >
      <DemoFrame>
        <div ref={containerRef} aria-hidden="true" className="flex w-full flex-col gap-4 sm:flex-row sm:items-center">
          {/* Composer mock */}
          <div className="w-full min-w-0 flex-1">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3">
              <ChatCircleText size={16} className="shrink-0 text-muted-foreground" />
              <p className="min-w-0 flex-1 truncate text-[14px] text-foreground">
                {PROMPT.slice(0, typedLen)}
                {!ready && <span className="animate-pulse">▍</span>}
              </p>
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              {typing ? 'Typing…' : building ? 'Writing the app…' : 'Sent'}
            </p>
          </div>

          <ArrowRight
            size={18}
            className={`hidden shrink-0 sm:block ${building ? 'text-primary' : 'text-border'}`}
          />

          {/* App preview mock */}
          <div className="w-full shrink-0 overflow-hidden rounded-xl border border-border bg-background sm:max-w-[220px]">
            <div className="flex h-7 items-center gap-1.5 border-b border-border bg-muted px-3">
              <span className="h-1.5 w-1.5 rounded-full bg-border" />
              <span className="h-1.5 w-1.5 rounded-full bg-border" />
              <span className="h-1.5 w-1.5 rounded-full bg-border" />
              <span className="ml-1 truncate text-[10px] text-muted-foreground">tic-tac-toe</span>
              {building && (
                <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                  <CircleNotch size={11} className="animate-spin" />
                </span>
              )}
              {ready && (
                <span className="ml-auto flex items-center gap-1 text-[10px] text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Live
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1 p-3">
              {Array.from({ length: 9 }, (_, cell) => (
                <div
                  key={cell}
                  className="grid aspect-square place-items-center rounded-md border border-border/70"
                >
                  {FILLED_CELLS[cell] === 'x' && (
                    <XIcon
                      size={12}
                      weight="bold"
                      className={`text-primary transition-opacity duration-150 ${ready ? 'opacity-100' : 'opacity-0'}`}
                    />
                  )}
                  {FILLED_CELLS[cell] === 'o' && (
                    <Circle
                      size={10}
                      weight="bold"
                      className={`text-muted-foreground transition-opacity duration-150 ${ready ? 'opacity-100' : 'opacity-0'}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DemoFrame>
    </LandingSection>
  )
}
