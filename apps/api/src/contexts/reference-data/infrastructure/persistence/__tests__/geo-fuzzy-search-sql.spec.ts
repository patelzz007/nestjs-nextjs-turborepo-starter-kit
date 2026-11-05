import { describe, expect, it } from "vitest";

import { GEO_TABLE_SQL, substringSearchSql, trigramSearchSql, type GeoTable } from "../prisma-geography.read-repository";

const TABLES: readonly GeoTable[] = ["Region", "Subregion", "Country", "State", "City"];
const HOSTILE = `x'; DROP TABLE "User"; --`;

describe("the geo fuzzy search SQL", () => {
	it("names only the five geo tables, each a fixed quoted identifier", () => {
		expect(Object.keys(GEO_TABLE_SQL).sort()).toStrictEqual([...TABLES].sort());
		for (const table of TABLES) {
			expect(GEO_TABLE_SQL[table].sql).toBe(`"${table}"`);
			expect(GEO_TABLE_SQL[table].values).toStrictEqual([]);
		}
	});

	it("binds the search term and the limit as parameters, never as SQL text", () => {
		for (const build of [trigramSearchSql, substringSearchSql]) {
			const query = build("City", HOSTILE, 25);
			expect(query.sql).not.toContain("DROP TABLE");
			expect(query.sql).toContain('FROM "City"');
			expect(query.values).toContain(25);
			expect(query.values.map(String).some((value) => value.includes(HOSTILE))).toBe(true);
		}
	});
});
