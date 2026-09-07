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
// String/template literal contents are skipped so generator templates that
// embed import-like text are not rewritten or flagged.
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

const CODE_SPECIFIER = /^(from\s+|import\s*\(|import\s+(?=["']))(["'])(\.{1,2}\/[^"']*?)(["'])/;
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

function skipQuoted(text, start) {
	const quote = text[start];
	let i = start + 1;
	while (i < text.length) {
		const ch = text[i];
		if (ch === "\\") {
			i += 2;
			continue;
		}
		if (ch === quote) {
			return i;
		}
		i += 1;
	}
	return text.length - 1;
}

function skipBraceExpression(text, start) {
	let depth = 1;
	let i = start;
	while (i < text.length && depth > 0) {
		const ch = text[i];
		if (ch === "{") {
			depth += 1;
			i += 1;
			continue;
		}
		if (ch === "}") {
			depth -= 1;
			i += 1;
			continue;
		}
		if (ch === '"' || ch === "'") {
			i = skipQuoted(text, i) + 1;
			continue;
		}
		if (ch === "`") {
			i = skipTemplate(text, i) + 1;
			continue;
		}
		if (ch === "/" && text[i + 1] === "/") {
			const newline = text.indexOf("\n", i);
			i = newline === -1 ? text.length : newline;
			continue;
		}
		if (ch === "/" && text[i + 1] === "*") {
			const end = text.indexOf("*/", i + 2);
			i = end === -1 ? text.length : end + 2;
			continue;
		}
		i += 1;
	}
	return i;
}

function skipTemplate(text, start) {
	let i = start + 1;
	while (i < text.length) {
		const ch = text[i];
		if (ch === "\\") {
			i += 2;
			continue;
		}
		if (ch === "`") {
			return i;
		}
		if (ch === "$" && text[i + 1] === "{") {
			i = skipBraceExpression(text, i + 2);
			continue;
		}
		if (ch === '"' || ch === "'") {
			i = skipQuoted(text, i) + 1;
			continue;
		}
		i += 1;
	}
	return text.length - 1;
}

function rewriteSpecifierMatch(match) {
	const keyword = match[1];
	const quote = match[2];
	const specifier = match[3];
	const endQuote = match[4];
	if (HAS_EXTENSION.test(specifier)) {
		return match[0];
	}
	return `${keyword}${quote}${specifier}.js${endQuote}`;
}

/** Rewrite relative import specifiers outside of string/template literals. */
function rewrite(text) {
	let result = "";
	let i = 0;

	while (i < text.length) {
		if (text.startsWith("//", i)) {
			const newline = text.indexOf("\n", i);
			const end = newline === -1 ? text.length : newline;
			result += text.slice(i, end);
			i = end;
			continue;
		}

		const ch = text[i];
		if (ch === '"' || ch === "'") {
			const end = skipQuoted(text, i);
			result += text.slice(i, end + 1);
			i = end + 1;
			continue;
		}

		if (ch === "`") {
			const end = skipTemplate(text, i);
			result += text.slice(i, end + 1);
			i = end + 1;
			continue;
		}

		if (text.startsWith("/*", i)) {
			const end = text.indexOf("*/", i + 2);
			const sliceEnd = end === -1 ? text.length : end + 2;
			result += text.slice(i, sliceEnd);
			i = sliceEnd;
			continue;
		}

		const rest = text.slice(i);
		const match = rest.match(CODE_SPECIFIER);
		if (match !== null) {
			result += rewriteSpecifierMatch(match);
			i += match[0].length;
			continue;
		}

		result += ch;
		i += 1;
	}

	return result;
}

/** True when executable code still contains an extensionless relative import specifier. */
function hasLeftover(text) {
	let i = 0;

	while (i < text.length) {
		if (text.startsWith("//", i)) {
			const newline = text.indexOf("\n", i);
			i = newline === -1 ? text.length : newline;
			continue;
		}

		const ch = text[i];
		if (ch === '"' || ch === "'") {
			i = skipQuoted(text, i) + 1;
			continue;
		}

		if (ch === "`") {
			i = skipTemplate(text, i) + 1;
			continue;
		}

		if (text.startsWith("/*", i)) {
			const end = text.indexOf("*/", i + 2);
			i = end === -1 ? text.length : end + 2;
			continue;
		}

		const rest = text.slice(i);
		const match = rest.match(CODE_SPECIFIER);
		if (match !== null) {
			const specifier = match[3];
			if (specifier !== undefined && !HAS_EXTENSION.test(specifier)) {
				return true;
			}
			i += match[0].length;
			continue;
		}

		i += 1;
	}

	return false;
}

function rewriteUntilStable(text) {
	let current = text;
	for (let pass = 0; pass < 8; pass += 1) {
		const next = rewrite(current);
		if (next === current) {
			return current;
		}
		current = next;
	}
	return rewrite(current);
}

function isTargetFile(file) {
	return /\.(?:js|mjs|cjs|d\.ts)$/.test(file);
}

async function listTargetFiles(rootDir) {
	const files = await walk(rootDir);
	return files.filter(isTargetFile);
}

async function rewriteFileIfNeeded(file) {
	const original = await readFile(file, "utf8");
	const fixed = rewriteUntilStable(original);
	if (fixed === original) {
		return false;
	}
	await writeFile(file, fixed);
	return true;
}

async function rewriteAll(files) {
	let changed = 0;
	for (const file of files) {
		if (await rewriteFileIfNeeded(file)) {
			changed += 1;
		}
	}
	return changed;
}

async function findLeftovers(files) {
	const leftovers = [];
	for (const file of files) {
		const text = await readFile(file, "utf8");
		if (hasLeftover(text)) {
			leftovers.push(file);
		}
	}
	return leftovers;
}

const files = await listTargetFiles(targetDir);
const scanned = files.length;
let rewritten = 0;

// Global passes — some files only stabilize after dependents are rewritten first.
for (let pass = 0; pass < 5; pass += 1) {
	const changed = await rewriteAll(files);
	rewritten += changed;
	if (changed === 0) {
		break;
	}
}

console.log(`fix-dist-extensions: scanned ${scanned} files, rewrote ${rewritten} (${targetDir})`);

// Self-verification with repair retries. `tsc --watch` (or turbo cache restore) can
// briefly rewrite dist/ between our pass and the check — repair instead of failing.
const MAX_REPAIR_ROUNDS = 5;
let leftovers = await findLeftovers(files);

for (let round = 0; round < MAX_REPAIR_ROUNDS && leftovers.length > 0; round += 1) {
	for (const file of leftovers) {
		await rewriteFileIfNeeded(file);
	}
	leftovers = await findLeftovers(files);
}

if (leftovers.length > 0) {
	console.error(`fix-dist-extensions: FAILED self-check — ${leftovers.length} file(s) still contain extensionless relative imports:`);
	for (const file of leftovers) {
		console.error(`  - ${file}`);
	}
	console.error("Stop any process that writes to dist/ without .js extensions (e.g. an old `tsc --watch` on @workspace/cli).");
	process.exit(1);
}
