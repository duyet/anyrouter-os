import { cn } from "@/lib/utils"
import type * as React from "react"
import { Checkbox } from "./checkbox"

function TableRoot({
  className,
  layout,
  ...props
}: React.ComponentProps<"table"> & { layout?: "fixed" | "auto" }) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", layout === "fixed" && "table-fixed", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  )
}

function TableRow({
  className,
  variant,
  ...props
}: React.ComponentProps<"tr"> & { variant?: "default" | "selected" }) {
  return (
    <tr
      data-slot="table-row"
      data-state={variant === "selected" ? "selected" : undefined}
      className={cn(
        "border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn("h-10 px-2 text-left align-middle font-medium text-foreground", className)}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td data-slot="table-cell" className={cn("p-2 align-middle", className)} {...props} />
  )
}

function TableCheckHead({
  checked,
  indeterminate,
  onValueChange,
  "aria-label": ariaLabel,
}: {
  checked?: boolean
  indeterminate?: boolean
  onValueChange?: (checked: boolean) => void
  "aria-label"?: string
}) {
  return (
    <TableHead className="w-10">
      <Checkbox
        checked={Boolean(checked || indeterminate)}
        onCheckedChange={(value) => onValueChange?.(value === true)}
        aria-label={ariaLabel}
      />
    </TableHead>
  )
}

function TableCheckCell({
  checked,
  onValueChange,
  "aria-label": ariaLabel,
}: {
  checked?: boolean
  onValueChange?: (checked: boolean) => void
  "aria-label"?: string
}) {
  return (
    <TableCell className="w-10">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onValueChange?.(value === true)}
        aria-label={ariaLabel}
      />
    </TableCell>
  )
}

const Table = Object.assign(TableRoot, {
  Header: TableHeader,
  Body: TableBody,
  Row: TableRow,
  Head: TableHead,
  Cell: TableCell,
  CheckHead: TableCheckHead,
  CheckCell: TableCheckCell,
})

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow }
