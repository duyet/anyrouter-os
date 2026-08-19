export const PRIMARY_BTN =
  'press inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-medium tracking-[-0.25px] text-primary-foreground transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60'
export const SECONDARY_BTN =
  'press inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3.5 text-[13px] font-medium tracking-[-0.25px] text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60'
export const INPUT =
  'h-9 w-full rounded-lg border border-input bg-transparent px-3 text-[14px] tracking-[-0.25px] text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow] focus:border-ring focus:outline-none focus:ring-[3px] focus:ring-ring/15'

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-1 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </h2>
  )
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-medium tracking-[-0.1px] text-muted-foreground">{children}</p>
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
      <p className="mt-1 truncate text-[14px] tracking-[-0.25px] text-foreground">{value}</p>
      {note && <p className="mt-1 text-[12px] tracking-[-0.1px] text-muted-foreground">{note}</p>}
    </div>
  )
}
