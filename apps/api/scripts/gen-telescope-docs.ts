// ============================================
// scripts/gen-telescope-docs.ts — doc generator (improvement 20)
// ============================================
// Derives the §14.1 env-var table and the endpoint list for docs/telescope.md
// straight from the source files, so the doc can never drift from the code:
//
//   pnpm --filter @workspace/api telescope:docs
//
// Output: prints two markdown tables to stdout. Paste them into the doc, or
// pipe into a file (`> /tmp/telescope-tables.md`). The generator is dumb by
// design — regex over the two files — and fails loudly if it finds nothing.
// ============================================

/* eslint-disable no-console -- The script's output IS the generated markdown tables. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const OPTIONS_FILE: string = resolve(process.cwd(), "src/modules/telescope/telescope.options.ts");
const CONTROLLER_FILE: string = resolve(process.cwd(), "src/modules/telescope/telescope.controller.ts");
const STORE_FILE: string = resolve(process.cwd(), "src/modules/telescope/telescope.store.ts");
const SCHEMA_FILE: string = resolve(process.cwd(), "../../packages/shared/src/schemas/domain/telescope.ts");

function readSource(path: string): string {
	try {
		return readFileSync(path, "utf8");
	} catch {
		throw new Error(`cannot read ${path} — run from apps/api`);
	}
}

interface EnvVarRow {
	readonly name: string;
	readonly source: string;
}

function envTable(): string {
	const sources: readonly { readonly path: string; readonly label: string }[] = [
		{ path: OPTIONS_FILE, label: "telescope.options.ts" },
		{ path: STORE_FILE, label: "telescope.store.ts" },
	];
	const names = new Map<string, string>();

	for (const { path, label } of sources) {
		const content: string = readSource(path);
		const pattern = /process\.env\.(TELESCOPE_[A-Z0-9_]+)/g;
		for (const match of content.matchAll(pattern)) {
			const name: string = match[1];
			names.set(name, label);
		}
	}

	if (names.size === 0) {
		throw new Error("no TELESCOPE_* env vars found — the regex drifted from the code");
	}

	const rows: EnvVarRow[] = [...names.entries()].map(([name, source]) => ({ name, source })).sort((a: EnvVarRow, b: EnvVarRow): number => a.name.localeCompare(b.name));

	return ["| Env var | Defined in |", "|---|---|", ...rows.map((row: EnvVarRow): string => `| \`${row.name}\` | \`${row.source}\` |`)].join("\n");
}

interface EndpointRow {
	readonly method: string;
	readonly path: string;
	readonly handler: string;
}

function endpointsTable(): string {
	const content: string = readSource(CONTROLLER_FILE);
	const pattern = /@(Get|Post|Sse)\("([^"]+)"\)\s*public\s+(\w+)/g;
	const rows: EndpointRow[] = [];
	for (const match of content.matchAll(pattern)) {
		const verb: string = match[1].toUpperCase();
		const method: string = verb === "GET" ? "GET" : verb === "POST" ? "POST" : "SSE";
		rows.push({ method, path: `/telescope/${match[2]}`, handler: match[3] });
	}

	if (rows.length === 0) {
		throw new Error("no @Get/@Post/@Sse routes found — the regex drifted from the code");
	}

	return ["| Method | Path | Handler |", "|---|---|---|", ...rows.map((row: EndpointRow): string => `| ${row.method} | \`${row.path}\` | \`${row.handler}\` |`)].join("\n");
}

function schemaFields(): string {
	const content: string = readSource(SCHEMA_FILE);
	const pattern = /\b(\w+):\s*z\./g;
	const fields: string[] = [...new Set([...content.matchAll(pattern)].map((m: RegExpMatchArray): string => m[1]))].sort();
	return fields.length > 0 ? fields.join(", ") : "(none)";
}

console.log("## §14.1 Env vars (generated — do not hand-edit)\n");
console.log(envTable());
console.log("\n## §7 Endpoints (generated — do not hand-edit)\n");
console.log(endpointsTable());
console.log("\n## Schema fields (generated)\n");
console.log(`\`${schemaFields()}\``);
