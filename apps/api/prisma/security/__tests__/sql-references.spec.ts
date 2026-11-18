import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { SYSTEM_OPERATIONS } from "../../../src/prisma/system-operation.registry";
import { allFunctions } from "../generator";
import { TABLE_SPECIFIC_RULES } from "../generator/table-specific-rules";
import { findUnknownReferences, readSchemaColumns } from "../sql-references";
import { SECURITY_TRIGGERS } from "../triggers";

const apiDir = resolve(import.meta.dirname, "..", "..", "..");
const columns = readSchemaColumns(readFileSync(resolve(apiDir, "prisma", "schema.prisma"), "utf8"));
const knownTables: ReadonlySet<string> = new Set(columns.keys());

const SCHEMA = `
model Note {
  id        String @id
  userId    String
  tenantId  String
  isDeleted Boolean
}

model Tag {
  id     String @id
  noteId String
}
`;
const NOTE_COLUMNS = readSchemaColumns(SCHEMA);

describe("findUnknownReferences", () => {
	it("accepts tables and columns the schema has, aliased, table-qualified or bare", () => {
		const sqlText = `EXISTS (SELECT 1 FROM public."Tag" t WHERE t."noteId" = "Note".id AND t.id IS NOT NULL) AND "userId" = 'x."nope"' -- n."gone"`;
		expect(findUnknownReferences(sqlText, NOTE_COLUMNS, "Note")).toStrictEqual([]);
	});

	it("names an unknown table, an unknown aliased column and an unknown bare column", () => {
		const sqlText = `EXISTS (SELECT 1 FROM public."Gone" g) AND EXISTS (SELECT 1 FROM public."Tag" t WHERE t."nodeId" = id AND t.label = 'a') AND "ownerId" = 'x'`;
		expect(findUnknownReferences(sqlText, NOTE_COLUMNS, "Note").map((problem) => problem.problem)).toStrictEqual([
			"no table Gone",
			"no column nodeId on Tag",
			"no column label on Tag",
			"no column ownerId on Note or Gone or Tag",
		]);
	});

	it("checks a table-qualified column, and leaves bare columns of a function body alone", () => {
		expect(findUnknownReferences(`"Note"."ownerId" = 1`, NOTE_COLUMNS).map((problem) => problem.problem)).toStrictEqual(["no column ownerId on Note"]);
		expect(findUnknownReferences(`SELECT "anything" FROM public."Note" n WHERE n."userId" = $1`, NOTE_COLUMNS)).toStrictEqual([]);
	});
});

describe("the security SQL names only tables and columns the schema has", () => {
	it("in every function body", () => {
		for (const fn of allFunctions(SYSTEM_OPERATIONS, knownTables)) {
			expect(findUnknownReferences(fn.definition, columns), fn.signature).toStrictEqual([]);
		}
	});

	it("in every one-off rule, against its own table", () => {
		for (const [rule, definition] of Object.entries(TABLE_SPECIFIC_RULES)) {
			const clauses = [definition.clauses.using ?? "", definition.clauses.withCheck ?? ""].join("\n");
			expect(findUnknownReferences(clauses, columns, definition.table), rule).toStrictEqual([]);
		}
	});

	it("in every trigger", () => {
		for (const trigger of SECURITY_TRIGGERS) {
			expect(findUnknownReferences(trigger.definition, columns, trigger.table), trigger.name).toStrictEqual([]);
		}
	});
});
