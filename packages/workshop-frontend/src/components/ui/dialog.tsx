import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog as DialogPrimitive } from "@base-ui/react"
import { XIcon } from "@phosphor-icons/react"
import * as React from "react"

function asChildProps(asChild: boolean | undefined, children: React.ReactNode) {
  if (!asChild || !React.isValidElement(children)) return { children }
  return typeof children.type === "string"
    ? { render: children as React.ReactElement, nativeButton: children.type === "button" }
    : { render: children as React.ReactElement }
}

function DialogRoot({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root {...props} />
}

function DialogTrigger({
  render,
  asChild,
  children,
  ...props
}: Omit<DialogPrimitive.Trigger.Props, "render"> & {
  render?: ((props: Record<string, unknown>) => React.ReactElement) | React.ReactElement
  asChild?: boolean
}) {
  if (render != null) {
    const rendered =
      typeof render === "function" ? render(props as Record<string, unknown>) : render
    return (
      <DialogPrimitive.Trigger
        data-slot="dialog-trigger"
        render={rendered as React.ReactElement}
        {...props}
      />
    )
  }
  return (
    <DialogPrimitive.Trigger
      data-slot="dialog-trigger"
      {...props}
      {...asChildProps(asChild, children)}
    />
  )
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal {...props} />
}

function DialogClose({
  render,
  asChild,
  children,
  ...props
}: Omit<DialogPrimitive.Close.Props, "render"> & {
  render?: ((props: Record<string, unknown>) => React.ReactElement) | React.ReactElement
  asChild?: boolean
}) {
  if (render != null) {
    const rendered =
      typeof render === "function" ? render(props as Record<string, unknown>) : render
    return (
      <DialogPrimitive.Close
        data-slot="dialog-close"
        render={rendered as React.ReactElement}
        {...props}
      />
    )
  }
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      {...props}
      {...asChildProps(asChild, children)}
    />
  )
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/30 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-popover p-6 text-sm text-popover-foreground outline-none sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button variant="ghost" className="absolute top-4 right-4" size="icon-sm">
                <XIcon />
                <span className="sr-only">Close</span>
              </Button>
            }
          />
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="dialog-header" className={cn("flex flex-col gap-1.5", className)} {...props} />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-base leading-none font-medium", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CompatDialog({
  children,
  size: _size,
  ...props
}: DialogPrimitive.Root.Props &
  React.ComponentProps<typeof DialogContent> & {
    size?: string
  }) {
  const isRoot =
    "open" in props ||
    "onOpenChange" in props ||
    "defaultOpen" in props ||
    React.Children.toArray(children).some(
      (child) =>
        React.isValidElement(child) &&
        (child.type === DialogTrigger || child.type === DialogContent),
    )
  if (isRoot) {
    const { className: _className, showCloseButton: _showCloseButton, ...rootProps } = props
    return <DialogPrimitive.Root {...rootProps}>{children}</DialogPrimitive.Root>
  }
  return <DialogContent {...props}>{children}</DialogContent>
}

const DialogCompound = Object.assign(CompatDialog, {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Title: DialogTitle,
  Description: DialogDescription,
  Content: DialogContent,
  Close: DialogClose,
  Header: DialogHeader,
  Footer: DialogFooter,
  Portal: DialogPortal,
  Overlay: DialogOverlay,
})

export {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  DialogCompound as Dialog,
}
