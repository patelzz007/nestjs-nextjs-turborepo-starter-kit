// ── Production bundle: esbuild ──────────────────────────────────────────────
// Bundles the SWC-compiled per-file output (`dist/src/main.js` + relative
// imports) into a single `dist/main.bundle.js`. Decorator metadata is already
// baked in by SWC during `nest build`, so plain esbuild suffices — no SWC plugin
// needed. Bare package imports stay external (resolved by Node at runtime);
// relative specifiers are inlined and their extensionless forms resolved at
// bundle time.
//
// Note: the nest CLI's SWC builder mirrors the `src/` tree under `dist/` (it
// does not apply tsc's `rootDir`), hence the `dist/src` entry path.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

await build({
	entryPoints: [resolve(root, "dist/src/main.js")],
	outfile: resolve(root, "dist/main.bundle.js"),
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node20",
	sourcemap: true,
	legalComments: "none",
	logLevel: "info",
	packages: "external",
});

console.warn("[bundle] done → dist/main.bundle.js");
