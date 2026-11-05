import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { modelsReferringToAPerson, PERSONAL_DATA_CLASSES } from "../personal-data";

const SCHEMA = readFileSync(join(import.meta.dirname, "..", "schema.prisma"), "utf8");

describe("modelsReferringToAPerson", () => {
	it("finds a relation to User, a person-id column or a copied personal value, ignoring comments and other models", () => {
		const schema = [
			"model Claim {",
			"  userId String",
			"}",
			"model Owner {",
			"  user User @relation(fields: [userId], references: [id])",
			"}",
			"model Log {",
			"  ipAddress String?",
			"}",
			"model Ban {",
			"  bannedByUserId String",
			"}",
			"model Country {",
			"  name String",
			"  /// email String",
			"}",
		].join("\n");
		expect(modelsReferringToAPerson(schema)).toStrictEqual(["Ban", "Claim", "Log", "Owner"]);
	});
});

describe("schema.prisma and account erasure (ADR 077)", () => {
	const found = modelsReferringToAPerson(SCHEMA);

	it("classifies every table that refers to a person", () => {
		expect(found.filter((model) => !(model in PERSONAL_DATA_CLASSES))).toStrictEqual([]);
	});

	it("has no stale entries", () => {
		expect(Object.keys(PERSONAL_DATA_CLASSES).filter((model) => !found.includes(model))).toStrictEqual([]);
	});
});
