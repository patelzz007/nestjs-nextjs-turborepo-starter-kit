import type { QueryResultRow } from "pg";
import { describe, expect, it } from "vitest";

import {
	BEGIN_READ_ONLY_AUDIT_SQL,
	buildMeasureTableSql,
	DEFAULT_POSTGRES_SCHEMA,
	LIST_COLUMNS_SQL,
	parseSeedCoverageConnection,
	PgSeedCoverageCatalog,
	type SqlQueryRunner,
} from "./seed-coverage-catalog.js";

/** Records every statement and answers with canned rows. */
class RecordingQueryRunner implements SqlQueryRunner {
	public readonly statements: { text: string; values: string[] | undefined }[] = [];

	public constructor(private readonly rows: readonly QueryResultRow[]) {}

	public query(text: string, values?: string[]): Promise<{ readonly rows: readonly QueryResultRow[] }> {
		this.statements.push({ text, values });
		return Promise.resolve({ rows: this.rows });
	}
}

describe("parseSeedCoverageConnection", () => {
	it("strips Prisma's query parameters and reads the target schema from ?schema=", () => {
		expect(parseSeedCoverageConnection("postgresql://postgres:secret@localhost:5432/app?schema=tenant_a")).toEqual({
			connectionString: "postgresql://postgres:secret@localhost:5432/app",
			schemaName: "tenant_a",
		});
	});

	it("defaults to the public schema", () => {
		expect(parseSeedCoverageConnection("postgresql://postgres@localhost/app").schemaName).toBe(DEFAULT_POSTGRES_SCHEMA);
	});
});

describe("BEGIN_READ_ONLY_AUDIT_SQL", () => {
	it("opens a read-only transaction that errors instead of returning an RLS-filtered view", () => {
		expect(BEGIN_READ_ONLY_AUDIT_SQL.at(0)).toMatch(/READ ONLY/);
		expect(BEGIN_READ_ONLY_AUDIT_SQL).toContain("SET LOCAL row_security = off");
	});
});

describe("buildMeasureTableSql", () => {
	it("counts all rows and the non-NULL rows of each nullable column in one scan", () => {
		expect(buildMeasureTableSql("public", "users", ["deleted_at", "locked_until"])).toBe(
			'SELECT count(*) AS row_count, count("deleted_at") AS populated_0, count("locked_until") AS populated_1 FROM "public"."users"',
		);
	});

	it("escapes identifiers so a table or column name can never inject SQL", () => {
		expect(buildMeasureTableSql("public", 'evil"; DROP TABLE users; --', ['x"y'])).toBe(
			'SELECT count(*) AS row_count, count("x""y") AS populated_0 FROM "public"."evil""; DROP TABLE users; --"',
		);
	});

	it("counts only rows when the table has no nullable column", () => {
		expect(buildMeasureTableSql("public", "roles", [])).toBe('SELECT count(*) AS row_count FROM "public"."roles"');
	});
});

describe("PgSeedCoverageCatalog", () => {
	it("lists ordinary-table columns of the configured schema with their nullability", async () => {
		const runner = new RecordingQueryRunner([
			{ table_name: "users", column_name: "id", is_nullable: false },
			{ table_name: "users", column_name: "deleted_at", is_nullable: true },
		]);

		await expect(new PgSeedCoverageCatalog(runner, "public").listColumns()).resolves.toEqual([
			{ tableName: "users", columnName: "id", isNullable: false },
			{ tableName: "users", columnName: "deleted_at", isNullable: true },
		]);
		expect(runner.statements).toEqual([{ text: LIST_COLUMNS_SQL, values: ["public"] }]);
	});

	it("parses pg's bigint count strings into a measurement", async () => {
		const runner = new RecordingQueryRunner([{ row_count: "41", populated_0: "3", populated_1: "0" }]);

		const measurement = await new PgSeedCoverageCatalog(runner, "public").measureTable("users", ["deleted_at", "locked_until"]);

		expect(measurement.rowCount).toBe(41);
		expect([...measurement.populatedRowCounts]).toEqual([
			["deleted_at", 3],
			["locked_until", 0],
		]);
	});

	it("fails loudly when the database returns an unexpected shape", async () => {
		await expect(new PgSeedCoverageCatalog(new RecordingQueryRunner([{ row_count: "1" }]), "public").measureTable("users", ["deleted_at"])).rejects.toThrow(
			'returned no "populated_0" column',
		);
		await expect(new PgSeedCoverageCatalog(new RecordingQueryRunner([{ table_name: "users" }]), "public").listColumns()).rejects.toThrow();
	});
});
