/**
 * "Reconnecting…" pill for a fixed-height chrome strip (the workspace editor's top bar, the app
 * shell's top bar). Deliberately an inline chip rather than a full-width banner: a banner inserted
 * above the page reflows everything below it, so a blip that recovers on its own visibly jolts the
 * layout twice.
 */
export default function ReconnectingChip() {
  return (
    <span
      role="status"
      className="text-xs text-warning px-2 py-0.5 rounded-full bg-muted border border-warning/20"
    >
      Reconnecting…
    </span>
  )
}
