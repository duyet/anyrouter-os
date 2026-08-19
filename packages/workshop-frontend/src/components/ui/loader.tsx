import { cn } from "@/lib/utils"
import { SpinnerIcon } from "@phosphor-icons/react"

export function Loader({
  className,
  size = "md",
}: {
  className?: string
  size?: "sm" | "md" | "lg"
}) {
  const dim = size === "sm" ? "size-4" : size === "lg" ? "size-8" : "size-5"
  return (
    <SpinnerIcon
      className={cn(
        dim,
        "animate-spin text-muted-foreground motion-reduce:animate-none",
        className,
      )}
      aria-label="Loading"
    />
  )
}
