import { cn } from "@/lib/utils"
import { Tooltip as TooltipPrimitive } from "@base-ui/react"
import * as React from "react"

function asChildProps(asChild: boolean | undefined, children: React.ReactNode) {
  return asChild && React.isValidElement(children)
    ? { render: children as React.ReactElement }
    : { children }
}

function TooltipProvider({
  delayDuration = 0,
  delay,
  ...props
}: TooltipPrimitive.Provider.Props & {
  delayDuration?: number
}) {
  return <TooltipPrimitive.Provider delay={delay ?? delayDuration} {...props} />
}

function Tooltip({
  content,
  children,
  asChild = true,
  className,
  side,
  delay,
  render,
  ...props
}: TooltipPrimitive.Root.Props & {
  content?: React.ReactNode
  asChild?: boolean
  className?: string
  side?: React.ComponentProps<typeof TooltipContent>["side"]
  delay?: number
  /** Kumo `render={<button/>}` form. */
  render?: React.ReactElement
}) {
  const trigger = render ?? children
  if (content == null) {
    return (
      <TooltipPrimitive.Provider delay={delay ?? 0}>
        <TooltipPrimitive.Root {...props}>{trigger}</TooltipPrimitive.Root>
      </TooltipPrimitive.Provider>
    )
  }
  return (
    <TooltipPrimitive.Provider delay={delay ?? 0}>
      <TooltipPrimitive.Root {...props}>
        <TooltipPrimitive.Trigger
          data-slot="tooltip-trigger"
          delay={delay}
          {...asChildProps(asChild, trigger as React.ReactNode)}
        />
        <TooltipContent side={side} className={className}>
          {content}
        </TooltipContent>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

function TooltipContent({
  className,
  sideOffset = 4,
  side,
  align,
  alignOffset,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, "side" | "align" | "sideOffset" | "alignOffset">) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-50 inline-flex w-fit max-w-xs items-center gap-1.5 rounded-lg border border-border bg-foreground px-3 py-1.5 text-xs text-background",
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipProvider }
