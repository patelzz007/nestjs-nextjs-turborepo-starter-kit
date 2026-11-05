#!/usr/bin/env node
// `pnpm scaffold:context <name>` (enhancement 7.5): writes a new bounded context's compiling application slice
// into apps/api/src/contexts/<name>/ and prints the remaining steps. Refuses to touch an existing context.
// The layout and templates live in ./lib/scaffold-context.mjs (unit-tested).

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { contextFiles, nextSteps } from "./lib/scaffold-context.mjs";

const [name] = process.argv.slice(2).filter((argument) => argument !== "--");
if (name === undefined) {
	console.error("Usage: pnpm scaffold:context <name>   (lower-case words joined by hyphens, like loyalty-tiers)");
	process.exit(1);
}

const files = contextFiles(name);
const root = path.resolve(import.meta.dirname, "../../../apps/api/src/contexts", name);
if (existsSync(root)) {
	console.error(`apps/api/src/contexts/${name} already exists: nothing written.`);
	process.exit(1);
}
for (const [relative, content] of files) {
	const target = path.join(root, relative);
	mkdirSync(path.dirname(target), { recursive: true });
	writeFileSync(target, content);
	console.log(`created apps/api/src/contexts/${name}/${relative}`);
}
// Line lengths depend on the name, so the repository's own formatter has the last word on layout.
// Through `sh` as the other tooling scripts do: `pnpm` may be a script wrapper the OS won't exec directly.
const formatted = spawnSync("sh", ["-c", 'exec "$0" "$@"', "pnpm", "exec", "oxfmt", path.relative(path.resolve(import.meta.dirname, "../../../apps/api"), root)], {
	cwd: path.resolve(import.meta.dirname, "../../../apps/api"),
	stdio: "inherit",
});
if (formatted.status !== 0) {
	console.error("oxfmt could not format the new files; run `pnpm --filter @workspace/api format`.");
	process.exit(1);
}
console.log("\nNext:");
nextSteps(name).forEach((step, index) => {
	console.log(`  ${String(index + 1)}. ${step}`);
});
