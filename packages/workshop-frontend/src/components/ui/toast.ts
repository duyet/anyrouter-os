import { toast } from "sonner"

type ToastVariant = "default" | "error" | "success" | "info" | "warning"

/** Kumo `useKumoToastManager().add({ title, variant })` compatibility. */
export function useKumoToastManager() {
  return {
    add(input: { title: string; description?: string; variant?: ToastVariant }) {
      const opts = input.description ? { description: input.description } : undefined
      switch (input.variant) {
        case "error":
          toast.error(input.title, opts)
          return
        case "success":
          toast.success(input.title, opts)
          return
        case "warning":
          toast.warning(input.title, opts)
          return
        case "info":
          toast.info(input.title, opts)
          return
        default:
          toast(input.title, opts)
      }
    },
  }
}
