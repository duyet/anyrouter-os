import { cn } from "@/lib/utils"
import type * as React from "react"

function Input({
  className,
  type,
  label,
  description,
  error,
  ...props
}: React.ComponentProps<"input"> & {
  label?: React.ReactNode
  description?: React.ReactNode
  error?: React.ReactNode
}) {
  const field = (
    <input
      type={type}
      data-slot="input"
      aria-invalid={error ? true : undefined}
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-[color,box-shadow] duration-200 outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        className,
      )}
      {...props}
    />
  )
  if (label == null && description == null && error == null) return field
  return (
    <label className="flex flex-col gap-1.5">
      {label != null && <span className="text-sm font-medium">{label}</span>}
      {field}
      {error != null ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : description != null ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </label>
  )
}

export { Input }
