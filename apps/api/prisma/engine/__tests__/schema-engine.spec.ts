import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { applyBaseModel, BASE_BLOCK_END, BASE_BLOCK_START, MANAGED_BLOCK_END, MANAGED_BLOCK_START, SchemaEngineError } from "../schema-engine";

const BASE = `${BASE_BLOCK_START}
//   id        String  @id @default(uuid(7))
//   createdAt BigInt
//   isDeleted Boolean @default(false)
${BASE_BLOCK_END}`;

const SCHEMA_FILE: string = resolve(import.meta.dirname, "..", "..", "schema.prisma");

/** A model's body lines, trimmed (the formatter's alignment is not the engine's concern). */
function modelLines(schema: string, name: string): string[] {
	const start = schema.indexOf(`model ${name} {`);
	const end = schema.indexOf("\n}", start);
	return schema
		.slice(start, end)
		.split("\n")
		.slice(1)
		.map((line: string): string => line.trim().replace(/\s+/g, " "))
		.filter((line: string): boolean => line.length > 0);
}

/** Whitespace-insensitive, so `prisma format`'s alignment does not matter. */
function normalized(schema: string): string {
	return schema
		.split("\n")
		.map((line: string): string => line.trim().replace(/\s+/g, " "))
		.filter((line: string): boolean => line.length > 0)
		.join("\n");
}

describe("applyBaseModel", () => {
	it("writes the base fields into a managed block at the top of each model, before its own fields", () => {
		const schema = applyBaseModel(`${BASE}\n\n/// @extends BaseModel\nmodel Thing {\n  name String\n\n  @@index([name])\n}`);

		expect(modelLines(schema, "Thing")).toEqual([
			MANAGED_BLOCK_START,
			"id String @id @default(uuid(7))",
			"createdAt BigInt",
			"isDeleted Boolean @default(false)",
			MANAGED_BLOCK_END,
			"name String",
			"@@index([name])",
		]);
	});

	it("rewrites an existing managed block, so a base change reaches every model, and is idempotent", () => {
		const first = applyBaseModel(`${BASE}\n\n/// @extends BaseModel\nmodel Thing {\n  name String\n}`);
		const changedBase = first.replace("//   createdAt BigInt", "//   createdAt BigInt\n//   createdBy String?");
		const second = applyBaseModel(changedBase);

		expect(applyBaseModel(first)).toBe(first);
		expect(modelLines(second, "Thing")).toContain("createdBy String?");
		expect(modelLines(second, "Thing").filter((line: string): boolean => line === MANAGED_BLOCK_START)).toHaveLength(1);
	});

	it("lets a model override a base field by declaring it below the block", () => {
		const schema = applyBaseModel(`${BASE}\n\n/// @extends BaseModel\nmodel Region {\n  id Int @id @default(autoincrement())\n}`);

		expect(modelLines(schema, "Region").filter((line: string): boolean => line.startsWith("id "))).toEqual(["id Int @id @default(autoincrement())"]);
	});

	it("gives no base id to a model with its own primary key", () => {
		const schema = applyBaseModel(
			`${BASE}\n\n/// @extends BaseModel\nmodel Delivery {\n  deliveryId String @id\n}\n\n/// @extends BaseModel\nmodel Pair {\n  a String\n  b String\n\n  @@id([a, b])\n}`,
		);

		expect(modelLines(schema, "Delivery").some((line: string): boolean => line.startsWith("id "))).toBe(false);
		expect(modelLines(schema, "Pair").some((line: string): boolean => line.startsWith("id "))).toBe(false);
	});

	it("passes every other block and comment through untouched", () => {
		const enumBlock = 'enum Plan {\n  FREE\n  PRO @map("pro")\n}';
		const schema = applyBaseModel(`${BASE}\n\n${enumBlock}\n\n/// What it is.\n/// @extends BaseModel\nmodel Thing {\n  /// Its name.\n  name String\n}`);

		expect(schema).toContain(enumBlock);
		expect(schema).toContain("/// What it is.\n/// @extends BaseModel\nmodel Thing {");
		expect(modelLines(schema, "Thing")).toContain("/// Its name.");
	});

	it("refuses a model without the directive, another base, a duplicate name, a missing base and an unclosed block", () => {
		expect((): string => applyBaseModel(`${BASE}\n\nmodel Loose {\n  id String @id\n}`)).toThrow(SchemaEngineError);
		expect((): string => applyBaseModel(`${BASE}\n\n/// @extends Other\nmodel Thing {\n  name String\n}`)).toThrow(/@extends BaseModel/);
		expect((): string => applyBaseModel(`${BASE}\n\n/// @extends BaseModel\nmodel T {\n}\n\n/// @extends BaseModel\nmodel T {\n}`)).toThrow(/declared twice/);
		expect((): string => applyBaseModel("/// @extends BaseModel\nmodel T {\n}")).toThrow(/@base-model/);
		expect((): string => applyBaseModel(`${BASE}\n\n/// @extends BaseModel\nmodel T {\n  ${MANAGED_BLOCK_START}\n  name String\n}`)).toThrow(/never closed/);
		expect((): string => applyBaseModel(`${BASE_BLOCK_START}\n//   @@index([id])\n${BASE_BLOCK_END}`)).toThrow(/only declare fields/);
	});
});

describe("the committed schema", () => {
	it("already carries the current base model in every model — run `pnpm db:schema` after editing it", () => {
		const schema = readFileSync(SCHEMA_FILE, "utf8");

		expect(normalized(applyBaseModel(schema))).toBe(normalized(schema));
	});

	it("declares no @map or @@map: tables and columns are named exactly like the models and fields", () => {
		expect(readFileSync(SCHEMA_FILE, "utf8")).not.toMatch(/@@?map\(/);
	});
});
