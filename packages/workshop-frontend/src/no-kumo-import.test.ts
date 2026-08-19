// @vitest-environment node

// @ts-expect-error node builtin without @types/node
import { readdirSync, readFileSync, statSync } from "node:fs"
// @ts-expect-error node builtin without @types/node
import { dirname, join, relative } from "node:path"
// @ts-expect-error node builtin without @types/node
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const ROOT = dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = join(ROOT, "..")
const THIS_FILE = fileURLToPath(import.meta.url)
const KUMO = ["@", "cloudflare", "/", "kumo"].join("")
const FIRST_CHILD_HIDE = ["[", "&>:first-child", "]", ":hidden"].join("")
const PROMPT_GLOW = ["prompt", "-", "glow"].join("")

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, files)
    else if (/\.(ts|tsx|js|jsx|css|json)$/.test(entry)) files.push(full)
  }
  return files
}

describe("workshop-frontend has no Kumo", () => {
  it("fails if any source file still imports the Kumo package", () => {
    const hits: string[] = []
    for (const file of walk(PACKAGE_ROOT)) {
      const src = readFileSync(file, "utf8")
      if (src.includes(KUMO)) hits.push(relative(PACKAGE_ROOT, file))
    }
    expect(hits).toEqual([])
  })

  // useKumoToastManager / Toasty remain until a follow-up migrates those call sites.
  it("fails if leftover Kumo-arrow hide or prompt-glow classes remain", () => {
    const hits: string[] = []
    for (const file of walk(PACKAGE_ROOT)) {
      if (file === THIS_FILE) continue
      const src = readFileSync(file, "utf8")
      if (src.includes(FIRST_CHILD_HIDE) || src.includes(PROMPT_GLOW)) {
        hits.push(relative(PACKAGE_ROOT, file))
      }
    }
    expect(hits).toEqual([])
  })
})
