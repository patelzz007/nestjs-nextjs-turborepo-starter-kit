import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** The committed migrations, replayed in name (= timestamp) order. */
const MIGRATIONS_DIR: string = resolve(import.meta.dirname, "..", "..", "..", "..", "..", "prisma", "migrations");

const CREATE_UNIQUE_INDEX = /^CREATE UNIQUE INDEX (?:IF NOT EXISTS )?"(?<name>[^"]+)" ON (?:"?public"?\.)?"(?<table>[^"]+)"/;
const DROP_INDEX = /^DROP INDEX (?:IF EXISTS )?(?:"?public"?\.)?"(?<name>[^"]+)"/;
const DROP_TABLE = /^DROP TABLE (?:IF EXISTS )?(?:"?public"?\.)?"(?<table>[^"]+)"/;
const SQL_LINE_COMMENT = /--[^\n]*/g;

/**
 * The unique index names the committed migrations leave in place (an index goes with `DROP INDEX` or with its
 * table's `DROP TABLE`). Code that maps a unique violation to a domain error by index name
 * (`isUniqueViolationOf`) asserts its constant is in this set, so renaming an index — as the camelCase
 * migration did — fails a unit test instead of silently degrading to a generic 409.
 */
export function committedUniqueIndexNames(): ReadonlySet<string> {
	const tableOf = new Map<string, string>();
	const migrations: string[] = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
		.filter((entry): boolean => entry.isDirectory())
		.map((entry): string => entry.name)
		.sort((a: string, b: string): number => a.localeCompare(b));
	for (const migration of migrations) {
		const statements: string[] = readFileSync(join(MIGRATIONS_DIR, migration, "migration.sql"), "utf8")
			.replace(SQL_LINE_COMMENT, "")
			.split(";")
			.map((statement: string): string => statement.trim());
		for (const statement of statements) {
			const created = CREATE_UNIQUE_INDEX.exec(statement)?.groups;
			if (created?.name !== undefined && created.table !== undefined) {
				tableOf.set(created.name, created.table);
				continue;
			}
			const droppedIndex = DROP_INDEX.exec(statement)?.groups?.name;
			if (droppedIndex !== undefined) {
				tableOf.delete(droppedIndex);
				continue;
			}
			const droppedTable = DROP_TABLE.exec(statement)?.groups?.table;
			if (droppedTable !== undefined) {
				for (const [name, table] of tableOf) {
					if (table === droppedTable) {
						tableOf.delete(name);
					}
				}
			}
		}
	}
	return new Set(tableOf.keys());
}
