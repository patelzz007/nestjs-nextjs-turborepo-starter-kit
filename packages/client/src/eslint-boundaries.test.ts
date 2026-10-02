// ============================================
// eslint-boundaries.test.ts - lint canary for the import/env boundaries
// ============================================
// Lints fixture snippets against this package's REAL effective ESLint config
// (eslint.config.js → @workspace/eslint-config/react-internal → base) and
// asserts the boundary rules fire, so a config change cannot silently drop
// them (rules/13-ci-cd-and-quality-gates.md, "lint canary"). Only the boundary
// rules run and type-aware parsing is off, so no files are needed on disk.

import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const PACKAGE_DIR: string = fileURLToPath(new URL("..", import.meta.url));

const BOUNDARY_RULES: ReadonlySet<string> = new Set(["no-restricted-imports", "no-restricted-properties", "workspace-boundaries/no-server-import-in-client-component"]);

const eslint = new ESLint({
	cwd: PACKAGE_DIR,
	ruleFilter: ({ ruleId }: { readonly ruleId: string }): boolean => BOUNDARY_RULES.has(ruleId),
	overrideConfig: [{ files: ["**/*.ts", "**/*.tsx"], languageOptions: { parserOptions: { projectService: false } } }],
});

/**
 * Loading the flat config imports every ESLint plugin once (seconds under a
 * parallel `turbo run test`). Do it up front with its own budget so each test
 * below measures only the lint itself.
 */
const CONFIG_LOAD_TIMEOUT_MS = 60_000;

beforeAll(async (): Promise<void> => {
	await eslint.lintText("", { filePath: `${PACKAGE_DIR}src/lib/probe.ts` });
}, CONFIG_LOAD_TIMEOUT_MS);

async function boundaryViolations(code: string, relativePath: string): Promise<string[]> {
	const results: ESLint.LintResult[] = await eslint.lintText(code, { filePath: `${PACKAGE_DIR}${relativePath}` });
	return results.flatMap((result: ESLint.LintResult): string[] => result.messages.map((message): string => message.ruleId ?? `fatal: ${message.message}`));
}

describe("import boundaries (packages/client effective lint config)", () => {
	it("allows public entry points of other packages", async () => {
		const code = 'import { cn } from "@workspace/ui/lib/core/utils";\nimport { PERMISSION } from "@workspace/shared";\nexport const probe = [cn, PERMISSION];\n';
		expect(await boundaryViolations(code, "src/lib/probe.ts")).toEqual([]);
	});

	it.each([["@workspace/web"], ["@workspace/ui/src/lib/core/utils"], ["@workspace/shared/schemas/index"], ["@prisma/client"], ["@workspace/messaging/nest"], ["ioredis"]])(
		'rejects importing "%s"',
		async (specifier: string) => {
			const code = `import * as forbidden from "${specifier}";\nexport const probe = forbidden;\n`;
			expect(await boundaryViolations(code, "src/lib/probe.ts")).toContain("no-restricted-imports");
		},
	);

	it('rejects server-only modules in "use client" files', async () => {
		const code = '"use client";\nimport { createServerCaller } from "../api/server-api";\nexport const probe = createServerCaller;\n';
		expect(await boundaryViolations(code, "src/lib/auth/probe.tsx")).toContain("workspace-boundaries/no-server-import-in-client-component");
	});
});

describe("env boundary (packages/client effective lint config)", () => {
	it("rejects process.env outside src/lib/api/config.ts", async () => {
		expect(await boundaryViolations("export const probe = process.env.NODE_ENV;\n", "src/lib/auth/probe.ts")).toContain("no-restricted-properties");
	});

	it("allows process.env inside the package env module", async () => {
		expect(await boundaryViolations("export const probe = process.env.NODE_ENV;\n", "src/lib/api/config.ts")).toEqual([]);
	});
});
