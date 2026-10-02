// Lint canary: the consumer's REAL effective ESLint config must keep rejecting
// raw process.env reads (outside src/env.ts) and frontend imports.

import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const APP_DIR: string = fileURLToPath(new URL("..", import.meta.url));
const BOUNDARY_RULES: ReadonlySet<string> = new Set(["no-restricted-imports", "no-restricted-properties"]);
const CONFIG_LOAD_TIMEOUT_MS = 60_000;

const eslint = new ESLint({
	cwd: APP_DIR,
	ruleFilter: ({ ruleId }: { readonly ruleId: string }): boolean => BOUNDARY_RULES.has(ruleId),
	overrideConfig: [{ files: ["**/*.ts"], languageOptions: { parserOptions: { projectService: false, project: null } } }],
});

beforeAll(async (): Promise<void> => {
	await eslint.lintText("", { filePath: `${APP_DIR}src/probe.ts` });
}, CONFIG_LOAD_TIMEOUT_MS);

async function boundaryViolations(code: string, relativePath: string): Promise<string[]> {
	const results: ESLint.LintResult[] = await eslint.lintText(code, { filePath: `${APP_DIR}${relativePath}` });
	return results.flatMap((result: ESLint.LintResult): string[] => result.messages.map((message): string => message.ruleId ?? `fatal: ${message.message}`));
}

describe("analytics-consumer boundaries", () => {
	it("rejects process.env outside src/env.ts and allows it there", async () => {
		const code = "export const probe = process.env.KAFKA_BROKERS;\n";

		expect(await boundaryViolations(code, "src/probe.ts")).toContain("no-restricted-properties");
		expect(await boundaryViolations(code, "src/env.ts")).toEqual([]);
	});

	it.each([["@workspace/ui"], ["@workspace/client"], ["react"], ["next/server"]])("rejects importing %s", async (specifier: string) => {
		const code = `import * as forbidden from "${specifier}";\nexport const probe = forbidden;\n`;

		expect(await boundaryViolations(code, "src/probe.ts")).toContain("no-restricted-imports");
	});
});
