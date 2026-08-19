import { cn } from "@/lib/utils"
import type * as React from "react"

function Textarea({
  className,
  onValueChange,
  onChange,
  error,
  ...props
}: React.ComponentProps<"textarea"> & {
  onValueChange?: (value: string) => void
  error?: React.ReactNode
}) {
  return (
    <>
      <textarea
        data-slot="textarea"
        aria-invalid={error ? true : undefined}
        className={cn(
          "flex field-sizing-content min-h-16 w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm",
          className,
        )}
        onChange={(event) => {
          onChange?.(event)
          onValueChange?.(event.target.value)
        }}
        {...props}
      />
      {error != null && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </>
  )
}

function InputArea({
  label,
  description,
  className,
  error,
  onValueChange,
  ...props
}: React.ComponentProps<"textarea"> & {
  label?: React.ReactNode
  description?: React.ReactNode
  error?: React.ReactNode
  onValueChange?: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label != null ? <label className="text-sm font-medium text-foreground">{label}</label> : null}
      <Textarea className={className} error={error} onValueChange={onValueChange} {...props} />
      {description != null && error == null ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}

export { InputArea, Textarea }
