// Shared layout atoms for the signed-out landing page, kept separate from the demos themselves so
// the four of them read as one system (same card chrome, same section rhythm) rather than four
// one-off components. Buttons are intentionally NOT duplicated here: `PRIMARY_BTN`/`SECONDARY_BTN`
// already live in `components/profile/controls.tsx` and are imported from there.

import type { ReactNode } from 'react'

/** Small uppercase label above a section heading, e.g. "Demo". Matches the app's existing eyebrow
 * style (see `HomeTaskSuggestions`'s "Get started" label and `profile/controls.tsx`'s SectionLabel). */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-primary">
      {children}
    </p>
  )
}

/** One landing-page section: eyebrow, heading, one-sentence body, then whatever content (usually a
 * `DemoFrame`) explains it. Reused by every demo so the page has a single, predictable rhythm. */
export function LandingSection({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string
  title: string
  body: string
  children: ReactNode
}) {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-12">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      <p className="mt-2 max-w-xl text-[15px] leading-6 text-muted-foreground">{body}</p>
      <div className="mt-8">{children}</div>
    </section>
  )
}

// Compact button variants for controls that live *inside* a demo frame (e.g. the Approve/Deny
// pair in DemoGatekeeperApproval). Deliberately not composed as `${PRIMARY_BTN} h-7 ...`: Tailwind
// resolves same-property utility conflicts by generated-CSS order, not by the order classes appear
// in `className`, so stacking a smaller `h-7`/`px-3` after the profile buttons' `h-9`/`px-3.5` is
// not guaranteed to win. These are self-contained instead.

/** Compact primary button for controls inside a `DemoFrame` (h-7, vs. the app-wide h-9 button). */
export const DEMO_BTN_PRIMARY =
  'press inline-flex h-7 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-[12px] font-medium tracking-[-0.25px] text-white transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60'

/** Compact secondary button for controls inside a `DemoFrame` (h-7, vs. the app-wide h-9 button). */
export const DEMO_BTN_SECONDARY =
  'press inline-flex h-7 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[12px] font-medium tracking-[-0.25px] text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60'

/** The bordered card chrome every demo renders inside, so the four animations look like one
 * component family instead of four independent widgets. Fixed min-height avoids layout shift as a
 * demo's step count changes what it's showing. */
export function DemoFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-[180px] overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6">
      {children}
    </div>
  )
}
