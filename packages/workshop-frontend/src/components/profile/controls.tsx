// Shared, on-language control classes and label atoms for the profile page (match the rest of
// the app: Workspaces/Blueprints headers, the gatekeepers toolbar, the command palette). Kept
// here so the page reads as part of the system rather than a stack of default Kumo cards.

export const PRIMARY_BTN =
  'press inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-kumo-brand px-3.5 text-[13px] font-medium tracking-[-0.25px] text-white transition-colors hover:bg-kumo-brand-hover disabled:cursor-not-allowed disabled:opacity-60'
export const SECONDARY_BTN =
  'press inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-kumo-line bg-kumo-base px-3.5 text-[13px] font-medium tracking-[-0.25px] text-kumo-default transition-colors hover:bg-kumo-tint disabled:cursor-not-allowed disabled:opacity-60'
export const INPUT =
  'h-9 w-full rounded-lg border border-kumo-line bg-kumo-base px-3 text-[14px] tracking-[-0.25px] text-kumo-default placeholder:text-kumo-inactive transition-[border-color,box-shadow] focus:border-kumo-ring focus:outline-none focus:ring-[3px] focus:ring-kumo-ring/15'

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-1 text-[12px] font-medium uppercase tracking-[0.08em] text-kumo-inactive">
      {children}
    </h2>
  )
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-medium tracking-[-0.1px] text-kumo-subtle">{children}</p>
  )
}

/** One read-only row inside a card: label, value, and an optional note under it. */
export function Field({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: React.ReactNode
}) {
  return (
    <div className="px-5 py-4">
      <FieldLabel>{label}</FieldLabel>
      <p className="mt-1 truncate text-[14px] tracking-[-0.25px] text-kumo-default">{value}</p>
      {note && <p className="mt-1 text-[12px] tracking-[-0.1px] text-kumo-subtle">{note}</p>}
    </div>
  )
}
