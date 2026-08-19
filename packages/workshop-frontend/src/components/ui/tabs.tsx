import { cn } from "@/lib/utils"
import { Tabs as TabsPrimitive } from "@base-ui/react"
import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

function TabsRoot({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      orientation={orientation}
      className={cn(
        "group/tabs flex min-w-0 gap-2 data-[orientation=horizontal]:w-full data-[orientation=horizontal]:flex-col",
        className,
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "inline-flex w-fit flex-nowrap items-center justify-center rounded-lg p-[3px] text-muted-foreground",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

function TabsList({
  className,
  variant = "default",
  activateOnFocus = true,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      activateOnFocus={activateOnFocus}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Tab>) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium text-muted-foreground transition-all hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 data-active:bg-background data-active:text-foreground",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Panel>) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

type TabsItem = { value: string; label: React.ReactNode }

function Tabs({
  tabs,
  value,
  defaultValue,
  onValueChange,
  className,
  variant,
  size: _size,
  children,
  ...props
}: React.ComponentProps<typeof TabsRoot> & {
  tabs?: TabsItem[]
  variant?: string
  size?: string
}) {
  const listVariant = variant === "underline" || variant === "line" ? "line" : "default"
  if (tabs?.length) {
    return (
      <TabsRoot
        value={value}
        defaultValue={defaultValue ?? tabs[0]?.value}
        onValueChange={onValueChange}
        className={className}
        {...props}
      >
        <TabsList variant={listVariant}>
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={
                listVariant === "line"
                  ? "rounded-none border-b-2 border-transparent data-active:border-primary data-active:bg-transparent"
                  : undefined
              }
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {children}
      </TabsRoot>
    )
  }
  return (
    <TabsRoot value={value} defaultValue={defaultValue} onValueChange={onValueChange} className={className} {...props}>
      {children}
    </TabsRoot>
  )
}

const TabsCompound = Object.assign(Tabs, {
  Root: TabsRoot,
  List: TabsList,
  Tab: TabsTrigger,
  Trigger: TabsTrigger,
  Panel: TabsContent,
  Content: TabsContent,
})

export { TabsCompound as Tabs, TabsContent, TabsList, TabsTrigger }
