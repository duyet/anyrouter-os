import { Hexagon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import SiteLogo from '../SiteLogo'

/**
 * Signed-out hero: what the product is, in one line, plus the sign-in slot.
 * Auth UI stays in LoginPage so every path (Clerk, password, OAuth) is unchanged.
 */
export default function Hero({ siteName, signIn }: { siteName: string; signIn: ReactNode }) {
  return (
    <div className="px-6 pb-12 pt-6 sm:px-8 sm:pb-16 sm:pt-10">
      <div className="mx-auto grid max-w-5xl items-start gap-10 lg:grid-cols-[1.15fr_22rem] lg:gap-16">
        <div className="pt-2 text-center lg:pt-6 lg:text-left">
          <SiteLogo size={28} className="mb-6 inline-flex justify-center lg:justify-start">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#ff4801]">
              <Hexagon size={14} className="text-white" weight="bold" />
            </div>
          </SiteLogo>
          <p className="text-[13px] font-medium tracking-tight text-muted-foreground">{siteName}</p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
            Describe an app. It writes it, runs it, sandboxes it.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[16px] leading-6 text-muted-foreground lg:mx-0">
            Gadgets are private isolates on Cloudflare. Reads go through instantly.
            Writes wait for your approval. Models run on your AnyRouter key.
          </p>
        </div>

        <div id="sign-in" className="mx-auto w-full max-w-md scroll-mt-8 lg:mx-0 lg:max-w-none">
          <div className="overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6">
            {signIn}
          </div>
        </div>
      </div>
    </div>
  )
}
