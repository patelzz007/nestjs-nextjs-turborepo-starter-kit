#!/usr/bin/env node
/**
 * `pnpm project:sync` writes project.json (the project's slug and display name) into every file that
 * holds a copy; `--check` (run by `pnpm lint`) fails, naming the files, while any copy is out of date.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { driftedTargets, parseProjectIdentity } from "./project-identity.ts";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const check = process.argv.includes("--check");

const identity = parseProjectIdentity(readFileSync(path.join(ROOT, "project.json"), "utf8"));
const read = (relative: string): string => {
	const file = path.join(ROOT, relative);
	return existsSync(file) ? readFileSync(file, "utf8") : "";
};
const drifted = driftedTargets(identity, read);

if (check) {
	if (drifted.length > 0) {
		process.stderr.write(
			`project.json (${identity.slug}, "${identity.displayName}") is not applied to:\n${drifted.map((target) => `  - ${target.path}`).join("\n")}\nRun \`pnpm project:sync\`.\n`,
		);
		process.exit(1);
	}
	process.stdout.write(`✓ project identity (${identity.slug}, "${identity.displayName}") is applied everywhere\n`);
} else {
	for (const target of drifted) {
		writeFileSync(path.join(ROOT, target.path), target.next);
		process.stdout.write(`  updated ${target.path}\n`);
	}
	process.stdout.write(`${drifted.length === 0 ? "✓ nothing to update" : `✓ applied ${identity.slug} / "${identity.displayName}"`}\n`);
}
