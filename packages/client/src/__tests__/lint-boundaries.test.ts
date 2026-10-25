// ============================================
// lint-boundaries.test.ts - lint canary for the import/env boundaries
// ============================================
// Lints fixture snippets against this package's REAL composed oxlint config
// (oxlint.config.ts) and asserts the boundary rules fire. If a config change
// silently drops a boundary, this test fails (rules/13-ci-cd-and-quality-gates.md,
// "lint canary"). The snippets are linted in a temp directory at the same
// relative paths (@workspace/oxlint-config/testing); only the boundary rules
// are compared, and type-aware rules are off, so the canary needs no program.

import { ruleIdsFor } from "@workspace/oxlint-config/testing";
import { describe, expect, it } from "vitest";

import config from "../../oxlint.config";

const BOUNDARY_RULES: ReadonlySet<string> = new Set(["workspace/restricted-imports", "no-restricted-properties", "workspace/no-server-import-in-client-component"]);

/** Lints `code` as if it lived at `relativePath` and returns the boundary rules reported. */
function boundaryViolations(code: string, relativePath: string): string[] {
	return ruleIdsFor(config, code, relativePath).filter((ruleId: string): boolean => BOUNDARY_RULES.has(ruleId));
}

describe("import boundaries (packages/client effective lint config)", () => {
	it("allows public entry points of other packages", () => {
		const code = 'import { cn } from "@workspace/ui/lib/core/utils";\nimport { PERMISSION } from "@workspace/shared";\nexport const probe = [cn, PERMISSION];\n';
		expect(boundaryViolations(code, "src/lib/probe.ts")).toEqual([]);
	});

	it.each([["@workspace/web"], ["@workspace/ui/src/lib/core/utils"], ["@workspace/shared/schemas/index"], ["@prisma/client"], ["@workspace/messaging/nest"], ["ioredis"]])(
		'rejects importing "%s"',
		(specifier: string) => {
			const code = `import * as forbidden from "${specifier}";\nexport const probe = forbidden;\n`;
			expect(boundaryViolations(code, "src/lib/probe.ts")).toContain("workspace/restricted-imports");
		},
	);

	it('rejects server-only modules in "use client" files', () => {
		const code = '"use client";\nimport { createServerCaller } from "../../api/server-api";\nexport const probe = createServerCaller;\n';
		expect(boundaryViolations(code, "src/lib/contexts/identity/probe.tsx")).toContain("workspace/no-server-import-in-client-component");
	});
});

describe("env boundary (packages/client effective lint config)", () => {
	it("rejects process.env outside src/lib/api/config.ts", () => {
		expect(boundaryViolations("export const probe = process.env.NODE_ENV;\n", "src/lib/contexts/identity/probe.ts")).toContain("no-restricted-properties");
	});

	it("allows process.env inside the package env module", () => {
		expect(boundaryViolations("export const probe = process.env.NODE_ENV;\n", "src/lib/api/config.ts")).toEqual([]);
	});
});
