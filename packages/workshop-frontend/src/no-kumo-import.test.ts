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
const KUMO = ["@", "cloudflare", "/", "kumo"].join("")

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
})
