#!/usr/bin/env node
// `pnpm certify:check [-- --field <name>] [--no-gate]` (enhancement 7.6): checks the certification exercise
// (docs/technical/certification-exercise.md) in every layer, then runs the repository's full gate.

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { CERTIFICATION_FILES, certificationLayers } from "./lib/certification-check.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const GATE = ["format", "lint", "typecheck", "test", "test:e2e", "ci:local"];

const args = process.argv.slice(2).filter((argument) => argument !== "--");
const fieldIndex = args.indexOf("--field");
const field = fieldIndex === -1 ? "badgeColor" : (args.at(fieldIndex + 1) ?? "");
const runGate = !args.includes("--no-gate");

const read = (relative) => readFileSync(path.join(ROOT, relative), "utf8");

/** Every file under `relative` whose name passes `keep`, as source text. */
function sourcesUnder(relative, keep) {
	const found = [];
	const walk = (directory) => {
		for (const entry of readdirSync(directory)) {
			if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
			const full = path.join(directory, entry);
			if (statSync(full).isDirectory()) {
				walk(full);
			} else if (keep(full)) {
				found.push(readFileSync(full, "utf8"));
			}
		}
	};
	walk(path.join(ROOT, relative));
	return found;
}

const isTest = (file) => /(\/__tests__\/|\/test\/).*\.(test|spec|e2e-spec)\.tsx?$/u.test(file);
const layers = certificationLayers(field, {
	contract: read(CERTIFICATION_FILES.contract),
	schema: read(CERTIFICATION_FILES.schema),
	seed: read(CERTIFICATION_FILES.seed),
	migrations: sourcesUnder("apps/api/prisma/migrations", (file) => file.endsWith("migration.sql")),
	tests: [
		...sourcesUnder("packages/shared/src/contexts/catalog", isTest),
		...sourcesUnder("apps/api/test", isTest),
		...sourcesUnder("apps/api/src/contexts/catalog", isTest),
		...sourcesUnder("apps/admin/contexts/catalog", isTest),
	],
	adminSources: sourcesUnder("apps/admin/contexts/catalog", (file) => /\.tsx?$/u.test(file) && !isTest(file)),
});

console.log(`Certification exercise: \`${field}\` on the sample category\n`);
for (const { layer, done, hint } of layers) {
	console.log(`  ${done ? "✓" : "✗"} ${layer.padEnd(10)}${done ? "" : `  ${hint}`}`);
}
const missing = layers.filter((layer) => !layer.done);
if (missing.length > 0) {
	console.log(`\n${String(missing.length)} layer(s) still to do.`);
	process.exit(1);
}
if (!runGate) {
	console.log("\nEvery layer is there. Run without --no-gate for the full gate.");
	process.exit(0);
}
for (const step of GATE) {
	console.log(`\n▶ pnpm run ${step}`);
	// Through `sh` as the other tooling scripts do: `pnpm` may be a script wrapper the OS won't exec directly.
	const result = spawnSync("sh", ["-c", 'exec "$0" "$@"', "pnpm", "run", step], { cwd: ROOT, stdio: "inherit" });
	if (result.status !== 0) {
		console.log(`\n✗ ${step} failed: fix it and run again.`);
		process.exit(1);
	}
}
console.log("\n✓ Every layer is there and the gate passes: ready for review.");
