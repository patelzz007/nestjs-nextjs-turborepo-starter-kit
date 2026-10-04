import { escapeIdentifier, type QueryResultRow } from "pg";
import { z } from "zod";

import type { CatalogColumn, SeedCoverageCatalog, TableMeasurement } from "./seed-coverage.js";

/**
 * The live-database side of `pnpm db:check-seed-coverage`: reads the Postgres
 * catalog and counts rows through ONE client that the caller has put in a
 * read-only transaction with `row_security = off` (BEGIN_READ_ONLY_AUDIT_SQL).
 */

/** Prisma's datasource URL names the Postgres schema in `?schema=`; Postgres defaults to `public`. */
export const DEFAULT_POSTGRES_SCHEMA = "public";

export interface SeedCoverageConnection {
	readonly connectionString: string;
	readonly schemaName: string;
}

/** Splits a Prisma datasource URL into a plain `pg` connection string and the schema it targets. */
export function parseSeedCoverageConnection(databaseUrl: string): SeedCoverageConnection {
	const url = new URL(databaseUrl);
	const schemaName = url.searchParams.get("schema") ?? DEFAULT_POSTGRES_SCHEMA;
	url.search = "";
	return { connectionString: url.toString(), schemaName };
}

/**
 * Statements that open the audit transaction. `row_security = off` makes
 * Postgres raise an error instead of silently filtering rows whenever a policy
 * would apply — so the check either sees every row (superuser / BYPASSRLS /
 * non-forced table owner) or fails loudly; it can never pass on a partial view.
 */
export const BEGIN_READ_ONLY_AUDIT_SQL: readonly string[] = ["BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY", "SET LOCAL row_security = off"];

/** Ordinary tables and partitioned parents; partitions are counted through their parent. */
export const LIST_COLUMNS_SQL = `
SELECT c.relname AS table_name, a.attname AS column_name, NOT a.attnotnull AS is_nullable
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = $1
  AND c.relkind IN ('r', 'p')
  AND NOT c.relispartition
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY c.relname, a.attnum`;

const CatalogColumnRowSchema = z.object({ table_name: z.string(), column_name: z.string(), is_nullable: z.boolean() });

/** `count(...)` is bigint, which `pg` returns as a decimal string. */
const CountSchema = z.coerce.number().int().nonnegative();

const ROW_COUNT_ALIAS = "row_count";

/** Column alias of the i-th nullable column's populated-row count. */
function populatedAlias(index: number): string {
	return `populated_${String(index)}`;
}

/** A count the measurement query must have returned; a missing alias is a bug in the query builder. */
function readCount(row: Readonly<Record<string, number>>, alias: string, tableName: string): number {
	const value = row[alias];
	if (value === undefined) {
		throw new Error(`Seed coverage: the measurement of ${tableName} returned no "${alias}" column`);
	}
	return value;
}

/** One full scan per table: total rows plus non-NULL rows per nullable column. Identifiers are escaped. */
export function buildMeasureTableSql(schemaName: string, tableName: string, nullableColumnNames: readonly string[]): string {
	const counts = nullableColumnNames.map((columnName: string, index: number): string => `count(${escapeIdentifier(columnName)}) AS ${populatedAlias(index)}`);
	return `SELECT ${[`count(*) AS ${ROW_COUNT_ALIAS}`, ...counts].join(", ")} FROM ${escapeIdentifier(schemaName)}.${escapeIdentifier(tableName)}`;
}

/** The one `pg` capability the catalog needs (a `PoolClient` satisfies it; tests pass an in-memory fake). */
export interface SqlQueryRunner {
	query(text: string, values?: string[]): Promise<{ readonly rows: readonly QueryResultRow[] }>;
}

export class PgSeedCoverageCatalog implements SeedCoverageCatalog {
	public constructor(
		private readonly client: SqlQueryRunner,
		private readonly schemaName: string,
	) {}

	public async listColumns(): Promise<CatalogColumn[]> {
		const result = await this.client.query(LIST_COLUMNS_SQL, [this.schemaName]);
		return z
			.array(CatalogColumnRowSchema)
			.parse(result.rows)
			.map((row): CatalogColumn => ({ tableName: row.table_name, columnName: row.column_name, isNullable: row.is_nullable }));
	}

	public async measureTable(tableName: string, nullableColumnNames: readonly string[]): Promise<TableMeasurement> {
		const result = await this.client.query(buildMeasureTableSql(this.schemaName, tableName, nullableColumnNames));
		const row = z.record(z.string(), CountSchema).parse(result.rows.at(0));
		const populatedRowCounts = new Map<string, number>();
		for (const [index, columnName] of nullableColumnNames.entries()) {
			populatedRowCounts.set(columnName, readCount(row, populatedAlias(index), tableName));
		}
		return { rowCount: readCount(row, ROW_COUNT_ALIAS, tableName), populatedRowCounts };
	}
}
