import { cn } from "@/lib/utils"
import { Separator as SeparatorPrimitive } from "@base-ui/react"
import type * as React from "react"

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive> & {
  decorative?: boolean
}) {
  const decorativeProps = decorative
    ? ({ role: "none", "aria-orientation": undefined } as const)
    : {}

  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      {...decorativeProps}
      className={cn(
        "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className,
      )}
      {...props}
    />
  )
}

export { Separator }
