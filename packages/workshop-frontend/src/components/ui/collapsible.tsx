import { cn } from "@/lib/utils"
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react"
import { CaretDownIcon } from "@phosphor-icons/react"
import type { ReactElement, ReactNode } from "react"

function CollapsibleRoot({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  asChild,
  children,
  render,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Trigger> & { asChild?: boolean }) {
  if (asChild) {
    return (
      <CollapsiblePrimitive.Trigger
        data-slot="collapsible-trigger"
        render={children as ReactElement}
        {...props}
      />
    )
  }
  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" render={render} {...props}>
      {children}
    </CollapsiblePrimitive.Trigger>
  )
}

function CollapsibleContent({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Panel>) {
  return <CollapsiblePrimitive.Panel data-slot="collapsible-content" {...props} />
}

function DefaultTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Trigger> & { children?: ReactNode }) {
  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm text-foreground hover:bg-muted",
        className,
      )}
      {...props}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <CaretDownIcon className="size-4 shrink-0 text-muted-foreground" />
    </CollapsibleTrigger>
  )
}

const Collapsible = Object.assign(CollapsibleRoot, {
  Root: CollapsibleRoot,
  Trigger: CollapsibleTrigger,
  DefaultTrigger,
  Panel: CollapsibleContent,
  DefaultPanel: CollapsibleContent,
  Content: CollapsibleContent,
})

export { Collapsible, CollapsibleContent, CollapsibleTrigger }
