import { Hexagon, List, X } from '@phosphor-icons/react'
import { useState } from 'react'
import { useSiteName } from '../../ServerConfigContext'
import SiteLogo from '../SiteLogo'
import ThemeModeButton from '../ThemeModeButton'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { PRIMARY_BTN } from '../profile/controls'
import { LANDING_NAV, LANDING_URLS } from './landing-links'
import { LANDING_SHELL } from './tokens'

const NAV_LINK =
  'px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground'
const MOBILE_NAV_LINK =
  'block min-h-11 rounded-lg px-3 py-2.5 text-base text-foreground transition-colors hover:bg-muted'

/**
 * Signed-out landing header. Same shape as anyrouter.dev: logo + name, a few
 * text links, theme, and a Sign in CTA. Mobile uses the shared Sheet. Width
 * matches `LANDING_SHELL`.
 */
export default function LandingHeader() {
  const siteName = useSiteName()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className={`${LANDING_SHELL} flex h-16 items-center justify-between gap-3`}>
        <div className="flex min-w-0 items-center gap-2 sm:gap-6">
          <a href="/" className="flex min-w-0 items-center gap-1.5">
            <SiteLogo size={22} className="shrink-0">
              <div className="grid h-6 w-6 place-items-center rounded-md bg-[#ff4801]">
                <Hexagon size={12} className="text-white" weight="bold" />
              </div>
            </SiteLogo>
            <span className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
              {siteName}
            </span>
          </a>

          <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
            {LANDING_NAV.map((item) => (
              <a key={item.href} href={item.href} className={NAV_LINK}>
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeModeButton size="lg" />
          <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <span className="hidden lg:inline-flex">
            <a href={LANDING_URLS.signIn} className={PRIMARY_BTN}>
              Sign in
            </a>
          </span>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon-lg"
                className="size-11 lg:hidden"
                aria-label="Open menu"
              >
                <List size={20} />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" showCloseButton={false} className="w-[min(20rem,100%)] gap-0 p-0">
              <SheetTitle className="sr-only">Site navigation</SheetTitle>
              <div className="flex h-14 items-center justify-between border-b border-border px-4">
                <span className="text-sm font-semibold tracking-tight">{siteName}</span>
                <SheetClose asChild>
                  <Button variant="ghost" size="icon-lg" className="size-11" aria-label="Close menu">
                    <X size={20} />
                  </Button>
                </SheetClose>
              </div>
              <nav aria-label="Mobile" className="flex flex-col gap-0.5 px-3 py-3">
                {LANDING_NAV.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className={MOBILE_NAV_LINK}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
              <div className="border-t border-border px-4 py-4">
                <a
                  href={LANDING_URLS.signIn}
                  className={`${PRIMARY_BTN} w-full`}
                  onClick={() => setOpen(false)}
                >
                  Sign in
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
