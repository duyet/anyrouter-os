import { cn } from "@/lib/utils"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react"
import { CheckIcon } from "@phosphor-icons/react"
import type * as React from "react"

function Checkbox({
  className,
  label,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root> & { label?: React.ReactNode }) {
  const box = (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-[5px] border border-input bg-background transition-shadow outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current [&>svg]:size-3.5"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
  if (label == null) return box
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      {box}
      <span className="min-w-0">{label}</span>
    </label>
  )
}

export { Checkbox }
