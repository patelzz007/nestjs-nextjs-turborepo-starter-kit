// ============================================
// eslint-boundaries.spec.ts - lint canary for the backend boundaries
// ============================================
// Lints fixture snippets against apps/api's REAL effective ESLint config
// (eslint.config.js → @workspace/eslint-config/nestjs → base) and asserts the
// boundary rules fire: the process.env ban outside src/config/api-config.ts,
// and the ban on importing frontend packages. If a config change silently
// drops a boundary, this test fails (rules/13-ci-cd-and-quality-gates.md).

import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const API_DIR: string = fileURLToPath(new URL("..", import.meta.url));

const BOUNDARY_RULES: ReadonlySet<string> = new Set(["no-restricted-imports", "no-restricted-properties"]);

const eslint = new ESLint({
	cwd: API_DIR,
	ruleFilter: ({ ruleId }: { readonly ruleId: string }): boolean => BOUNDARY_RULES.has(ruleId),
	overrideConfig: [{ files: ["**/*.ts"], languageOptions: { parserOptions: { projectService: false, project: null } } }],
});

/** Loading the flat config imports every plugin once; give it its own budget. */
const CONFIG_LOAD_TIMEOUT_MS = 60_000;

beforeAll(async (): Promise<void> => {
	await eslint.lintText("", { filePath: `${API_DIR}src/modules/probe/probe.service.ts` });
}, CONFIG_LOAD_TIMEOUT_MS);

async function boundaryViolations(code: string, relativePath: string): Promise<string[]> {
	const results: ESLint.LintResult[] = await eslint.lintText(code, { filePath: `${API_DIR}${relativePath}` });
	return results.flatMap((result: ESLint.LintResult): string[] => result.messages.map((message): string => message.ruleId ?? `fatal: ${message.message}`));
}

describe("env boundary (apps/api effective lint config)", () => {
	it("rejects process.env anywhere in src except the config module", async () => {
		const code = "export const probe = process.env.DATABASE_URL;\n";

		expect(await boundaryViolations(code, "src/modules/probe/probe.service.ts")).toContain("no-restricted-properties");
		expect(await boundaryViolations(code, "src/main.ts")).toContain("no-restricted-properties");
		expect(await boundaryViolations(code, "src/config/typed-config.service.ts")).toContain("no-restricted-properties");
	});

	it("allows process.env in src/config/api-config.ts (the one validated reader)", async () => {
		expect(await boundaryViolations("export const probe = process.env.DATABASE_URL;\n", "src/config/api-config.ts")).toEqual([]);
	});
});

describe("import boundaries (apps/api effective lint config)", () => {
	it("allows backend and shared imports", async () => {
		const code =
			'import { z } from "zod";\nimport { apiPath } from "@workspace/shared";\nimport { Injectable } from "@nestjs/common";\nexport const probe = [z, apiPath, Injectable];\n';

		expect(await boundaryViolations(code, "src/modules/probe/probe.service.ts")).toEqual([]);
	});

	it.each([
		["the browser API client", "@workspace/client"],
		["a client subpath", "@workspace/client/lib/auth"],
		["the UI kit", "@workspace/ui/components/button"],
		["Next.js", "next"],
		["a Next.js subpath", "next/server"],
		["React", "react"],
		["the React JSX runtime", "react/jsx-runtime"],
		["React DOM", "react-dom/server"],
		["another app", "@workspace/admin"],
	])("rejects importing %s", async (_label: string, specifier: string) => {
		const code = `import * as forbidden from "${specifier}";\nexport const probe = forbidden;\n`;

		expect(await boundaryViolations(code, "src/modules/probe/probe.service.ts")).toContain("no-restricted-imports");
	});
});
