import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fullUniquesOnSoftDeletableModels, REVIEWED_FULL_UNIQUES } from "../unique-on-soft-delete";

const SCHEMA = readFileSync(join(import.meta.dirname, "..", "schema.prisma"), "utf8");

describe("fullUniquesOnSoftDeletableModels", () => {
	it("finds field and compound uniques on models with isDeleted, skipping partial ones and other models", () => {
		const schema = [
			"model Store {",
			"  code String @unique",
			"  slug String",
			"  // name String @unique",
			"  isDeleted Boolean @default(false)",
			"  @@unique([tenantId, slug], where: { isDeleted: false })",
			"  @@unique([tenantId, id])",
			"}",
			"model Log {",
			"  key String @unique",
			"}",
		].join("\n");
		expect(fullUniquesOnSoftDeletableModels(schema)).toStrictEqual(["Store.code", "Store.tenantId,id"]);
	});
});

describe("schema.prisma", () => {
	const found = fullUniquesOnSoftDeletableModels(SCHEMA);

	it("lists a reviewed reason for every full unique on a soft-deletable model (prefer a partial unique)", () => {
		expect(found.filter((key) => !(key in REVIEWED_FULL_UNIQUES))).toStrictEqual([]);
	});

	it("has no stale entries", () => {
		expect(Object.keys(REVIEWED_FULL_UNIQUES).filter((key) => !found.includes(key))).toStrictEqual([]);
	});
});
