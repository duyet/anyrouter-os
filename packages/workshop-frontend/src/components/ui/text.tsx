import { cn } from "@/lib/utils"
import type * as React from "react"
import type { HTMLAttributes } from "react"

const TEXT_VARIANT_CLASS: Record<string, string> = {
  heading1: "text-3xl font-semibold tracking-tight",
  heading2: "text-2xl font-semibold tracking-tight",
  heading3: "text-xl font-semibold tracking-tight",
  heading4: "text-lg font-semibold",
  heading5: "text-base font-semibold",
  heading6: "text-sm font-semibold",
  body: "text-sm",
  secondary: "text-sm text-muted-foreground",
  muted: "text-sm text-muted-foreground",
  success: "text-sm text-success",
  error: "text-sm text-destructive",
  warning: "text-sm text-warning",
  default: "text-sm",
}

function Text({
  variant = "default",
  as: Tag = "p",
  size,
  bold,
  className,
  DANGEROUS_className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & {
  variant?: string
  as?: keyof React.JSX.IntrinsicElements
  size?: "sm" | "md" | "lg" | "xs"
  bold?: boolean
  DANGEROUS_className?: string
}) {
  const sizeClass =
    size === "lg" ? "text-base" : size === "sm" || size === "xs" ? "text-xs" : size === "md" ? "text-sm" : ""
  const cls = cn(
    TEXT_VARIANT_CLASS[variant] ?? TEXT_VARIANT_CLASS.default,
    sizeClass,
    bold && "font-semibold",
    className,
    DANGEROUS_className,
  )
  return (
    // @ts-expect-error dynamic tag from the `as` prop
    <Tag className={cls} {...props}>
      {children}
    </Tag>
  )
}

export { Text }
