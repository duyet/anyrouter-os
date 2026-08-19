import { anyrouterProviderLogo } from '../../anyrouterMark'
import { LANDING_SHELL } from './tokens'

/** Same CDN marks AnyRouter's homepage uses for "Use it with". */
const LOGOS: { name: string; file: string; invert?: boolean }[] = [
  { name: 'OpenAI', file: 'openai-color.svg' },
  { name: 'Anthropic', file: 'anthropic-color.svg' },
  { name: 'xAI', file: 'xai-color.svg', invert: true },
  { name: 'Google', file: 'google-color.svg' },
  { name: 'DeepSeek', file: 'deepseek-color.svg' },
  { name: 'Qwen', file: 'qwen-color.svg' },
  { name: 'Moonshot', file: 'moonshotai-color.svg' },
  { name: 'Z.ai', file: 'z-ai.svg', invert: true },
  { name: 'StepFun', file: 'stepfun-color.svg' },
  { name: 'Cloudflare', file: 'cloudflare-color.svg' },
]

/**
 * Provider marks under the facts row. Shows the catalog is AnyRouter's, not a
 * one-model workshop. Monochrome SVGs invert in dark mode so they stay visible.
 */
export default function LogoStrip() {
  return (
    <section aria-label="Models via AnyRouter" className={`${LANDING_SHELL} pt-6 sm:pt-8`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Models via AnyRouter
        </p>
        <a
          href="https://anyrouter.dev/models"
          className="shrink-0 text-[12px] font-medium text-primary hover:underline"
        >
          + catalog
        </a>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {LOGOS.map(({ name, file, invert }) => (
          <li
            key={name}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5"
          >
            <img
              src={anyrouterProviderLogo(file)}
              alt=""
              width={14}
              height={14}
              decoding="async"
              className={`size-3.5 object-contain ${invert ? 'dark:invert' : ''}`}
            />
            <span className="text-[12px] font-medium text-foreground">{name}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
