import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { MIN_EXEMPTION_REASON_LENGTH, SEED_COVERAGE_EXEMPTIONS, type SeedCoverageExemption } from "../prisma/seed/coverage-exemptions.js";
import {
	formatSeedCoverageReport,
	isCovered,
	listSchemaFileModelNames,
	parseExemptions,
	PRISMA_MIGRATIONS_TABLE,
	SeedCoverageAuditor,
	schemaTablesFromDmmf,
	type CatalogColumn,
	type SeedCoverageCatalog,
	type SeedCoverageReport,
	type SeedCoverageSchema,
	type TableMeasurement,
} from "./seed-coverage.js";

const SCHEMA_FILE: string = resolve(dirname(fileURLToPath(import.meta.url)), "../prisma/schema.prisma");
const VALID_REASON = "Mutually exclusive with another column by design: exactly one of the two is ever set.";

/** One in-memory table: its catalog columns and its rows (column → value, `null` = SQL NULL). */
interface FakeTable {
	readonly columns: readonly CatalogColumn[];
	readonly rows: readonly Readonly<Record<string, string | null>>[];
}

/** An in-memory `SeedCoverageCatalog`: measures rows exactly as `count(*)` / `count(column)` would. */
class InMemorySeedCoverageCatalog implements SeedCoverageCatalog {
	public readonly measuredTables: string[] = [];

	public constructor(private readonly tables: ReadonlyMap<string, FakeTable>) {}

	public listColumns(): Promise<CatalogColumn[]> {
		return Promise.resolve([...this.tables.values()].flatMap((table: FakeTable): CatalogColumn[] => [...table.columns]));
	}

	public measureTable(tableName: string, nullableColumnNames: readonly string[]): Promise<TableMeasurement> {
		this.measuredTables.push(tableName);
		const rows = this.tables.get(tableName)?.rows ?? [];
		const populatedRowCounts = new Map<string, number>(
			nullableColumnNames.map((column: string): [string, number] => [column, rows.filter((row) => (row[column] ?? null) !== null).length]),
		);
		return Promise.resolve({ rowCount: rows.length, populatedRowCounts });
	}
}

function column(tableName: string, columnName: string, isNullable: boolean): CatalogColumn {
	return { tableName, columnName, isNullable };
}

/** `users(id, deleted_at?)` and `tags(id, note?)`, both declared in the schema. */
function buildFixture(options: {
	readonly userRows: readonly Readonly<Record<string, string | null>>[];
	readonly tagRows: readonly Readonly<Record<string, string | null>>[];
	readonly extraTables?: ReadonlyMap<string, FakeTable>;
}): { catalog: InMemorySeedCoverageCatalog; schema: SeedCoverageSchema } {
	const tables = new Map<string, FakeTable>([
		["users", { columns: [column("users", "id", false), column("users", "deleted_at", true)], rows: options.userRows }],
		["tags", { columns: [column("tags", "id", false), column("tags", "note", true)], rows: options.tagRows }],
		...(options.extraTables ?? new Map<string, FakeTable>()),
	]);
	return {
		catalog: new InMemorySeedCoverageCatalog(tables),
		schema: {
			tables: [
				{ modelName: "User", tableName: "users", columnNames: ["id", "deleted_at"] },
				{ modelName: "Tag", tableName: "tags", columnNames: ["id", "note"] },
			],
			schemaFileModelNames: ["User", "Tag"],
		},
	};
}

async function audit(fixture: { catalog: SeedCoverageCatalog; schema: SeedCoverageSchema }, exemptions: readonly SeedCoverageExemption[] = []): Promise<SeedCoverageReport> {
	return new SeedCoverageAuditor(fixture.catalog, fixture.schema, exemptions).audit();
}

const FULLY_SEEDED = {
	userRows: [
		{ id: "u1", deleted_at: null },
		{ id: "u2", deleted_at: "1767225600000" },
	],
	tagRows: [{ id: "t1", note: "launch" }],
};

describe("SeedCoverageAuditor", () => {
	it("passes when every table has rows and every nullable column is populated in at least one row", async () => {
		const report = await audit(buildFixture(FULLY_SEEDED));

		expect(isCovered(report)).toBe(true);
		expect(report.tablesChecked).toBe(2);
		expect(report.nullableColumnsChecked).toBe(2);
		expect(formatSeedCoverageReport(report)).toContain("Every table has rows and every nullable column holds a value.");
	});

	it("fails on a table with zero rows, without also listing its columns as gaps", async () => {
		const report = await audit(buildFixture({ ...FULLY_SEEDED, tagRows: [] }));

		expect(isCovered(report)).toBe(false);
		expect(report.emptyTables).toEqual(["tags"]);
		expect(report.nullOnlyColumns).toEqual([]);
		expect(formatSeedCoverageReport(report)).toContain("Empty tables (seed at least one realistic row) (1):\n  - tags");
	});

	it("fails on a nullable column that is NULL in every row (e.g. no soft-deleted row was seeded)", async () => {
		const report = await audit(buildFixture({ ...FULLY_SEEDED, userRows: [{ id: "u1", deleted_at: null }] }));

		expect(isCovered(report)).toBe(false);
		expect(report.nullOnlyColumns).toEqual([{ tableName: "users", columnName: "deleted_at", rowCount: 1 }]);
		expect(formatSeedCoverageReport(report)).toContain("users (1 rows): deleted_at");
	});

	it("never checks NOT NULL columns for population (the database already guarantees them)", async () => {
		const fixture = buildFixture(FULLY_SEEDED);
		const report = await audit(fixture);

		expect(report.nullableColumnsChecked).toBe(2);
		expect(fixture.catalog.measuredTables.sort()).toEqual(["tags", "users"]);
	});

	it("ignores Prisma's _prisma_migrations bookkeeping table", async () => {
		const extraTables = new Map<string, FakeTable>([[PRISMA_MIGRATIONS_TABLE, { columns: [column(PRISMA_MIGRATIONS_TABLE, "finished_at", true)], rows: [] }]]);
		const report = await audit(buildFixture({ ...FULLY_SEEDED, extraTables }));

		expect(isCovered(report)).toBe(true);
	});

	describe("schema ↔ database reconciliation", () => {
		it("fails when the database has a table schema.prisma does not declare", async () => {
			const extraTables = new Map<string, FakeTable>([["legacy_things", { columns: [column("legacy_things", "id", false)], rows: [{ id: "x" }] }]]);
			const report = await audit(buildFixture({ ...FULLY_SEEDED, extraTables }));

			expect(report.drift.tablesMissingFromSchema).toEqual(["legacy_things"]);
			expect(isCovered(report)).toBe(false);
		});

		it("fails when a schema model has no table (a new model nobody migrated can never be missed)", async () => {
			const fixture = buildFixture(FULLY_SEEDED);
			const schema: SeedCoverageSchema = {
				tables: [...fixture.schema.tables, { modelName: "Invoice", tableName: "invoices", columnNames: ["id"] }],
				schemaFileModelNames: [...fixture.schema.schemaFileModelNames, "Invoice"],
			};
			const report = await audit({ catalog: fixture.catalog, schema });

			expect(report.drift.tablesMissingFromDatabase).toEqual(["invoices"]);
			expect(isCovered(report)).toBe(false);
		});

		it("fails on a column that exists on only one side", async () => {
			const fixture = buildFixture(FULLY_SEEDED);
			const schema: SeedCoverageSchema = {
				...fixture.schema,
				tables: [
					{ modelName: "User", tableName: "users", columnNames: ["id", "deleted_at", "nickname"] },
					{ modelName: "Tag", tableName: "tags", columnNames: ["id"] },
				],
			};
			const report = await audit({ catalog: fixture.catalog, schema });

			expect(report.drift.columnsMissingFromDatabase).toEqual(["users.nickname"]);
			expect(report.drift.columnsMissingFromSchema).toEqual(["tags.note"]);
			expect(isCovered(report)).toBe(false);
		});

		it("fails when the generated client is stale relative to schema.prisma", async () => {
			const fixture = buildFixture(FULLY_SEEDED);
			const report = await audit({ catalog: fixture.catalog, schema: { ...fixture.schema, schemaFileModelNames: ["User", "Tag", "Invoice"] } });

			expect(report.drift.modelsMissingFromGeneratedClient).toEqual(["Invoice"]);
			expect(formatSeedCoverageReport(report)).toContain("run `pnpm db:generate`");
			expect(isCovered(report)).toBe(false);
		});
	});

	describe("exemptions", () => {
		it("accepts a listed gap and reports it as exempted", async () => {
			const exemption: SeedCoverageExemption = { kind: "null-column", table: "users", column: "deleted_at", reason: VALID_REASON };
			const report = await audit(buildFixture({ ...FULLY_SEEDED, userRows: [{ id: "u1", deleted_at: null }] }), [exemption]);

			expect(isCovered(report)).toBe(true);
			expect(report.exemptedGaps).toEqual([exemption]);
		});

		it("accepts a listed empty table", async () => {
			const report = await audit(buildFixture({ ...FULLY_SEEDED, tagRows: [] }), [{ kind: "empty-table", table: "tags", reason: VALID_REASON }]);

			expect(isCovered(report)).toBe(true);
		});

		it("fails on an exemption the seed no longer needs, so the list only ever shrinks", async () => {
			const report = await audit(buildFixture(FULLY_SEEDED), [{ kind: "null-column", table: "users", column: "deleted_at", reason: VALID_REASON }]);

			expect(isCovered(report)).toBe(false);
			expect(report.staleExemptions).toEqual([expect.stringContaining("null-column users.deleted_at")]);
		});

		it("fails on an exemption naming a table or column that does not exist", async () => {
			const report = await audit(buildFixture(FULLY_SEEDED), [{ kind: "empty-table", table: "no_such_table", reason: VALID_REASON }]);

			expect(report.staleExemptions).toEqual([expect.stringContaining("empty-table no_such_table")]);
		});

		it("rejects an exemption without a real written reason", () => {
			expect(() => parseExemptions([{ kind: "empty-table", table: "tags", reason: "not seeded" }])).toThrow();
			expect(() => parseExemptions([{ kind: "empty-table", table: "tags", reason: "x".repeat(MIN_EXEMPTION_REASON_LENGTH) }])).not.toThrow();
		});

		it("rejects a duplicated exemption", () => {
			const entry: SeedCoverageExemption = { kind: "empty-table", table: "tags", reason: VALID_REASON };

			expect(() => parseExemptions([entry, entry])).toThrow("Duplicate seed-coverage exemption: empty-table tags");
		});

		it("keeps the committed allowlist valid", () => {
			expect(parseExemptions(SEED_COVERAGE_EXEMPTIONS)).toHaveLength(SEED_COVERAGE_EXEMPTIONS.length);
		});
	});
});

describe("schemaTablesFromDmmf", () => {
	it("maps @@map / @map names and leaves relation fields out", () => {
		expect(
			schemaTablesFromDmmf([
				{
					name: "ApiKey",
					dbName: "api_keys",
					fields: [
						{ name: "id", kind: "scalar" },
						{ name: "lastUsedAt", kind: "scalar", dbName: "last_used_at" },
						{ name: "status", kind: "enum" },
						{ name: "user", kind: "object" },
					],
				},
				{ name: "Product", dbName: null, fields: [{ name: "id", kind: "scalar", dbName: null }] },
			]),
		).toEqual([
			{ modelName: "ApiKey", tableName: "api_keys", columnNames: ["id", "last_used_at", "status"] },
			{ modelName: "Product", tableName: "Product", columnNames: ["id"] },
		]);
	});

	it("covers every model declared in schema.prisma (the generated client is current)", () => {
		const fileModels = listSchemaFileModelNames(readFileSync(SCHEMA_FILE, "utf8"));
		const dmmfModels = schemaTablesFromDmmf(Prisma.dmmf.datamodel.models).map((table) => table.modelName);

		expect(fileModels.length).toBeGreaterThan(0);
		expect([...dmmfModels].sort()).toEqual([...fileModels].sort());
	});
});

describe("listSchemaFileModelNames", () => {
	it("reads model declarations and ignores enums, comments and indented text", () => {
		const schema = ["enum Plan {", "  FREE", "}", "// model Commented {", "model User {", "  id String @id", "}", "model ApiKey{", "}", "  model Indented {"].join("\n");

		expect(listSchemaFileModelNames(schema)).toEqual(["User", "ApiKey"]);
	});
});
