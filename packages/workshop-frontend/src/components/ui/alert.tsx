import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

const alertVariants = cva(
  "relative grid w-full gap-0.5 rounded-xl border px-4 py-3 text-left text-sm",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive: "border-destructive/30 bg-card text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div role="alert" data-slot="alert" className={cn(alertVariants({ variant }), className)} {...props} />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("font-medium", className)} {...props} />
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

/** Kumo Banner-compatible surface: `<Banner variant="error" title={…} />`. */
function Banner({
  variant = "default",
  title,
  className,
  children,
}: {
  variant?: "default" | "error" | "info" | "warning" | "success"
  title?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  const resolved = variant === "error" ? "destructive" : "default"
  return (
    <Alert variant={resolved} className={className}>
      {title != null && <AlertTitle>{title}</AlertTitle>}
      {children != null && <AlertDescription>{children}</AlertDescription>}
    </Alert>
  )
}

export { Alert, AlertDescription, AlertTitle, Banner }
