// ============================================================
// scripts/fix-dist-extensions.mjs — add .js to emitted ESM imports
// ============================================================
// The repo's packages (and apps/api) are authored as extensionless ESM source
// so Turbopack and `moduleResolution: "bundler"` typechecking can resolve them.
// But Node's ESM runtime requires explicit `.js` extensions on relative
// imports, and `tsc` emits specifiers exactly as written — so a plain build
// would produce `dist/*.js` files containing `from "./app.module"` that Node
// refuses to load.
//
// This script rewrites a `dist/` directory after `tsc` emit: every relative
// specifier (`./x`, `../x`) that doesn't already carry an extension gets `.js`
// appended — in both the emitted `.js` files and the `.d.ts` files (so
// NodeNext/Node ESM consumers of the types resolve too). It is idempotent
// (unchanged files are not rewritten) and SELF-VERIFYING: after the rewrite it
// re-scans for any leftover extensionless relative specifier and exits non-zero
// if one survived, so a missed file becomes a build error instead of a
// runtime crash in production.
//
// Usage (run from the workspace whose dist/ you are fixing):
//   node ../../scripts/fix-dist-extensions.mjs dist
// The target dir is resolved relative to process.cwd(). Defaults to "dist".
//
// Wired into builds via package.json:
//   "build": "tsc -p tsconfig.build.json && node ../../scripts/fix-dist-extensions.mjs dist"
// ============================================================

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const targetDir = resolve(process.cwd(), process.argv[2] ?? "dist");

// Matches a quoted specifier inside `from "..."` / `import "..."` /
// `export ... from "..."` clauses. Captures the full quote + specifier so we
// only ever touch relative paths.
const RELATIVE_SPECIFIER = /(from\s+|import\s*)(["'])(\.{1,2}\/[^"']*?)(["'])/g;
const HAS_EXTENSION = /\.(?:js|mjs|cjs|json|css|ts|tsx)$/;

/** Recursively list all files under a directory. */
async function walk(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walk(full)));
		} else if (entry.isFile()) {
			files.push(full);
		}
	}
	return files;
}

/** Rewrite one file's relative specifiers, appending `.js` where missing. */
function rewrite(text) {
	return text.replace(RELATIVE_SPECIFIER, (match, keyword, quote, specifier, endQuote) => {
		if (HAS_EXTENSION.test(specifier)) {
			return match;
		}
		return `${keyword}${quote}${specifier}.js${endQuote}`;
	});
}

/** True when the file still contains an extensionless relative specifier. */
function hasLeftover(text) {
	const rewritten = rewrite(text);
	return rewritten !== text;
}

let scanned = 0;
let rewritten = 0;

const files = await walk(targetDir);
for (const file of files) {
	if (!/\.(?:js|mjs|cjs|d\.ts)$/.test(file)) {
		continue;
	}
	scanned += 1;
	const original = await readFile(file, "utf8");
	const fixed = rewrite(original);
	if (fixed !== original) {
		await writeFile(file, fixed);
		rewritten += 1;
	}
}

console.log(`fix-dist-extensions: scanned ${scanned} files, rewrote ${rewritten} (${targetDir})`);

// ── Self-verification ──────────────────────────────────────────────────────
// A second pass must find zero leftover extensionless specifiers. If one
// exists, the runtime would crash in production — fail the build loudly here.
const leftovers = [];
for (const file of files) {
	if (!/\.(?:js|mjs|cjs|d\.ts)$/.test(file)) {
		continue;
	}
	const text = await readFile(file, "utf8");
	if (hasLeftover(text)) {
		leftovers.push(file);
	}
}

if (leftovers.length > 0) {
	console.error(`fix-dist-extensions: FAILED self-check — ${leftovers.length} file(s) still contain extensionless relative imports:`);
	for (const file of leftovers) {
		console.error(`  - ${file}`);
	}
	process.exit(1);
}
