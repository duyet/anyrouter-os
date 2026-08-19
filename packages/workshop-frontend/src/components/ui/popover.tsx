import { cn } from "@/lib/utils"
import { Popover as PopoverPrimitive } from "@base-ui/react"
import * as React from "react"

function asChildProps(asChild: boolean | undefined, children: React.ReactNode) {
  if (!asChild || !React.isValidElement(children)) return { children }
  return typeof children.type === "string"
    ? { render: children as React.ReactElement, nativeButton: children.type === "button" }
    : { render: children as React.ReactElement }
}

function PopoverRoot({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root {...props} />
}

function PopoverTrigger({
  render,
  asChild,
  children,
  ...props
}: Omit<PopoverPrimitive.Trigger.Props, "render"> & {
  render?: ((props: Record<string, unknown>) => React.ReactElement) | React.ReactElement
  asChild?: boolean
}) {
  if (render != null) {
    const rendered = typeof render === "function" ? render(props as Record<string, unknown>) : render
    return (
      <PopoverPrimitive.Trigger
        data-slot="popover-trigger"
        render={rendered as React.ReactElement}
        {...props}
      />
    )
  }
  return (
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
      {...props}
      {...asChildProps(asChild, children)}
    />
  )
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  side,
  alignOffset,
  positionMethod: _positionMethod,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, "side" | "align" | "sideOffset" | "alignOffset"> & {
    positionMethod?: string
  }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        className="isolate z-[1100]"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "z-[1100] flex w-72 origin-(--transform-origin) flex-col rounded-lg border border-border bg-popover p-4 text-sm text-popover-foreground outline-hidden",
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

function PopoverTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <div data-slot="popover-title" className={cn("text-sm font-medium", className)} {...props} />
  )
}

const Popover = Object.assign(PopoverRoot, {
  Root: PopoverRoot,
  Trigger: PopoverTrigger,
  Content: PopoverContent,
  Title: PopoverTitle,
})

export { Popover, PopoverContent, PopoverTitle, PopoverTrigger }
