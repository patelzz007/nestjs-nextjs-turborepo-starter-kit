import { describe, expect, it } from "vitest";

import { contextFiles, contextNames, nextSteps } from "../scaffold-context.mjs";

/** What the repository's rules ban in TypeScript (rules/00): a template must never write it. */
const BANNED = [/\bany\b/u, /\bunknown\b/u, /\bnever\b/u, / as [A-Z]/u, /as const/u, /\[0\]/u, /typeof /u];

describe("contextNames", () => {
	it("derives every casing from a hyphenated name", () => {
		expect(contextNames("loyalty-tiers")).toStrictEqual({
			kebab: "loyalty-tiers",
			pascal: "LoyaltyTiers",
			camel: "loyaltyTiers",
			constant: "LOYALTY_TIERS",
			words: "loyalty tiers",
		});
		expect(contextNames("billing")).toMatchObject({ pascal: "Billing", constant: "BILLING" });
	});

	it("refuses names that aren't lower-case hyphenated words, and reserved ones", () => {
		for (const bad of ["Loyalty", "loyalty_tiers", "loyalty--tiers", "-loyalty", "2fa", "", "loyalty tiers"]) {
			expect(() => contextNames(bad), bad).toThrow(/lower-case words/u);
		}
		expect(() => contextNames("platform")).toThrow(/reserved/u);
	});
});

describe("contextFiles", () => {
	const files = contextFiles("loyalty-tiers");

	it("lays the slice out as a context is laid out", () => {
		expect([...files.keys()]).toStrictEqual([
			"public-api.ts",
			"application/ports/loyalty-tiers.reader.ts",
			"application/queries/get-loyalty-tiers-summary/get-loyalty-tiers-summary.query.ts",
			"application/queries/get-loyalty-tiers-summary/get-loyalty-tiers-summary.handler.ts",
			"application/queries/get-loyalty-tiers-summary/__tests__/get-loyalty-tiers-summary.handler.spec.ts",
			"loyalty-tiers.module.ts",
		]);
	});

	it("names things consistently across files (the handler the module provides is the one the query file defines)", () => {
		expect(files.get("loyalty-tiers.module.ts")).toContain("providers: [GetLoyaltyTiersSummaryHandler]");
		expect(files.get("application/queries/get-loyalty-tiers-summary/get-loyalty-tiers-summary.handler.ts")).toContain("export class GetLoyaltyTiersSummaryHandler");
		expect(files.get("public-api.ts")).toContain('export { LoyaltyTiersModule } from "./loyalty-tiers.module";');
		expect(files.get("application/ports/loyalty-tiers.reader.ts")).toContain('export const LOYALTY_TIERS_READER = Symbol("LOYALTY_TIERS_READER");');
	});

	it("writes nothing the rules ban", () => {
		for (const [file, content] of files) {
			for (const pattern of BANNED) {
				expect(pattern.test(content), `${file} matches ${String(pattern)}`).toBe(false);
			}
		}
	});

	it("gives every method an explicit return type and access modifier", () => {
		const handler = files.get("application/queries/get-loyalty-tiers-summary/get-loyalty-tiers-summary.handler.ts") ?? "";
		expect(handler).toMatch(/public async execute\(\{ actor \}: GetLoyaltyTiersSummaryQuery\): Promise<LoyaltyTiersSummary>/u);
		expect(handler).toMatch(/public constructor\(@Inject/u);
	});
});

describe("nextSteps", () => {
	it("lists what a template can't decide, pointing at the rule for each", () => {
		const steps = nextSteps("loyalty-tiers");
		expect(steps).toHaveLength(6);
		expect(steps.every((step) => /rules\/\d+|context-map/u.test(step))).toBe(true);
		expect(steps.join(" ")).toContain("LOYALTY_TIERS_READER");
	});
});
