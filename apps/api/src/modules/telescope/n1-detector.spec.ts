import { describe, expect, it } from "vitest";

import type { QueryLogEntry } from "@workspace/shared";

import { detectN1Warnings, modelFromSql, N1_THRESHOLD } from "./n1-detector";

function makeQuery(overrides: Partial<QueryLogEntry>): QueryLogEntry {
	return {
		id: `q-${overrides.durationMs ?? 0}-${Math.random()}`,
		correlationId: "corr-1",
		model: "Order",
		operation: "findMany",
		query: "SELECT * FROM orders",
		params: null,
		durationMs: 4,
		createdAt: 1786528800000,
		...overrides,
	};
}

describe("modelFromSql", () => {
	it("extracts the first referenced table from a SELECT", () => {
		expect(modelFromSql('SELECT id, name FROM "User" WHERE id = $1')).toBe("User");
	});

	it("extracts the table from INSERT / UPDATE / DELETE", () => {
		expect(modelFromSql('INSERT INTO "Order" (id) VALUES ($1)')).toBe("Order");
		expect(modelFromSql('UPDATE "Session" SET token = $1 WHERE id = $2')).toBe("Session");
		expect(modelFromSql('DELETE FROM "Click" WHERE id = $1')).toBe("Click");
	});

	it("returns an empty string for ambiguous SQL", () => {
		expect(modelFromSql("BEGIN")).toBe("");
	});
});

describe("detectN1Warnings", () => {
	it("flags a model+operation repeated at least N1_THRESHOLD times", () => {
		const queries: readonly QueryLogEntry[] = Array.from({ length: N1_THRESHOLD + 1 }, (): QueryLogEntry => makeQuery({ model: "User", operation: "findUnique", durationMs: 3 }));
		const warnings = detectN1Warnings(queries);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]?.model).toBe("User");
		expect(warnings[0]?.operation).toBe("findUnique");
		expect(warnings[0]?.count).toBe(N1_THRESHOLD + 1);
		expect(warnings[0]?.totalMs).toBe((N1_THRESHOLD + 1) * 3);
	});

	it("ignores small counts below the threshold", () => {
		const queries: readonly QueryLogEntry[] = [makeQuery({}), makeQuery({}), makeQuery({})];
		expect(detectN1Warnings(queries)).toHaveLength(0);
	});

	it("groups by operation+model, not by query shape alone", () => {
		const queries: readonly QueryLogEntry[] = [
			...Array.from({ length: N1_THRESHOLD }, (): QueryLogEntry => makeQuery({ model: "User", operation: "findUnique", durationMs: 2 })),
			...Array.from({ length: N1_THRESHOLD }, (): QueryLogEntry => makeQuery({ model: "Order", operation: "findMany", durationMs: 10 })),
		];
		const warnings = detectN1Warnings(queries);
		expect(warnings).toHaveLength(2);
		// Sorted by totalMs descending → Order (10×5=50) before User (2×5=10).
		expect(warnings[0]?.model).toBe("Order");
		expect(warnings[1]?.model).toBe("User");
	});

	it("returns an empty list for no queries", () => {
		expect(detectN1Warnings([])).toHaveLength(0);
	});
});
