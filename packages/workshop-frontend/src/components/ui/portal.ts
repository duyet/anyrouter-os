/** Kumo portal target: an element, a ref, or unset. */
export type PortalContainer = HTMLElement | null | { current: HTMLElement | null }

export function resolvePortalContainer(
  container?: PortalContainer,
): HTMLElement | null | undefined {
  if (container == null) return undefined
  if (typeof container === "object" && "current" in container) return container.current
  return container
}
