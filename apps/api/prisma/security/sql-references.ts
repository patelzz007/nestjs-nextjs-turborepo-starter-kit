/**
 * Checks the hand-written SQL of the security building blocks (generator/functions and the one-off rules of
 * generator/table-specific-rules.ts) against the Prisma schema, so a renamed table or column fails a unit test
 * instead of a production query. PostgreSQL itself only notices when a function or policy first runs.
 *
 * What it reads, in the style the building blocks are written in:
 * - `public."Table" alias` (or `public."Table" AS alias`): the table must exist;
 * - `alias."column"` and `alias.column`, `"Table"."column"`: the column must be one of that table's;
 * - a bare `"column"` in a one-off rule: one of the rule table's columns, or of a table the clause names.
 */

/** A table of the schema and every field name its model declares. */
export type SchemaColumns = ReadonlyMap<string, ReadonlySet<string>>;

/** One reference the schema does not have. */
export interface UnknownReference {
	readonly reference: string;
	readonly problem: string;
}

const MODEL_BLOCK = /\nmodel\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
const FIELD_LINE = /^\s+(\w+)\s+\w/;
const ALIASED_TABLE = /public\."(\w+)"(?:\s+AS)?\s+([a-z_][a-z0-9_]*)\b/g;
const NAMED_TABLE = /public\."(\w+)"/g;
const ALIAS_COLUMN = /\b([a-z_][a-z0-9_]*)\.(?:"(\w+)"|([a-z_][a-z0-9_]*))/g;
const TABLE_COLUMN = /"(\w+)"\."(\w+)"/g;
const BARE_QUOTED = /(?<![.\w"])"(\w+)"(?![.\w])/g;

/** Lower-case words that follow a table name but are not an alias. */
const NOT_AN_ALIAS: ReadonlySet<string> = new Set(["where", "on", "join", "inner", "left", "set", "using", "as", "for", "to", "from"]);

/** Every model of the schema, with its field names (a relation field is harmless: SQL never names it). */
export function readSchemaColumns(schema: string): SchemaColumns {
	const tables = new Map<string, ReadonlySet<string>>();
	for (const match of schema.matchAll(MODEL_BLOCK)) {
		const [, name, body] = match;
		if (name === undefined || body === undefined) {
			continue;
		}
		const fields = body
			.split("\n")
			.map((line: string): string | undefined => FIELD_LINE.exec(line)?.at(1))
			.filter((field: string | undefined): field is string => field !== undefined);
		tables.set(name, new Set(fields));
	}
	return tables;
}

/** The PostgreSQL text of the SQL with its `--` comments and '…' string literals removed (they name no columns). */
function codeOnly(sqlText: string): string {
	return sqlText.replace(/--[^\n]*/g, "").replace(/'(?:[^']|'')*'/g, "''");
}

/** Each alias of the SQL and the tables it stands for (an alias may be reused for another table elsewhere). */
function aliasesOf(code: string): ReadonlyMap<string, ReadonlySet<string>> {
	const aliases = new Map<string, Set<string>>();
	for (const match of code.matchAll(ALIASED_TABLE)) {
		const [, table, alias] = match;
		if (table === undefined || alias === undefined || NOT_AN_ALIAS.has(alias)) {
			continue;
		}
		const tables = aliases.get(alias) ?? new Set<string>();
		tables.add(table);
		aliases.set(alias, tables);
	}
	return aliases;
}

function hasColumn(columns: SchemaColumns, tables: Iterable<string>, column: string): boolean {
	return [...tables].some((table: string): boolean => columns.get(table)?.has(column) === true);
}

/**
 * The references in `sqlText` the schema does not have. `rowTable` is the table a policy's bare `"column"` refers
 * to (a one-off rule's own table); without it (a function body) bare columns are not checked.
 */
export function findUnknownReferences(sqlText: string, columns: SchemaColumns, rowTable?: string): UnknownReference[] {
	const code = codeOnly(sqlText);
	const problems: UnknownReference[] = [];
	const named = new Set<string>();
	for (const match of code.matchAll(NAMED_TABLE)) {
		const [reference, table] = match;
		if (table === undefined) {
			continue;
		}
		named.add(table);
		if (!columns.has(table)) {
			problems.push({ reference, problem: `no table ${table}` });
		}
	}
	const aliases = aliasesOf(code);
	for (const match of code.matchAll(ALIAS_COLUMN)) {
		const [reference, alias, quoted, bare] = match;
		const column = quoted ?? bare;
		const tables = alias === undefined ? undefined : aliases.get(alias);
		if (tables === undefined || column === undefined) {
			continue;
		}
		if (!hasColumn(columns, tables, column)) {
			problems.push({ reference, problem: `no column ${column} on ${[...tables].join(" or ")}` });
		}
	}
	for (const match of code.matchAll(TABLE_COLUMN)) {
		const [reference, table, column] = match;
		if (table === undefined || column === undefined || !columns.has(table)) {
			continue;
		}
		if (!hasColumn(columns, [table], column)) {
			problems.push({ reference, problem: `no column ${column} on ${table}` });
		}
	}
	if (rowTable !== undefined) {
		const inScope = [rowTable, ...named];
		for (const match of code.matchAll(BARE_QUOTED)) {
			const [reference, column] = match;
			if (column === undefined || columns.has(column)) {
				continue;
			}
			if (!hasColumn(columns, inScope, column)) {
				problems.push({ reference, problem: `no column ${column} on ${inScope.join(" or ")}` });
			}
		}
	}
	return problems;
}
