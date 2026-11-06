import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE_ROOT = path.resolve(import.meta.dirname, "../..");
const TOOLS_PAGE = readFileSync(path.resolve(SOURCE_ROOT, "../../../docs/technical/tooling/tools.md"), "utf8");
const ENTRY_POINT = /(?:^|\/)(?:cli|gate-cli|release-cli|docker-forward-and-run)\.ts$/u;
/** Values that belong in `tooling.config.ts`, not in a tool. */
const REPOSITORY_VALUE = /"(?:apps|infra)\/|@workspace\/|localhost:\d{4}/u;
const COMMENT_LINE = /^\s*(?:\*|\/\/|\/\*)/u;

function sourceFiles(): string[] {
	return readdirSync(SOURCE_ROOT, { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith(".ts") && !file.includes("__tests__") && !file.startsWith("testing"));
}

describe("the tooling reference", () => {
	it("lists every tool's entry point", () => {
		const entryPoints = sourceFiles().filter((file) => ENTRY_POINT.test(file));
		expect(entryPoints.length).toBeGreaterThan(0);
		expect(entryPoints.filter((file) => !TOOLS_PAGE.includes(`\`${file}\``))).toStrictEqual([]);
	});
});

describe("the engines", () => {
	it("hold no app path, workspace name or port: those live in tooling.config.ts", () => {
		const offenders = sourceFiles()
			.filter((file) => !file.startsWith("starter"))
			.flatMap((file) =>
				readFileSync(path.join(SOURCE_ROOT, file), "utf8")
					.split("\n")
					.filter((line) => !COMMENT_LINE.test(line) && REPOSITORY_VALUE.test(line))
					.map((line) => `${file}: ${line.trim()}`),
			);
		expect(offenders).toStrictEqual([]);
	});
});
