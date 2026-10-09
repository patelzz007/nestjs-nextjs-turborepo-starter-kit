// ============================================
// scripts/generate.ts — `pnpm tokens:generate`
// ============================================
// Writes every generated stylesheet into packages/tokens/generated/. The output
// is deterministic, so running it twice changes nothing; commit what it writes.
// Exits non-zero (the generator throws) on any invalid token.

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { generateTokenStylesheets } from "../src/generator/generate";
import { TOKEN_SOURCE } from "../src/source";

const GENERATED_DIRECTORY = new URL("../generated/", import.meta.url);

function main(): void {
	mkdirSync(GENERATED_DIRECTORY, { recursive: true });
	for (const { fileName, contents } of generateTokenStylesheets(TOKEN_SOURCE)) {
		const target = new URL(fileName, GENERATED_DIRECTORY);
		writeFileSync(target, contents, "utf8");
		process.stdout.write(`wrote ${fileURLToPath(target)}\n`);
	}
}

main();
