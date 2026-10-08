import { z } from "zod";

import { SeedCoverageExemptionSchema, type SeedCoverageExemption } from "../prisma/seed/coverage-exemptions.js";

/**
 * Logic behind `pnpm db:check-seed-coverage` (scripts/check-seed-coverage.ts).
 *
 * After `pnpm db:seed`, every table must hold at least one row and every
 * nullable column must hold a non-NULL value in at least one row, unless
 * `prisma/seed/coverage-exemptions.ts` lists the gap with a written reason.
 *
 * The table/column list comes from BOTH the Prisma schema (DMMF) and the live
 * Postgres catalog; any disagreement between the two is reported too, so a new
 * model, a new column or a stale generated client can never slip past the check.
 */

/** Prisma's own bookkeeping table: it is not part of `schema.prisma`. */
export const PRISMA_MIGRATIONS_TABLE = "_prisma_migrations";

/** One table as `schema.prisma` declares it (model + its scalar/enum columns). */
export interface SchemaTable {
	readonly modelName: string;
	readonly tableName: string;
	readonly columnNames: readonly string[];
}

/** One column as the live database catalog reports it. */
export interface CatalogColumn {
	readonly tableName: string;
	readonly columnName: string;
	readonly isNullable: boolean;
}

/** Row count of one table plus, per nullable column, how many rows hold a non-NULL value. */
export interface TableMeasurement {
	readonly rowCount: number;
	readonly populatedRowCounts: ReadonlyMap<string, number>;
}

/** Read-only access to the seeded database — the port the auditor depends on. */
export interface SeedCoverageCatalog {
	listColumns(): Promise<CatalogColumn[]>;
	measureTable(tableName: string, nullableColumnNames: readonly string[]): Promise<TableMeasurement>;
}

/** The schema as Prisma sees it: the generated client's DMMF, plus the model names declared in `schema.prisma`. */
export interface SeedCoverageSchema {
	readonly tables: readonly SchemaTable[];
	readonly schemaFileModelNames: readonly string[];
}

/** Where `schema.prisma`, the generated client and the live database disagree. */
export interface SchemaCatalogDrift {
	readonly modelsMissingFromGeneratedClient: readonly string[];
	readonly modelsMissingFromSchemaFile: readonly string[];
	readonly tablesMissingFromDatabase: readonly string[];
	readonly tablesMissingFromSchema: readonly string[];
	readonly columnsMissingFromDatabase: readonly string[];
	readonly columnsMissingFromSchema: readonly string[];
}

export interface NullOnlyColumn {
	readonly tableName: string;
	readonly columnName: string;
	readonly rowCount: number;
}

export interface SeedCoverageReport {
	readonly tablesChecked: number;
	readonly nullableColumnsChecked: number;
	readonly drift: SchemaCatalogDrift;
	readonly emptyTables: readonly string[];
	readonly nullOnlyColumns: readonly NullOnlyColumn[];
	readonly exemptedGaps: readonly SeedCoverageExemption[];
	readonly staleExemptions: readonly string[];
}

// ── DMMF → schema tables ────────────────────────────────────────────────────

/** The part of Prisma's runtime DMMF this check reads (structural, so tests need no generated client). */
export interface DmmfFieldShape {
	readonly name: string;
	readonly kind: string;
	readonly dbName?: string | null;
}

export interface DmmfModelShape {
	readonly name: string;
	readonly dbName: string | null;
	readonly fields: readonly DmmfFieldShape[];
}

/** DMMF field kind of a relation: it has no column of its own (its foreign key is a separate scalar field). */
const RELATION_FIELD_KIND = "object";

/** Maps Prisma models to their tables (`@@map`) and columns (`@map`); relation fields have no column. */
export function schemaTablesFromDmmf(models: readonly DmmfModelShape[]): SchemaTable[] {
	return models.map((model: DmmfModelShape): SchemaTable => ({
		modelName: model.name,
		tableName: model.dbName ?? model.name,
		columnNames: model.fields
			.filter((field: DmmfFieldShape): boolean => field.kind !== RELATION_FIELD_KIND)
			.map((field: DmmfFieldShape): string => field.dbName ?? field.name),
	}));
}

const SCHEMA_MODEL_DECLARATION = /^model\s+(?<model>\w+)\s*\{/gm;

/** Model names declared in `schema.prisma` — compared with the DMMF to detect a stale generated client. */
export function listSchemaFileModelNames(schemaContent: string): string[] {
	return [...schemaContent.matchAll(SCHEMA_MODEL_DECLARATION)].flatMap((match: RegExpExecArray): string[] => (match.groups?.model === undefined ? [] : [match.groups.model]));
}

// ── Schema ↔ catalog reconciliation ─────────────────────────────────────────

function columnKey(tableName: string, columnName: string): string {
	return `${tableName}.${columnName}`;
}

function sorted(values: Iterable<string>): string[] {
	return [...values].sort((a: string, b: string): number => a.localeCompare(b));
}

/** Groups catalog columns by table, leaving out Prisma's migration bookkeeping table. */
export function groupCatalogColumns(columns: readonly CatalogColumn[]): Map<string, CatalogColumn[]> {
	const byTable = new Map<string, CatalogColumn[]>();
	for (const column of columns) {
		if (column.tableName === PRISMA_MIGRATIONS_TABLE) {
			continue;
		}
		const tableColumns = byTable.get(column.tableName) ?? [];
		tableColumns.push(column);
		byTable.set(column.tableName, tableColumns);
	}
	return byTable;
}

export function reconcileSchemaWithCatalog(schema: SeedCoverageSchema, catalogByTable: ReadonlyMap<string, readonly CatalogColumn[]>): SchemaCatalogDrift {
	const schemaTables = schema.tables;
	const dmmfModelNames = new Set(schemaTables.map((table: SchemaTable): string => table.modelName));
	const fileModelNames = new Set(schema.schemaFileModelNames);
	const schemaTableNames = new Set(schemaTables.map((table: SchemaTable): string => table.tableName));
	const columnsMissingFromDatabase: string[] = [];
	const columnsMissingFromSchema: string[] = [];

	for (const table of schemaTables) {
		const catalogColumns = catalogByTable.get(table.tableName);
		if (catalogColumns === undefined) {
			continue;
		}
		const catalogNames = new Set(catalogColumns.map((column: CatalogColumn): string => column.columnName));
		const schemaNames = new Set(table.columnNames);
		for (const name of schemaNames) {
			if (!catalogNames.has(name)) {
				columnsMissingFromDatabase.push(columnKey(table.tableName, name));
			}
		}
		for (const name of catalogNames) {
			if (!schemaNames.has(name)) {
				columnsMissingFromSchema.push(columnKey(table.tableName, name));
			}
		}
	}

	return {
		modelsMissingFromGeneratedClient: sorted([...fileModelNames].filter((name: string): boolean => !dmmfModelNames.has(name))),
		modelsMissingFromSchemaFile: sorted([...dmmfModelNames].filter((name: string): boolean => !fileModelNames.has(name))),
		tablesMissingFromDatabase: sorted([...schemaTableNames].filter((name: string): boolean => !catalogByTable.has(name))),
		tablesMissingFromSchema: sorted([...catalogByTable.keys()].filter((name: string): boolean => !schemaTableNames.has(name))),
		columnsMissingFromDatabase: sorted(columnsMissingFromDatabase),
		columnsMissingFromSchema: sorted(columnsMissingFromSchema),
	};
}

export function hasDrift(drift: SchemaCatalogDrift): boolean {
	return (
		drift.modelsMissingFromGeneratedClient.length > 0 ||
		drift.modelsMissingFromSchemaFile.length > 0 ||
		drift.tablesMissingFromDatabase.length > 0 ||
		drift.tablesMissingFromSchema.length > 0 ||
		drift.columnsMissingFromDatabase.length > 0 ||
		drift.columnsMissingFromSchema.length > 0
	);
}

// ── Exemptions ──────────────────────────────────────────────────────────────

/** Re-validates the allowlist at runtime (reason length, identifier shape) and rejects duplicate entries. */
export function parseExemptions(entries: readonly SeedCoverageExemption[]): SeedCoverageExemption[] {
	const parsed = z.array(SeedCoverageExemptionSchema).parse(entries);
	const seen = new Set<string>();
	for (const entry of parsed) {
		const key = exemptionKey(entry);
		if (seen.has(key)) {
			throw new Error(`Duplicate seed-coverage exemption: ${key}`);
		}
		seen.add(key);
	}
	return parsed;
}

function exemptionKey(entry: SeedCoverageExemption): string {
	switch (entry.kind) {
		case "empty-table":
			return `empty-table ${entry.table}`;
		case "null-column":
			return `null-column ${columnKey(entry.table, entry.column)}`;
	}
}

// ── Auditor ─────────────────────────────────────────────────────────────────

interface MeasuredTable {
	readonly tableName: string;
	readonly nullableColumns: readonly string[];
	readonly measurement: TableMeasurement;
}

/**
 * Audits a seeded database against the schema. Depends only on the
 * `SeedCoverageCatalog` port, so it is unit-tested with an in-memory catalog.
 */
export class SeedCoverageAuditor {
	public constructor(
		private readonly catalog: SeedCoverageCatalog,
		private readonly schema: SeedCoverageSchema,
		private readonly exemptions: readonly SeedCoverageExemption[],
	) {}

	public async audit(): Promise<SeedCoverageReport> {
		const exemptions = parseExemptions(this.exemptions);
		const catalogByTable = groupCatalogColumns(await this.catalog.listColumns());
		const drift = reconcileSchemaWithCatalog(this.schema, catalogByTable);
		const measured = await this.measureSchemaTables(catalogByTable);

		const emptyTables: string[] = [];
		const nullOnlyColumns: NullOnlyColumn[] = [];
		for (const table of measured) {
			if (table.measurement.rowCount === 0) {
				emptyTables.push(table.tableName);
				continue;
			}
			for (const columnName of table.nullableColumns) {
				if ((table.measurement.populatedRowCounts.get(columnName) ?? 0) === 0) {
					nullOnlyColumns.push({ tableName: table.tableName, columnName, rowCount: table.measurement.rowCount });
				}
			}
		}

		const isExempt = (entry: SeedCoverageExemption): boolean =>
			entry.kind === "empty-table"
				? emptyTables.includes(entry.table)
				: nullOnlyColumns.some((gap: NullOnlyColumn): boolean => gap.tableName === entry.table && gap.columnName === entry.column);

		return {
			tablesChecked: measured.length,
			nullableColumnsChecked: measured.reduce((total: number, table: MeasuredTable): number => total + table.nullableColumns.length, 0),
			drift,
			emptyTables: emptyTables.filter((tableName: string): boolean => !exemptions.some((entry) => entry.kind === "empty-table" && entry.table === tableName)),
			nullOnlyColumns: nullOnlyColumns.filter(
				(gap: NullOnlyColumn): boolean => !exemptions.some((entry) => entry.kind === "null-column" && entry.table === gap.tableName && entry.column === gap.columnName),
			),
			exemptedGaps: exemptions.filter(isExempt),
			staleExemptions: exemptions
				.filter((entry: SeedCoverageExemption): boolean => !isExempt(entry))
				.map((entry: SeedCoverageExemption): string => `${exemptionKey(entry)} — no such gap (the table/column is unknown or the seed now covers it); remove the entry`),
		};
	}

	/** Measures every schema table that exists in the database (missing ones are reported as drift). */
	private async measureSchemaTables(catalogByTable: ReadonlyMap<string, readonly CatalogColumn[]>): Promise<MeasuredTable[]> {
		const measured: MeasuredTable[] = [];
		for (const table of [...this.schema.tables].sort((a: SchemaTable, b: SchemaTable): number => a.tableName.localeCompare(b.tableName))) {
			const catalogColumns = catalogByTable.get(table.tableName);
			if (catalogColumns === undefined) {
				continue;
			}
			const nullableColumns = catalogColumns.filter((column: CatalogColumn): boolean => column.isNullable).map((column: CatalogColumn): string => column.columnName);
			measured.push({ tableName: table.tableName, nullableColumns, measurement: await this.catalog.measureTable(table.tableName, nullableColumns) });
		}
		return measured;
	}
}

export function isCovered(report: SeedCoverageReport): boolean {
	return !hasDrift(report.drift) && report.emptyTables.length === 0 && report.nullOnlyColumns.length === 0 && report.staleExemptions.length === 0;
}

// ── Report formatting ───────────────────────────────────────────────────────

function section(title: string, lines: readonly string[]): string[] {
	return lines.length === 0 ? [] : [`${title} (${String(lines.length)}):`, ...lines.map((line: string): string => `  - ${line}`), ""];
}

function groupNullOnlyColumns(columns: readonly NullOnlyColumn[]): string[] {
	const byTable = new Map<string, NullOnlyColumn[]>();
	for (const column of columns) {
		byTable.set(column.tableName, [...(byTable.get(column.tableName) ?? []), column]);
	}
	return [...byTable.entries()].map(
		([tableName, tableColumns]: [string, NullOnlyColumn[]]): string =>
			`${tableName} (${String(tableColumns.at(0)?.rowCount ?? 0)} rows): ${tableColumns.map((column: NullOnlyColumn): string => column.columnName).join(", ")}`,
	);
}

export function formatSeedCoverageReport(report: SeedCoverageReport): string {
	return [
		"Seed coverage check",
		`  Tables checked: ${String(report.tablesChecked)}`,
		`  Nullable columns checked: ${String(report.nullableColumnsChecked)}`,
		`  Exempted gaps: ${String(report.exemptedGaps.length)}`,
		"",
		...section("Models in schema.prisma but not in the generated client (run `pnpm db:generate`)", report.drift.modelsMissingFromGeneratedClient),
		...section("Models in the generated client but not in schema.prisma (run `pnpm db:generate`)", report.drift.modelsMissingFromSchemaFile),
		...section("Tables in schema.prisma but not in the database (apply migrations / regenerate the client)", report.drift.tablesMissingFromDatabase),
		...section("Tables in the database but not in schema.prisma", report.drift.tablesMissingFromSchema),
		...section("Columns in schema.prisma but not in the database", report.drift.columnsMissingFromDatabase),
		...section("Columns in the database but not in schema.prisma", report.drift.columnsMissingFromSchema),
		...section("Empty tables (seed at least one realistic row)", report.emptyTables),
		...section("Nullable columns that are NULL in every row (seed a real value)", groupNullOnlyColumns(report.nullOnlyColumns)),
		...section("Stale exemptions in prisma/seed/coverage-exemptions.ts", report.staleExemptions),
		isCovered(report)
			? "Every table has rows and every nullable column holds a value."
			: "Seed coverage gaps detected — extend prisma/seed (see docs/technical/database.md → Seed coverage).",
	].join("\n");
}
