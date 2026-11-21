#!/usr/bin/env node
/**
 * `pnpm kit:compare <path-to-nextjs-admin-dashboard-layout> [--scope <folder>] [--sync]` compares this repository's
 * web kit (`packages/ui`, the shared kit logic, the showcase examples) with its copy in the sister repository, and
 * lists every file that is missing there or differs beyond its import specifiers. Exits 1 while anything differs.
 * `--sync` instead writes this repository's version of every such file (in `--scope`) into the sister repository,
 * with its specifiers mapped: this repository is the source of truth. Run the sister repository's formatter and gates
 * after it. Each repository's CI cannot see the other, so this runs locally; see docs/technical/tooling/kit-compare.md.
 * The folders and specifiers it maps are `kitPairs.web` in tooling.config.ts.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { settings } from "../shared/settings.ts";
import { compareKitFile, kitCopyOf, kitDrift, mapKitPath, type KitFileReport, type KitPair } from "./kit-compare.ts";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const SOURCE_FILE = /\.(?:ts|tsx|json|md)$/u;
const SKIPPED_FOLDERS = new Set(["node_modules", "generated", "coverage", ".turbo"]);
const PAIR: KitPair = settings.kitPairs.web;

const [otherRoot, ...rest] = process.argv.slice(2);
if (otherRoot === undefined || !existsSync(otherRoot)) {
	process.stderr.write("Usage: pnpm kit:compare <path-to-nextjs-admin-dashboard-layout> [--scope <folder of this repository>] [--sync]\n");
	process.exit(1);
}
const scopeFlag = rest.indexOf("--scope");
const scope = scopeFlag === -1 ? "" : (rest.at(scopeFlag + 1) ?? "");
const sync = rest.includes("--sync");

function filesUnder(relativeFolder: string): string[] {
	const absolute = path.join(ROOT, relativeFolder);
	if (!existsSync(absolute)) {
		return [];
	}
	return readdirSync(absolute).flatMap((entry): string[] => {
		const relative = `${relativeFolder}${entry}`;
		if (statSync(path.join(ROOT, relative)).isDirectory()) {
			return SKIPPED_FOLDERS.has(entry) ? [] : filesUnder(`${relative}/`);
		}
		return SOURCE_FILE.test(entry) ? [relative] : [];
	});
}

/** A folder mapping's files, or a one-file mapping's file (a file the kit uses from a folder it does not map whole). */
function filesOf(from: string): string[] {
	if (from.endsWith("/")) {
		return filesUnder(from);
	}
	return existsSync(path.join(ROOT, from)) ? [from] : [];
}

// A one-file mapping inside a mapped folder is reached twice: by the folder walk and on its own.
const compared: readonly string[] = [...new Set(PAIR.paths.flatMap((mapping) => filesOf(mapping.from)))];
const reports: KitFileReport[] = compared
	.filter((relative) => relative.startsWith(scope))
	.flatMap((relative): KitFileReport[] => {
		const copyPath = mapKitPath(relative, PAIR);
		if (copyPath === null) {
			return [];
		}
		const copyFile = path.join(otherRoot, copyPath);
		const copy = existsSync(copyFile) ? readFileSync(copyFile, "utf8") : null;
		return [{ path: relative, copyPath, status: compareKitFile(readFileSync(path.join(ROOT, relative), "utf8"), copy, PAIR) }];
	});

const drift = kitDrift(reports);
if (sync) {
	for (const report of drift) {
		const copyFile = path.join(otherRoot, report.copyPath);
		mkdirSync(path.dirname(copyFile), { recursive: true });
		writeFileSync(copyFile, kitCopyOf(readFileSync(path.join(ROOT, report.path), "utf8"), PAIR));
		process.stdout.write(`synced    ${report.path} → ${report.copyPath}\n`);
	}
	process.stdout.write(`${String(drift.length)} files written; run the sister repository's formatter and gates next\n`);
	process.exit(0);
}
for (const report of drift) {
	process.stdout.write(`${report.status === "missing" ? "missing  " : "differs  "} ${report.path} → ${report.copyPath}\n`);
}
process.stdout.write(`${String(reports.length)} files compared, ${String(reports.length - drift.length)} the same, ${String(drift.length)} to settle\n`);
process.exit(drift.length === 0 ? 0 : 1);
