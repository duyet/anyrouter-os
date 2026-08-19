import { cn } from "@/lib/utils"
import { useRender } from "@base-ui/react"
import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:bg-transparent dark:hover:bg-input/30",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]",
        ghost: "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 px-3",
        xs: "h-6 gap-1 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-3",
        lg: "h-9 gap-1.5 px-4",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  icon,
  shape,
  loading,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  Omit<VariantProps<typeof buttonVariants>, "variant"> & {
    asChild?: boolean
    icon?: React.ReactNode
    loading?: boolean
    shape?: "square" | "circle" | "pill" | (string & {})
    variant?:
      | VariantProps<typeof buttonVariants>["variant"]
      | "primary"
      | "success"
      | "neutral"
      | "danger"
  }) {
  const shapeClass =
    shape === "square" ? "rounded-md" : shape === "circle" ? "rounded-full" : undefined
  const resolvedVariant =
    variant === ("primary" as typeof variant)
      ? "default"
      : variant === ("success" as typeof variant)
        ? "default"
        : variant === ("neutral" as typeof variant)
          ? "secondary"
          : variant === ("danger" as typeof variant)
            ? "destructive"
            : variant

  return useRender({
    defaultTagName: "button",
    render: asChild ? (children as React.ReactElement) : undefined,
    props: {
      "data-slot": "button",
      "data-variant": resolvedVariant,
      "data-size": size,
      className: cn(
        buttonVariants({
          variant: resolvedVariant as VariantProps<typeof buttonVariants>["variant"],
          size,
        }),
        shapeClass,
        className,
      ),
      disabled: disabled || loading,
      type: undefined,
      ...props,
      ...(asChild
        ? {}
        : {
            children: (
              <>
                {loading ? (
                  <span
                    aria-hidden
                    className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                  />
                ) : (
                  icon
                )}
                {children}
              </>
            ),
          }),
    },
  })
}

export { Button, buttonVariants }
