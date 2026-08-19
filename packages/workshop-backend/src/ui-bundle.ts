import type { UiBundle } from "@gadgets/workshop-shared/api";

/**
 * Assemble a UiBundle from optional `client.js` and `index.html` contents.
 *
 * A missing file is `undefined`; an empty file is `""`. Returns null only when both files are
 * absent, so static HTML can paint (and export to PDF) without client.js.
 */
export function uiBundleFromFiles(
  jsCode: string | undefined,
  html: string | undefined,
): UiBundle | null {
  if (jsCode === undefined && html === undefined) return null;
  let bundle: UiBundle = { jsCode: jsCode ?? "" };
  if (html !== undefined) bundle.html = html;
  return bundle;
}
