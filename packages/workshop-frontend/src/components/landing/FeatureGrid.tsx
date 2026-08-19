import { ChatCircleText, Key, ShieldCheck, Stack, type Icon } from '@phosphor-icons/react'

const FACTS: { icon: Icon; label: string }[] = [
  { icon: ChatCircleText, label: 'Prompt → running app' },
  { icon: ShieldCheck, label: 'Sandboxed isolate' },
  { icon: Key, label: 'Your AnyRouter key' },
  { icon: Stack, label: 'Share as a blueprint' },
]

/** Four facts under the hero. Short enough to scan without reading the demos. */
export default function FeatureGrid() {
  return (
    <section aria-label="What it does, at a glance" className="mx-auto w-full max-w-5xl px-6 sm:px-8">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FACTS.map(({ icon: FactIcon, label }) => (
          <li
            key={label}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3"
          >
            <FactIcon size={16} weight="bold" aria-hidden="true" className="shrink-0 text-primary" />
            <span className="text-[13px] font-medium text-foreground">{label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
