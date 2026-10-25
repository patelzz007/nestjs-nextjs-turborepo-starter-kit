// ============================================
// lint-boundaries.spec.ts - lint canary for the import/env boundaries
// ============================================
// Lints fixture snippets against this app's REAL composed oxlint config
// (oxlint.config.ts) and asserts the boundary rules fire. If a config change
// silently drops a boundary, this test fails (rules/13-ci-cd-and-quality-gates.md,
// "lint canary"). The snippets are linted in a temp directory at the same
// relative paths (@workspace/oxlint-config/testing); only the boundary rules
// are compared, and type-aware rules are off, so the canary needs no program.

import { ruleIdsFor } from "@workspace/oxlint-config/testing";
import { describe, expect, it } from "vitest";

import config from "../../oxlint.config";

const BOUNDARY_RULES: ReadonlySet<string> = new Set(["workspace/restricted-imports", "no-restricted-properties"]);

/** Lints `code` as if it lived at `relativePath` and returns the boundary rules reported. */
function boundaryViolations(code: string, relativePath: string): string[] {
	return ruleIdsFor(config, code, relativePath).filter((ruleId: string): boolean => BOUNDARY_RULES.has(ruleId));
}

describe("env boundary (apps/api effective lint config)", () => {
	it("rejects process.env anywhere in src except the config module", () => {
		const code = "export const probe = process.env.DATABASE_URL;\n";

		expect(boundaryViolations(code, "src/modules/probe/probe.service.ts")).toContain("no-restricted-properties");
		expect(boundaryViolations(code, "src/main.ts")).toContain("no-restricted-properties");
		expect(boundaryViolations(code, "src/config/typed-config.service.ts")).toContain("no-restricted-properties");
	});

	it("allows process.env in src/config/api-config.ts (the one validated reader)", () => {
		expect(boundaryViolations("export const probe = process.env.DATABASE_URL;\n", "src/config/api-config.ts")).toEqual([]);
	});
});

describe("import boundaries (apps/api effective lint config)", () => {
	it("allows backend and shared imports", () => {
		const code =
			'import { z } from "zod";\nimport { apiPath } from "@workspace/shared";\nimport { Injectable } from "@nestjs/common";\nexport const probe = [z, apiPath, Injectable];\n';

		expect(boundaryViolations(code, "src/modules/probe/probe.service.ts")).toEqual([]);
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
	])("rejects importing %s", (_label: string, specifier: string) => {
		const code = `import * as forbidden from "${specifier}";\nexport const probe = forbidden;\n`;

		expect(boundaryViolations(code, "src/modules/probe/probe.service.ts")).toContain("workspace/restricted-imports");
	});
});
