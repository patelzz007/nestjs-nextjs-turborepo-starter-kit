// ============================================
// eslint-boundaries.test.ts - lint canary for the import/env boundaries
// ============================================
// Lints fixture snippets against this app's REAL effective ESLint config
// (eslint.config.js → @workspace/eslint-config/next-js → base) and asserts the
// boundary rules fire. If a config change silently drops a boundary, this
// test fails (rules/13-ci-cd-and-quality-gates.md, "lint canary").
//
// Only the boundary rules run (`ruleFilter`), and type-aware parsing is turned
// off for the fixtures, so the canary stays fast and needs no files on disk.

import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const APP_DIR: string = fileURLToPath(new URL(".", import.meta.url));

const BOUNDARY_RULES: ReadonlySet<string> = new Set(["no-restricted-imports", "no-restricted-properties", "workspace-boundaries/no-server-import-in-client-component"]);

const eslint = new ESLint({
	cwd: APP_DIR,
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
	await eslint.lintText("", { filePath: `${APP_DIR}components/probe.tsx` });
}, CONFIG_LOAD_TIMEOUT_MS);

/** Lints `code` as if it lived at `relativePath` and returns the rule ids reported. */
async function boundaryViolations(code: string, relativePath: string): Promise<string[]> {
	const results: ESLint.LintResult[] = await eslint.lintText(code, { filePath: `${APP_DIR}${relativePath}` });
	return results.flatMap((result: ESLint.LintResult): string[] => result.messages.map((message): string => message.ruleId ?? `fatal: ${message.message}`));
}

describe("import boundaries (apps/web effective lint config)", () => {
	it("allows imports through public package entry points", async () => {
		const code = [
			'import { PERMISSION } from "@workspace/shared";',
			'import { useAuth } from "@workspace/client/lib/auth";',
			"export const probe = [PERMISSION, useAuth];",
			"",
		].join("\n");
		expect(await boundaryViolations(code, "components/probe.tsx")).toEqual([]);
	});

	it.each([
		["another app", "@workspace/admin/lib/constants"],
		["the API app", "@workspace/api"],
		["a package's src internals", "@workspace/ui/src/lib/core/utils"],
		["a package's dist output", "@workspace/shared/dist/index.js"],
		["a deep @workspace/shared path", "@workspace/shared/runtime/index"],
		["a relative climb into packages/", "../../packages/shared/src/index"],
		["Prisma", "@prisma/client"],
		["NestJS", "@nestjs/common"],
		["the Node-only messaging package", "@workspace/messaging"],
		["a queue client", "bullmq"],
	])("rejects importing %s", async (_label: string, specifier: string) => {
		const code = `import * as forbidden from "${specifier}";\nexport const probe = forbidden;\n`;
		expect(await boundaryViolations(code, "components/probe.tsx")).toContain("no-restricted-imports");
	});

	it.each([["@/lib/env/env.server"], ["server-only"], ["next/headers"], ["@/lib/auth/server"], ["@/lib/web-server-api"], ["@workspace/client/lib/api/server-api"]])(
		'rejects a value import of the server-only module "%s" from a "use client" file',
		async (specifier: string) => {
			const code = `"use client";\nimport * as serverThing from "${specifier}";\nexport const probe = serverThing;\n`;
			expect(await boundaryViolations(code, "components/probe.tsx")).toContain("workspace-boundaries/no-server-import-in-client-component");
		},
	);

	it("allows the same server module in a Server Component", async () => {
		const code = 'import { serverEnv } from "@/lib/env/env.server";\nexport const probe = serverEnv;\n';
		expect(await boundaryViolations(code, "components/probe.tsx")).toEqual([]);
	});

	it("allows a type-only import of a server module from a client file (erased at build)", async () => {
		const code = '"use client";\nimport type { WebServerCaller } from "@/lib/web-server-api";\nexport type Probe = WebServerCaller;\n';
		expect(await boundaryViolations(code, "components/probe.tsx")).toEqual([]);
	});
});

describe("env boundary (apps/web effective lint config)", () => {
	it("rejects process.env outside the env modules", async () => {
		expect(await boundaryViolations("export const probe = process.env.NEXT_PUBLIC_API_URL;\n", "components/probe.tsx")).toContain("no-restricted-properties");
	});

	it("allows process.env inside lib/env/env.client.ts, lib/env/env.server.ts and lib/env/env.runtime.ts", async () => {
		const code = "export const probe = process.env.NEXT_PUBLIC_API_URL;\n";
		expect(await boundaryViolations(code, "lib/env/env.client.ts")).toEqual([]);
		expect(await boundaryViolations(code, "lib/env/env.server.ts")).toEqual([]);
		expect(await boundaryViolations(code, "lib/env/env.runtime.ts")).toEqual([]);
	});

	it("rejects process.env in instrumentation.ts and the pure schema module", async () => {
		const code = "export const probe = process.env.NEXT_RUNTIME;\n";
		expect(await boundaryViolations(code, "instrumentation.ts")).toContain("no-restricted-properties");
		expect(await boundaryViolations(code, "lib/env/env.schema.ts")).toContain("no-restricted-properties");
	});
});
