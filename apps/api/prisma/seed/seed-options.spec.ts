import { describe, expect, it } from "vitest";

import { MAX_RANDOM_SEED } from "./prng";
import { DEFAULT_RANDOM_SEED, DEFAULT_SEED_SCENARIO, formatSeedUsage, parseSeedArguments, SeedArgumentError, SeedScenarioSchema } from "./seed-options";

describe("parseSeedArguments", () => {
	it("defaults to the development scenario and the default seed", () => {
		expect(parseSeedArguments([])).toEqual({ kind: "run", scenario: DEFAULT_SEED_SCENARIO, seed: DEFAULT_RANDOM_SEED });
		expect(DEFAULT_SEED_SCENARIO).toBe("development");
	});

	it.each(["empty", "development", "enterprise"])("accepts --scenario %s", (scenario) => {
		expect(parseSeedArguments(["--scenario", scenario])).toMatchObject({ kind: "run", scenario });
	});

	it("parses space-separated and inline (=) values", () => {
		expect(parseSeedArguments(["--scenario", "enterprise", "--seed", "123"])).toEqual({ kind: "run", scenario: "enterprise", seed: 123 });
		expect(parseSeedArguments(["--scenario=enterprise", "--seed=123"])).toEqual({ kind: "run", scenario: "enterprise", seed: 123 });
	});

	it("ignores the bare -- separator that pnpm forwards", () => {
		expect(parseSeedArguments(["--", "--scenario", "empty", "--seed", "7"])).toEqual({ kind: "run", scenario: "empty", seed: 7 });
	});

	it("accepts the seed boundaries 0 and MAX_RANDOM_SEED", () => {
		expect(parseSeedArguments(["--seed", "0"])).toMatchObject({ seed: 0 });
		expect(parseSeedArguments(["--seed", String(MAX_RANDOM_SEED)])).toMatchObject({ seed: MAX_RANDOM_SEED });
	});

	it.each([{ argv: ["--help"] }, { argv: ["-h"] }, { argv: ["--scenario", "empty", "--help"] }])("returns the help command for $argv", ({ argv }) => {
		expect(parseSeedArguments(argv)).toEqual({ kind: "help" });
	});

	describe("rejects invalid input with SeedArgumentError", () => {
		it.each([
			[["--scenario", "production"], "Invalid option"],
			[["--seed", "abc"], "non-negative integer"],
			[["--seed=-1"], "non-negative integer"],
			[["--seed", "1.5"], "non-negative integer"],
			[["--seed", String(MAX_RANDOM_SEED + 1)], "at most"],
			[["--scenario"], "requires a value"],
			[["--scenario", "--seed", "1"], "requires a value"],
			[["--scenario="], "requires a value"],
			[["--scenario", "empty", "--scenario", "enterprise"], "more than once"],
			[["--scenrio", "empty"], "Unknown argument"],
			[["enterprise"], "Unknown argument"],
		])("%j", (argv, message) => {
			expect(() => parseSeedArguments(argv)).toThrow(SeedArgumentError);
			expect(() => parseSeedArguments(argv)).toThrow(message);
		});
	});
});

describe("formatSeedUsage", () => {
	it("documents every scenario and both options", () => {
		const usage = formatSeedUsage();
		for (const scenario of SeedScenarioSchema.options) {
			expect(usage).toContain(scenario);
		}
		expect(usage).toContain("--scenario <name>");
		expect(usage).toContain("--seed <n>");
	});
});
