import type { ReactNode } from 'react'
import { LANDING_SHELL } from './tokens'

/**
 * Signed-out hero: what the product is, in one line, plus the sign-in slot.
 * Auth UI stays in LoginPage so every path (Clerk, password, OAuth) is unchanged.
 */
export default function Hero({ signIn }: { signIn: ReactNode }) {
  return (
    <div className={`${LANDING_SHELL} pb-8 pt-2 sm:pb-12 sm:pt-6`}>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-12">
        <div className="min-w-0 text-left">
          <h1 className="text-balance text-[1.75rem] font-semibold leading-[1.15] tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
            Describe an app. It writes it, runs it, sandboxes it.
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-6 text-muted-foreground sm:text-[16px]">
            Gadgets are private isolates on Cloudflare. Reads go through instantly.
            Writes wait for your approval. Models run on your AnyRouter key.
          </p>
        </div>

        <div id="sign-in" className="min-w-0 w-full scroll-mt-20">
          {signIn}
        </div>
      </div>
    </div>
  )
}
