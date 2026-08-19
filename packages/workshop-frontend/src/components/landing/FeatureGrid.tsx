import { ChatCircleText, Key, ShieldCheck, Stack, type Icon } from '@phosphor-icons/react'

const FACTS: { icon: Icon; label: string }[] = [
  { icon: ChatCircleText, label: 'Describe an app, get one built' },
  { icon: ShieldCheck, label: 'Every gadget sandboxed on Cloudflare' },
  { icon: Key, label: 'Runs on your own AnyRouter key' },
  { icon: Stack, label: 'Start from a shared blueprint' },
]

/**
 * A terse, four-fact scan bar between the hero and the demos below — for a visitor who won't read
 * every demo, this alone should convey what the product does. The demos then prove each fact by
 * showing it happen.
 */
export default function FeatureGrid() {
  return (
    <section aria-label="What it does, at a glance" className="mx-auto w-full max-w-4xl px-6 sm:px-8">
      <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {FACTS.map(({ icon: FactIcon, label }) => (
          <li key={label} className="flex items-center gap-2.5 bg-card px-4 py-4">
            <FactIcon size={16} weight="bold" aria-hidden="true" className="shrink-0 text-primary" />
            <span className="text-[13px] font-medium tracking-[-0.15px] text-foreground">{label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
