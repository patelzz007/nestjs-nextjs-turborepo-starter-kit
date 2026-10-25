// ============================================
// lint-boundaries.test.ts - lint canary for the import/env boundaries
// ============================================
// Lints fixture snippets against this app's REAL composed oxlint config
// (oxlint.config.ts) and asserts the boundary rules fire. If a config change
// silently drops a boundary, this test fails (rules/13-ci-cd-and-quality-gates.md,
// "lint canary"). The snippets are linted in a temp directory at the same
// relative paths (@workspace/oxlint-config/testing); only the boundary rules
// are compared, and type-aware rules are off, so the canary needs no program.

import { ruleIdsFor } from "@workspace/oxlint-config/testing";
import { describe, expect, it } from "vitest";

import config from "../oxlint.config";

const BOUNDARY_RULES: ReadonlySet<string> = new Set(["workspace/restricted-imports", "no-restricted-properties", "workspace/no-server-import-in-client-component"]);

/** Lints `code` as if it lived at `relativePath` and returns the boundary rules reported. */
function boundaryViolations(code: string, relativePath: string): string[] {
	return ruleIdsFor(config, code, relativePath).filter((ruleId: string): boolean => BOUNDARY_RULES.has(ruleId));
}

describe("import boundaries (apps/web effective lint config)", () => {
	it("allows imports through public package entry points", () => {
		const code = [
			'import { PERMISSION } from "@workspace/shared";',
			'import { useAuth } from "@workspace/client/lib/contexts/identity";',
			"export const probe = [PERMISSION, useAuth];",
			"",
		].join("\n");
		expect(boundaryViolations(code, "components/probe.tsx")).toEqual([]);
	});

	it.each([
		["another app", "@workspace/admin/lib/constants"],
		["the API app", "@workspace/api"],
		["a package's src internals", "@workspace/ui/src/lib/core/utils"],
		["a package's dist output", "@workspace/shared/dist/index.js"],
		["a deep @workspace/shared path", "@workspace/shared/runtime/index"],
		["a relative climb into packages/", "../../../packages/shared/src/index"],
		["Prisma", "@prisma/client"],
		["NestJS", "@nestjs/common"],
		["the Node-only messaging package", "@workspace/messaging"],
		["a queue client", "bullmq"],
		["the Kafka client", "@confluentinc/kafka-javascript"],
	])("rejects importing %s", (_label: string, specifier: string) => {
		const code = `import * as forbidden from "${specifier}";\nexport const probe = forbidden;\n`;
		expect(boundaryViolations(code, "components/probe.tsx")).toContain("workspace/restricted-imports");
	});

	it.each([["@/lib/env/env.server"], ["server-only"], ["next/headers"], ["@/lib/auth/server"], ["@/lib/web-server-api"], ["@workspace/client/lib/api/server-api"]])(
		'rejects a value import of the server-only module "%s" from a "use client" file',
		(specifier: string) => {
			const code = `"use client";\nimport * as serverThing from "${specifier}";\nexport const probe = serverThing;\n`;
			expect(boundaryViolations(code, "components/probe.tsx")).toContain("workspace/no-server-import-in-client-component");
		},
	);

	it("allows the same server module in a Server Component", () => {
		const code = 'import { serverEnv } from "@/lib/env/env.server";\nexport const probe = serverEnv;\n';
		expect(boundaryViolations(code, "components/probe.tsx")).toEqual([]);
	});

	it("allows a type-only import of a server module from a client file (erased at build)", () => {
		const code = '"use client";\nimport type { WebServerCaller } from "@/lib/web-server-api";\nexport type Probe = WebServerCaller;\n';
		expect(boundaryViolations(code, "components/probe.tsx")).toEqual([]);
	});
});

describe("env boundary (apps/web effective lint config)", () => {
	it("rejects process.env outside the env modules", () => {
		expect(boundaryViolations("export const probe = process.env.NEXT_PUBLIC_API_URL;\n", "components/probe.tsx")).toContain("no-restricted-properties");
	});

	it("allows process.env inside lib/env/env.client.ts, lib/env/env.server.ts and lib/env/env.runtime.ts", () => {
		const code = "export const probe = process.env.NEXT_PUBLIC_API_URL;\n";
		expect(boundaryViolations(code, "lib/env/env.client.ts")).toEqual([]);
		expect(boundaryViolations(code, "lib/env/env.server.ts")).toEqual([]);
		expect(boundaryViolations(code, "lib/env/env.runtime.ts")).toEqual([]);
	});

	it("rejects process.env in instrumentation.ts and the pure schema module", () => {
		const code = "export const probe = process.env.NEXT_RUNTIME;\n";
		expect(boundaryViolations(code, "instrumentation.ts")).toContain("no-restricted-properties");
		expect(boundaryViolations(code, "lib/env/env.schema.ts")).toContain("no-restricted-properties");
	});
});
