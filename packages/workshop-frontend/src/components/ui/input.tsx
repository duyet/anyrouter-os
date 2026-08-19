import { cn } from "@/lib/utils"
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react"
import * as React from "react"
import { InputArea } from "./textarea"

function Input({
  className,
  type,
  label,
  description,
  error,
  variant: _variant,
  size: sizeProp,
  onValueChange,
  onChange,
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & {
  label?: React.ReactNode
  description?: React.ReactNode
  error?: React.ReactNode
  variant?: string
  size?: "sm" | "default" | "lg" | number
  onValueChange?: (value: string) => void
}) {
  const sizeClass = sizeProp === "sm" ? "h-8 text-sm" : sizeProp === "lg" ? "h-10" : undefined
  const htmlSize = typeof sizeProp === "number" ? sizeProp : undefined
  const field = (
    <input
      type={type}
      data-slot="input"
      aria-invalid={error ? true : undefined}
      size={htmlSize}
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm",
        sizeClass,
        className,
      )}
      onChange={(event) => {
        onChange?.(event)
        onValueChange?.(event.target.value)
      }}
      {...props}
    />
  )
  if (label == null && description == null && error == null) return field
  return (
    <label className="flex flex-col gap-1.5">
      {label != null && <span className="text-sm font-medium text-foreground">{label}</span>}
      {field}
      {error != null ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : description != null ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </label>
  )
}

function SensitiveInput({
  label,
  description,
  error,
  variant: _variant,
  value,
  onValueChange,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "onChange"> & {
  label?: React.ReactNode
  description?: React.ReactNode
  error?: React.ReactNode
  variant?: string
  onValueChange?: (value: string) => void
}) {
  const [visible, setVisible] = React.useState(false)
  return (
    <label className="flex flex-col gap-1.5">
      {label != null && <span className="text-sm font-medium text-foreground">{label}</span>}
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          data-slot="input"
          aria-invalid={error ? true : undefined}
          value={value}
          className={cn(
            "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 pr-9 pl-2.5 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50 aria-invalid:border-destructive md:text-sm",
            className,
          )}
          onChange={(event) => onValueChange?.(event.target.value)}
          {...props}
        />
        <button
          type="button"
          className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={visible ? "Hide value" : "Show value"}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeSlashIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      </div>
      {error != null ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : description != null ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </label>
  )
}

export { Input, InputArea, SensitiveInput }
