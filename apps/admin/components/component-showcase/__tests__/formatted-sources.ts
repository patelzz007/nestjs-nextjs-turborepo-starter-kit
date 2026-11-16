import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

/** The repository root (this app). */
export const ROOT = path.resolve(import.meta.dirname, "../../..");

/** The oxfmt CLI (its `exports` do not expose `bin/`, so it is located through its package.json). */
const OXFMT_BIN: string = path.join(path.dirname(createRequire(import.meta.url).resolve("oxfmt/package.json")), "bin", "oxfmt");

/** The formatter config that applies to this app: the nearest `.oxfmtrc.json` at or above it (a monorepo keeps it at its root). */
function formatterConfig(start: string): string {
	for (let dir = start; ; dir = path.dirname(dir)) {
		const candidate = path.join(dir, ".oxfmtrc.json");
		if (existsSync(candidate)) {
			return candidate;
		}
		if (path.dirname(dir) === dir) {
			throw new Error(`No .oxfmtrc.json at or above ${start}`);
		}
	}
}

/**
 * Each of `files` (app-relative path → source) as `oxfmt` formats it, in ONE
 * run: the sources go to a scratch folder and the app's own config is passed
 * explicitly, so it applies exactly as it does to the committed files.
 */
export function formattedAll(files: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
	const scratch = mkdtempSync(path.join(tmpdir(), "showcase-generated-"));
	try {
		for (const [file, source] of files) {
			mkdirSync(path.dirname(path.join(scratch, file)), { recursive: true });
			writeFileSync(path.join(scratch, file), source);
		}
		execFileSync(process.execPath, [OXFMT_BIN, `--config=${formatterConfig(ROOT)}`, "."], { cwd: scratch, encoding: "utf8" });
		return new Map([...files.keys()].map((file: string): [string, string] => [file, readFileSync(path.join(scratch, file), "utf8")]));
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}
}
