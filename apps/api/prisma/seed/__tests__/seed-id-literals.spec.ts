import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ORGANIZATION_SEED_IDS } from "../organization-seed-ids";

const SEED_DIR: string = resolve(import.meta.dirname, "..");
const TESTS_DIR_NAME = "__tests__";
const UUID_LITERAL = /"(?<id>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/g;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Every seed source file (the seed's own specs excluded). */
function seedSources(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry): string[] => {
		if (entry.isDirectory()) {
			return entry.name === TESTS_DIR_NAME ? [] : seedSources(join(dir, entry.name));
		}
		return entry.name.endsWith(".ts") ? [join(dir, entry.name)] : [];
	});
}

describe("seed id literals", () => {
	it("are all UUID v7, like every id the app and the database mint", () => {
		const notV7: string[] = seedSources(SEED_DIR).flatMap((file: string): string[] =>
			[...readFileSync(file, "utf8").matchAll(UUID_LITERAL)]
				.map((match): string => match.groups?.id ?? "")
				.filter((id: string): boolean => !UUID_V7.test(id))
				.map((id: string): string => `${file.slice(SEED_DIR.length + 1)}: ${id}`),
		);

		expect(notV7).toEqual([]);
	});

	it("covers the fixed organization ids the tests and the single-tenant config name", () => {
		expect(Object.values(ORGANIZATION_SEED_IDS).every((id: string): boolean => UUID_V7.test(id))).toBe(true);
	});
});
