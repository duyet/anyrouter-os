import { Hexagon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import SiteLogo from '../SiteLogo'

/**
 * The top of the signed-out landing page: brand lockup, a one-sentence explanation of what the
 * product does, and the sign-in action itself (passed in as `signIn` rather than owned here, so
 * every existing auth path — Clerk, password, OAuth vendors, and their loading/error states —
 * keeps living in `LoginPage.tsx` unchanged).
 */
export default function Hero({ siteName, signIn }: { siteName: string; signIn: ReactNode }) {
  return (
    <div className="relative overflow-hidden px-6 pb-16 pt-14 sm:px-8 sm:pt-20">
      {/* Dot grid, fading from top — the same background LoginPage used before this redesign. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)',
        }}
      />

      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 text-center">
        <SiteLogo size={28} className="mb-1">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#ff4801]">
            <Hexagon size={14} className="text-white" weight="bold" />
          </div>
        </SiteLogo>
        <span className="text-[13px] font-medium tracking-tight text-muted-foreground">{siteName}</span>
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl items-center gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-8">
        <div className="text-center lg:text-left">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Describe an app. {siteName} writes it, runs it, and keeps it sandboxed.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-6 text-muted-foreground lg:mx-0">
            Every gadget runs in its own isolate on Cloudflare. Reads from a connected service
            happen instantly; writes wait for your approval. Inference runs on your own AnyRouter
            key. See it below, or sign in to try it yourself.
          </p>
        </div>

        <div id="sign-in" className="mx-auto w-full max-w-sm scroll-mt-8">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-7">
            {signIn}
          </div>
        </div>
      </div>
    </div>
  )
}
