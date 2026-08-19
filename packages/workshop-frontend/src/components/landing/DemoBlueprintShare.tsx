import type { ReactNode } from 'react'
import {
  Check,
  CircleNotch,
  Hexagon,
  X as XIcon,
} from '@phosphor-icons/react'
import { anyrouterProviderLogo } from '../../anyrouterMark'
import { DEMO_BTN_PRIMARY, DemoFrame, LandingSection } from './tokens'
import { useDemoStep } from './useDemoStep'

const STEP_COUNT = 6
const INTERVAL_MS = 700
// Ready copy is the most informative static frame for reduced motion.
const DONE_STEP = 5

/**
 * Fourth demo: the real "start from a blueprint" dialog. A blueprint is source
 * only — the visitor stamps their own gadget, with their own storage and
 * connections. Grounded in `docs/blueprints.md`.
 */
export default function DemoBlueprintShare() {
  const { step, containerRef, advance } = useDemoStep(STEP_COUNT, INTERVAL_MS, DONE_STEP)

  const showSplit = step >= 1
  const connectGithub = step >= 2
  const githubReady = step >= 3
  const creating = step === 4
  const done = step >= DONE_STEP

  return (
    <LandingSection
      eyebrow="Demo — blueprints"
      title="Start from what someone already built"
      body="A blueprint shares a gadget's source code, not its data. Anyone with the link can create their own copy, pointed at their own storage and their own connections."
    >
      <DemoFrame>
        <div
          ref={containerRef}
          className="relative flex min-h-[280px] items-center justify-center sm:min-h-[320px]"
        >
          <div className="w-full max-w-[440px] overflow-hidden rounded-xl border border-border bg-background shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)]">
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-orange-600 to-red-600">
                  <Hexagon size={16} className="text-white/80" weight="bold" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold tracking-tight text-foreground">
                    Weekly report
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                    Blueprint · Maya · v3
                  </p>
                </div>
              </div>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground">
                <XIcon size={14} />
              </span>
            </div>

            <div className="space-y-4 px-4 py-4 sm:px-5">
              <div className="grid grid-cols-2 gap-2">
                <SplitCol
                  label="Included"
                  tone="ok"
                  active={showSplit && !done}
                  items={['Source code', 'What to connect']}
                />
                <SplitCol
                  label="Not included"
                  tone="no"
                  active={showSplit && !done}
                  items={['Their storage', 'Their chats', 'Their keys']}
                />
              </div>

              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                  Connect with yours
                </p>
                <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border">
                  <BindingRow
                    icon={
                      <img
                        src={anyrouterProviderLogo('anyrouter-color.svg')}
                        alt=""
                        width={14}
                        height={14}
                        className="size-3.5 object-contain"
                      />
                    }
                    title="AnyRouter"
                    detail="Your key"
                    status="ready"
                  />
                  <BindingRow
                    icon={
                      <img
                        src={anyrouterProviderLogo('github-color.svg')}
                        alt=""
                        width={14}
                        height={14}
                        className="size-3.5 object-contain dark:invert"
                      />
                    }
                    title="GitHub"
                    detail={githubReady ? 'your-org/reports' : 'Needs your repo'}
                    status={githubReady ? 'ready' : connectGithub ? 'needs' : 'idle'}
                  />
                </ul>
              </div>
            </div>

            <div className="border-t border-border px-4 py-3 sm:px-5">
              {done ? (
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <p className="flex items-center gap-1.5 text-[13px] font-medium text-success">
                    <Check size={14} weight="bold" />
                    Your copy is ready
                  </p>
                  <p className="pl-5 text-[11px] text-muted-foreground sm:pl-0">
                    Own storage · Own bindings
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => advance(DONE_STEP)}
                  disabled={creating}
                  className={`${DEMO_BTN_PRIMARY} w-full`}
                >
                  {creating ? (
                    <>
                      <CircleNotch size={12} className="animate-spin" />
                      Creating…
                    </>
                  ) : (
                    'Create my copy'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </DemoFrame>
    </LandingSection>
  )
}

function SplitCol({
  label,
  items,
  tone,
  active,
}: {
  label: string
  items: string[]
  tone: 'ok' | 'no'
  active: boolean
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 transition-colors duration-200 ${
        active
          ? tone === 'ok'
            ? 'border-success/40 bg-success/5'
            : 'border-border bg-muted/50'
          : 'border-border bg-background'
      }`}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </p>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-1.5 text-[12px] text-foreground">
            {tone === 'ok' ? (
              <Check size={12} weight="bold" className="shrink-0 text-success" />
            ) : (
              <XIcon size={12} weight="bold" className="shrink-0 text-muted-foreground" />
            )}
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function BindingRow({
  icon,
  title,
  detail,
  status,
}: {
  icon: ReactNode
  title: string
  detail: string
  status: 'idle' | 'needs' | 'ready'
}) {
  return (
    <li className="flex items-center gap-2.5 px-3 py-2.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted text-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-foreground">{title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{detail}</span>
      </span>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
          status === 'ready'
            ? 'bg-success/10 text-success'
            : status === 'needs'
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground'
        }`}
      >
        {status === 'ready' ? 'Ready' : status === 'needs' ? 'Needs you' : 'Suggested'}
      </span>
    </li>
  )
}
