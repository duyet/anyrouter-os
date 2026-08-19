import { cn } from "@/lib/utils"
import { Menu as DropdownMenuPrimitive } from "@base-ui/react"
import { CaretRightIcon, CheckIcon } from "@phosphor-icons/react"
import * as React from "react"
import { resolvePortalContainer } from "./portal"

function asChildProps(asChild: boolean | undefined, children: React.ReactNode) {
  if (!asChild || !React.isValidElement(children)) return { children }
  return typeof children.type === "string"
    ? { render: children as React.ReactElement, nativeButton: children.type === "button" }
    : { render: children as React.ReactElement }
}

type BaseUIClickEvent = React.MouseEvent<HTMLElement> & {
  preventBaseUIHandler?: () => void
}
type LegacySelectHandler = (event: BaseUIClickEvent) => void

function withSelect(
  onSelect: LegacySelectHandler | undefined,
  onClick: ((event: BaseUIClickEvent) => void) | undefined,
) {
  if (!onSelect) return onClick
  return (event: BaseUIClickEvent) => {
    onClick?.(event)
    onSelect(event)
    if (event.defaultPrevented) event.preventBaseUIHandler?.()
  }
}

function DropdownMenuRoot({ ...props }: DropdownMenuPrimitive.Root.Props) {
  return <DropdownMenuPrimitive.Root {...props} />
}

function DropdownMenuTrigger({
  asChild,
  children,
  ...props
}: DropdownMenuPrimitive.Trigger.Props & {
  asChild?: boolean
}) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
      {...asChildProps(asChild, children)}
    />
  )
}

function DropdownMenuTriggerShim({
  render,
  asChild,
  children,
  ...props
}: Omit<DropdownMenuPrimitive.Trigger.Props, "render"> & {
  render?: ((props: Record<string, unknown>) => React.ReactElement) | React.ReactElement
  asChild?: boolean
}) {
  if (render != null) {
    const rendered =
      typeof render === "function" ? render(props as Record<string, unknown>) : render
    return (
      <DropdownMenuPrimitive.Trigger
        data-slot="dropdown-menu-trigger"
        render={rendered as React.ReactElement}
        {...props}
      />
    )
  }
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
      {...asChildProps(asChild, children)}
    />
  )
}

function DropdownMenuContent({
  className,
  align = "start",
  sideOffset = 4,
  side,
  alignOffset,
  style,
  container,
  collisionPadding: _collisionPadding,
  ...props
}: DropdownMenuPrimitive.Popup.Props &
  Pick<DropdownMenuPrimitive.Positioner.Props, "side" | "align" | "sideOffset" | "alignOffset"> & {
    style?: React.CSSProperties
    container?: import("./portal").PortalContainer
    collisionPadding?: number
  }) {
  const portalContainer = resolvePortalContainer(container)
  return (
    <DropdownMenuPrimitive.Portal container={portalContainer ?? undefined}>
      <DropdownMenuPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className="isolate z-[1100]"
        style={style}
      >
        <DropdownMenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "z-[1100] max-h-(--available-height) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground outline-none",
            className,
          )}
          {...props}
        />
      </DropdownMenuPrimitive.Positioner>
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({ ...props }: DropdownMenuPrimitive.Group.Props) {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  asChild,
  children,
  icon,
  onSelect,
  onClick,
  ...props
}: Omit<DropdownMenuPrimitive.Item.Props, "onClick"> & {
  inset?: boolean
  variant?: "default" | "destructive" | "danger"
  asChild?: boolean
  icon?: React.ReactNode
  onSelect?: LegacySelectHandler
  onClick?: (event: BaseUIClickEvent) => void
}) {
  const resolved = variant === "danger" ? "destructive" : variant
  const body = (
    <>
      {icon}
      {children}
    </>
  )
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={resolved}
      className={cn(
        "relative flex min-h-7 cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden select-none data-highlighted:bg-muted data-disabled:pointer-events-none data-disabled:opacity-50 data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10",
        className,
      )}
      onClick={withSelect(onSelect, onClick)}
      {...props}
      {...(asChild ? asChildProps(true, children) : { children: body })}
    />
  )
}

function DropdownMenuSeparator({ className, ...props }: DropdownMenuPrimitive.Separator.Props) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function DropdownMenuLabel({
  className,
  ...props
}: DropdownMenuPrimitive.GroupLabel.Props) {
  return (
    <DropdownMenuPrimitive.Group>
      <DropdownMenuPrimitive.GroupLabel
        data-slot="dropdown-menu-label"
        className={cn("px-2 py-1 text-xs text-muted-foreground", className)}
        {...props}
      />
    </DropdownMenuPrimitive.Group>
  )
}

function DropdownMenuSub({ ...props }: DropdownMenuPrimitive.SubmenuRoot.Props) {
  return <DropdownMenuPrimitive.SubmenuRoot {...props} />
}

function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: DropdownMenuPrimitive.SubmenuTrigger.Props) {
  return (
    <DropdownMenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      className={cn(
        "flex min-h-7 cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden select-none data-highlighted:bg-muted",
        className,
      )}
      {...props}
    >
      {children}
      <CaretRightIcon className="ml-auto" />
    </DropdownMenuPrimitive.SubmenuTrigger>
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: DropdownMenuPrimitive.CheckboxItem.Props) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "relative flex min-h-7 cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-muted",
        className,
      )}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute right-2 flex items-center justify-center">
        <DropdownMenuPrimitive.CheckboxItemIndicator>
          <CheckIcon />
        </DropdownMenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

const DropdownMenuCompound = Object.assign(DropdownMenuRoot, {
  Root: DropdownMenuRoot,
  Trigger: DropdownMenuTriggerShim,
  Content: DropdownMenuContent,
  Group: DropdownMenuGroup,
  Label: DropdownMenuLabel,
  Item: DropdownMenuItem,
  CheckboxItem: DropdownMenuCheckboxItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
})

export {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuCompound as DropdownMenu,
}
