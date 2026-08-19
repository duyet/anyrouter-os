import type { ReactNode } from 'react'
import { Hexagon, Key, SealCheck, ShieldCheck } from '@phosphor-icons/react'
import AnyRouterMark from '../AnyRouterMark'

/**
 * Hero sign-in card. Same language as anyrouter.dev's consent / "Sign in with
 * AnyRouter" card: handshake, mono eyebrow, verified chip, then the real auth
 * widget. Auth logic stays in LoginPage.
 */
export default function SignInCard({
  siteName,
  children,
}: {
  siteName: string
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_30px_-18px_rgba(0,0,0,0.25)]">
      <div className="space-y-5 p-5 sm:p-6">
        <header className="space-y-3 text-center">
          <div className="flex items-center justify-center gap-3" aria-hidden="true">
            <span className="grid size-12 place-items-center rounded-full border border-border bg-background shadow-sm">
              <span className="grid size-7 place-items-center rounded-md bg-[#ff4801]">
                <Hexagon size={14} className="text-white" weight="bold" />
              </span>
            </span>
            <svg viewBox="0 0 48 12" className="h-3 w-12 shrink-0 text-muted-foreground" fill="none">
              <path d="M1 6 H38" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" strokeLinecap="round" />
              <path d="M36 2 L42 6 L36 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="grid size-12 place-items-center rounded-full border border-border bg-background shadow-sm">
              <AnyRouterMark className="size-6 text-foreground" />
            </span>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            AnyRouter · Sign in
          </p>
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-foreground sm:text-lg">
              Sign in to {siteName}
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
              Use your anyrouter.dev account. Models run on your key, billed to you.
            </p>
          </div>
          <p className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
            <SealCheck size={13} weight="fill" />
            Built by AnyRouter
          </p>
        </header>

        {children}

        <ul className="space-y-2 border-t border-border pt-4">
          <TrustRow icon={<ShieldCheck size={14} weight="duotone" />} text="OAuth with your AnyRouter account" />
          <TrustRow icon={<Key size={14} weight="duotone" />} text="Inference billed to your key — not a shared pool" />
        </ul>
      </div>
    </div>
  )
}

function TrustRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-2.5 text-[12px] leading-4 text-muted-foreground">
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-primary">
        {icon}
      </span>
      {text}
    </li>
  )
}
