/**
 * The tag every SQL building block of the security generator is written with:
 *
 *   export const APP_OWNS = sql`CREATE OR REPLACE FUNCTION app_owns(owner_id text) …`;
 *
 * It returns the text exactly as written, so a function body reaches PostgreSQL byte for byte:
 *   - backslashes stay as typed (like `String.raw`), so `\d` in a regular expression is `\d` in the SQL;
 *   - the two escapes a template literal needs are undone: `\`` is a backtick and `\${` is `${`.
 * Its other job is the name: editors colour `sql`-tagged templates as SQL (VS Code / Cursor: the "SQL tagged
 * template literals" extension recommended in .vscode/extensions.json).
 *
 * Interpolate only values the generator controls and has validated (table and role names checked against
 * the manifest, never request data): this is code generation, not a query builder.
 */
export function sql(strings: TemplateStringsArray, ...values: readonly (string | number)[]): string {
	const raw = strings.raw.map((part: string): string => part.replaceAll("\\`", "`").replaceAll("\\${", "${"));
	return String.raw({ raw }, ...values);
}
