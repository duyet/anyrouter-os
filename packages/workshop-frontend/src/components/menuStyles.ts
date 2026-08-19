/**
 * Shared styling for kebab / overflow DropdownMenu menus. Hairline popover —
 * no decorative shadow — matching anyrouter.dev.
 */
export const MENU_CONTENT =
  '!z-[1100] !min-w-[180px] rounded-lg border border-border bg-popover p-1 outline-none focus:outline-none focus-visible:outline-none'

export const MENU_POSITIONER_STYLE = { zIndex: 1100 } as const

export const MENU_ITEM =
  '!h-auto rounded-md !px-2.5 !py-1.5 text-[13px] leading-[18px] tracking-[-0.25px] text-foreground data-highlighted:bg-muted'

export const MENU_ITEM_DANGER =
  '!h-auto rounded-md !px-2.5 !py-1.5 text-[13px] leading-[18px] tracking-[-0.25px] text-destructive data-highlighted:bg-destructive/10'
