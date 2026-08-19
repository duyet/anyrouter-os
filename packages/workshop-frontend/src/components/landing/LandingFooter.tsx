import { Hexagon } from '@phosphor-icons/react'
import { ANYROUTER_MARK_WHITE_CDN } from '../../anyrouterMark'
import ThemeModeButton from '../ThemeModeButton'
import { PRIMARY_BTN, SECONDARY_BTN } from '../profile/controls'
import { LANDING_FOOTER_COLUMNS, LANDING_URLS } from './landing-links'
import { LANDING_SHELL } from './tokens'

/**
 * Signed-out landing footer. Same shape as anyrouter.dev: conversion band, brand +
 * sitemap columns, then copyright. Forced `.dark` so it stays a dark slab in both
 * site themes. Width matches `LANDING_SHELL`.
 */
export default function LandingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="dark mt-4 border-t border-border bg-background py-12 text-foreground sm:py-16">
      <div className={`${LANDING_SHELL} mb-10 flex flex-col items-start gap-5 border-b border-border pb-10 sm:mb-12 sm:flex-row sm:items-center sm:justify-between sm:pb-12`}>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            See it for yourself
          </h2>
          <p className="mt-2 max-w-md text-[14px] text-muted-foreground sm:text-[15px]">
            Sign in and describe the first thing you want built.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <a href={LANDING_URLS.signIn} className={PRIMARY_BTN}>
            Sign in
          </a>
          <a href={LANDING_URLS.gateway} className={SECONDARY_BTN}>
            AnyRouter
          </a>
        </div>
      </div>

      <div className={`${LANDING_SHELL} grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))]`}>
        <div className="min-w-0">
          <a href={LANDING_URLS.signIn} className="inline-flex items-center gap-1.5">
            <img
              src={ANYROUTER_MARK_WHITE_CDN}
              alt=""
              className="h-7 w-auto"
            />
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#ff4801]">
              <Hexagon size={14} className="text-white" weight="bold" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              AnyRouter OS
            </span>
          </a>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Private isolates on Cloudflare. Models on your AnyRouter key.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3 lg:col-span-3 lg:grid-cols-subgrid">
          {LANDING_FOOTER_COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title} className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                {column.title}
              </p>
              <ul className="mt-3 flex flex-col">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="block min-h-11 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className={`${LANDING_SHELL} mt-12`}>
        <svg
          role="presentation"
          viewBox="0 0 1024 48"
          className="h-10 w-full text-foreground/10 sm:h-12"
          fill="none"
        >
          <line x1="0" y1="24" x2="1024" y2="24" stroke="currentColor" strokeWidth="0.5" />
        </svg>
      </div>

      <div className={`${LANDING_SHELL} mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
        <p className="text-sm text-muted-foreground">
          © {year} AnyRouter OS
        </p>
        <div className="flex items-center gap-3">
          <ThemeModeButton size="lg" />
          <a
            href={LANDING_URLS.github}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Source
          </a>
        </div>
      </div>
    </footer>
  )
}
