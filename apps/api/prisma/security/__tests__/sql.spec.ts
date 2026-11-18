import { describe, expect, it } from "vitest";

import { sql } from "../sql";

describe("the sql tag", () => {
	it("returns the text exactly as written, values included", () => {
		const table = "Note";
		expect(sql`SELECT 1 FROM public."${table}" WHERE id = $1;`).toBe('SELECT 1 FROM public."Note" WHERE id = $1;');
	});

	it("keeps backslashes as typed, so a regular expression reaches PostgreSQL unchanged", () => {
		expect(sql`SELECT 'a1' ~ '^[a-z]\d$';`).toBe("SELECT 'a1' ~ '^[a-z]\\d$';");
	});

	it("undoes the escapes a template literal needs: a backtick and a dollar-brace", () => {
		expect(sql`-- see \`permissionSatisfies\` and \${x}`).toBe("-- see `permissionSatisfies` and ${x}");
	});

	it("keeps dollar-quoted bodies", () => {
		expect(sql`AS $$ SELECT 1 $$;`).toBe("AS $$ SELECT 1 $$;");
	});
});
