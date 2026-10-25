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

describe("analytics-consumer boundaries", () => {
	it("rejects process.env outside src/infrastructure/env.ts and allows it there", () => {
		const code = "export const probe = process.env.KAFKA_BROKERS;\n";

		expect(boundaryViolations(code, "src/probe.ts")).toContain("no-restricted-properties");
		expect(boundaryViolations(code, "src/infrastructure/env.ts")).toEqual([]);
	});

	it.each([["@workspace/ui"], ["@workspace/client"], ["react"], ["next/server"]])("rejects importing %s", (specifier: string) => {
		const code = `import * as forbidden from "${specifier}";\nexport const probe = forbidden;\n`;

		expect(boundaryViolations(code, "src/probe.ts")).toContain("workspace/restricted-imports");
	});
});
