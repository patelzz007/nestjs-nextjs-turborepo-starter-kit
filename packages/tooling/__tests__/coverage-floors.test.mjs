// Every Vitest package measures coverage in `pnpm test` and fails below its floors (enhancement 3.1), so a
// new package can't quietly ship without them. Floors only go up: lowering one is a reviewed decision.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const THRESHOLDS = /thresholds: \{ lines: (?<lines>\d+), statements: (?<statements>\d+), functions: (?<functions>\d+), branches: (?<branches>\d+) \}/u;

/** Every workspace package whose `test` script runs Vitest, with its config file. */
function vitestPackages() {
	return ["apps", "packages"].flatMap((group) =>
		readdirSync(path.join(REPO_ROOT, group)).flatMap((name) => {
			const manifest = path.join(REPO_ROOT, group, name, "package.json");
			if (!existsSync(manifest)) {
				return [];
			}
			const test = JSON.parse(readFileSync(manifest, "utf8")).scripts?.test ?? "";
			if (!test.startsWith("vitest run")) {
				return [];
			}
			const config = /--config (?<file>\S+)/u.exec(test)?.groups?.file ?? "vitest.config.ts";
			return [{ dir: `${group}/${name}`, test, config: path.join(REPO_ROOT, group, name, config) }];
		}),
	);
}

describe("coverage floors", () => {
	const packages = vitestPackages();

	it("finds the Vitest packages", () => {
		expect(packages.length).toBeGreaterThan(10);
	});

	it.each(packages.map((entry) => [entry.dir, entry]))("%s measures coverage in its test script and sets every floor", (_dir, entry) => {
		expect(entry.test).toContain("--coverage");
		const thresholds = THRESHOLDS.exec(readFileSync(entry.config, "utf8"))?.groups;
		expect(thresholds).toBeDefined();
		for (const value of Object.values(thresholds ?? {})) {
			expect(Number(value)).toBeGreaterThan(0);
		}
	});
});
