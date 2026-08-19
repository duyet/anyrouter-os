import { cn } from "@/lib/utils"
import { Select as SelectPrimitive } from "@base-ui/react"
import { CaretDownIcon, CaretUpIcon, CheckIcon } from "@phosphor-icons/react"
import * as React from "react"
import { type PortalContainer, resolvePortalContainer } from "./portal"

const NULL_VALUE = "__null__"

function encodeSelectValue(value: unknown): string | null {
  if (value == null || value === "") return null
  return String(value)
}

function decodeSelectValue(value: unknown): unknown {
  if (value == null || value === "" || value === NULL_VALUE) return null
  return value
}

function SelectRoot({ ...props }: SelectPrimitive.Root.Props<any>) {
  return <SelectPrimitive.Root {...props} />
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("data-placeholder:text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & { size?: "sm" | "default" }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={<CaretDownIcon className="pointer-events-none size-4 text-muted-foreground" />}
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  container,
  ...props
}: SelectPrimitive.Popup.Props & { container?: PortalContainer }) {
  const portalContainer = resolvePortalContainer(container)
  return (
    <SelectPrimitive.Portal container={portalContainer ?? undefined}>
      <SelectPrimitive.Positioner alignItemWithTrigger={false} sideOffset={4} className="isolate z-[1100]">
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "relative z-[1100] min-w-36 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground",
            className,
          )}
          {...props}
        >
          <SelectPrimitive.ScrollUpArrow className="flex items-center justify-center bg-popover py-1">
            <CaretUpIcon className="size-4" />
          </SelectPrimitive.ScrollUpArrow>
          <SelectPrimitive.List className="max-h-(--available-height) overflow-y-auto p-1">
            {children}
          </SelectPrimitive.List>
          <SelectPrimitive.ScrollDownArrow className="flex items-center justify-center bg-popover py-1">
            <CaretDownIcon className="size-4" />
          </SelectPrimitive.ScrollDownArrow>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, children, value, ...props }: SelectPrimitive.Item.Props) {
  const itemValue = value == null ? NULL_VALUE : String(value)
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      value={itemValue}
      className={cn(
        "relative flex min-h-7 w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-muted data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

type CompatSelectProps = Omit<SelectPrimitive.Root.Props<any>, "value" | "defaultValue" | "onValueChange"> & {
  className?: string
  size?: "sm" | "default"
  placeholder?: React.ReactNode
  "aria-label"?: string
  renderValue?: (value: any) => React.ReactNode
  label?: React.ReactNode
  error?: React.ReactNode
  container?: PortalContainer
  value?: any
  defaultValue?: any
  onValueChange?: (value: any) => void
}

function CompatSelect({
  className,
  size,
  placeholder,
  renderValue,
  children,
  value,
  defaultValue,
  onValueChange,
  "aria-label": ariaLabel,
  label,
  error,
  container,
  ...props
}: CompatSelectProps) {
  const childArray = React.Children.toArray(children)
  const rootValue = value == null || value === "" ? null : encodeSelectValue(value)
  const rootDefaultValue = defaultValue == null || defaultValue === "" ? undefined : encodeSelectValue(defaultValue)

  const labelByValue = new Map<string, React.ReactNode>()
  for (const child of childArray) {
    if (!React.isValidElement(child)) continue
    const childProps = child.props as { value?: unknown; children?: React.ReactNode }
    const key = childProps.value == null ? NULL_VALUE : String(childProps.value)
    labelByValue.set(key, childProps.children)
  }
  const current = rootValue ?? rootDefaultValue ?? null
  const display =
    current != null
      ? (renderValue?.(decodeSelectValue(current) ?? (value == null ? null : value)) ?? labelByValue.get(current) ?? current)
      : placeholder

  const field = (
    <SelectPrimitive.Root
      value={rootValue}
      defaultValue={rootDefaultValue}
      onValueChange={(next) => onValueChange?.(decodeSelectValue(next))}
      {...props}
    >
      <SelectTrigger size={size} aria-label={ariaLabel} className={className} aria-invalid={error ? true : undefined}>
        <SelectValue placeholder={placeholder}>{display}</SelectValue>
      </SelectTrigger>
      <SelectContent container={container}>{children}</SelectContent>
    </SelectPrimitive.Root>
  )

  if (label == null && error == null) return field
  return (
    <label className="flex flex-col gap-1.5">
      {label != null && <span className="text-sm font-medium text-foreground">{label}</span>}
      {field}
      {error != null && <p className="text-xs text-destructive">{error}</p>}
    </label>
  )
}

const Select = Object.assign(CompatSelect, {
  Root: SelectRoot,
  Trigger: SelectTrigger,
  Content: SelectContent,
  Item: SelectItem,
  Option: SelectItem,
  Value: SelectValue,
})

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
export type { PortalContainer }
