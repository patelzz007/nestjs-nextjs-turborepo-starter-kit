#!/usr/bin/env node

/**
 * Post-build script: add `.js` extensions to relative imports in ESM output.
 *
 * When TypeScript compiles with `module: "ESNext"` + `moduleResolution: "bundler"`,
 * the emitted JavaScript keeps extensionless relative imports (e.g. `from "./auth"`).
 * Node.js ESM requires explicit `.js` extensions, so this script rewrites them
 * before the package is consumed at runtime.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const distDir = new URL("../dist", import.meta.url).pathname

/** Walk a directory recursively and process each `.js` file found. */
function processDir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      processDir(fullPath)
    } else if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".d.ts"))) {
      addJsExtensions(fullPath)
    }
  }
}

/** Add `.js` extensions to bare relative imports in a single `.js` file. */
function addJsExtensions(filePath) {
  const content = readFileSync(filePath, "utf-8")
  const updated = content.replace(
    /(from\s+["'])(\.\.?\/[^"']*?)(["'])/g,
    (_match, prefix, path, suffix) => {
      // Skip if the path already has a JS-like extension
      if (/\.(js|mjs|cjs|json)$/.test(path)) return _match
      return `${prefix}${path}.js${suffix}`
    },
  )

  if (updated !== content) {
    writeFileSync(filePath, updated, "utf-8")
  }
}

console.log("Adding .js extensions to relative imports…")
processDir(distDir)
console.log("Done.")
