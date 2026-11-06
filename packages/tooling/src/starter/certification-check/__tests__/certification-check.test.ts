import { describe, expect, it } from "vitest";

import { certificationLayers } from "../certification-check.ts";

const SCHEMA_WITHOUT = `model Other {\n  badgeColor String?\n}\n\nmodel SampleCategory {\n  id   String @id\n  name String\n}\n`;
const SCHEMA_WITH = `model SampleCategory {\n  id         String  @id\n  name       String\n  badgeColor String? @db.VarChar(7)\n}\n`;
const MIGRATION = `ALTER TABLE "SampleCategory" ADD COLUMN "badgeColor" VARCHAR(7);`;

function done(field: string, overrides: Readonly<Record<string, string>> = {}): ReturnType<typeof certificationLayers> {
	return certificationLayers(field, {
		contract: "badgeColor: z.string()",
		schema: SCHEMA_WITH,
		seed: 'badgeColor: "#2563eb"',
		migrations: [MIGRATION],
		tests: ['expect(category.badgeColor).toBe("#2563eb")'],
		adminSources: ['<TextField id="badgeColor" />'],
		...overrides,
	});
}

describe("certificationLayers", () => {
	it("passes every layer for a complete solution", () => {
		expect(done("badgeColor").every((layer) => layer.done)).toBe(true);
	});

	it("names each missing layer with what to do", () => {
		const layers = certificationLayers("badgeColor", {
			contract: "",
			schema: SCHEMA_WITHOUT,
			seed: "",
			migrations: ['CREATE TABLE "Other" ("badgeColor" text);'],
			tests: [],
			adminSources: [],
		});
		expect(layers.filter((layer) => !layer.done).map((layer) => layer.layer)).toStrictEqual(["Contract", "Database", "Migration", "Seed", "Admin", "Tests"]);
		expect(layers.find((layer) => layer.layer === "Migration")?.hint).toContain("db:migrate:create");
	});

	it("counts the field only on SampleCategory (another model's field doesn't count) and only as a whole word", () => {
		expect(done("badgeColor", { schema: SCHEMA_WITHOUT }).find((layer) => layer.layer === "Database")?.done).toBe(false);
		expect(done("badge", { contract: "badgeColor: z.string()" }).find((layer) => layer.layer === "Contract")?.done).toBe(false);
	});

	it("checks the field a reviewer asks for", () => {
		expect(done("iconName").filter((layer) => layer.done)).toStrictEqual([]);
	});

	it("refuses a field name that isn't camelCase", () => {
		expect(() => done("badge-color")).toThrow(/camelCase/u);
	});
});
