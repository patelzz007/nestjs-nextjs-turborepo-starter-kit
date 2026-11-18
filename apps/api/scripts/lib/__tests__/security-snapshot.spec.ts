import { describe, expect, it } from "vitest";

import {
	diffSnapshots,
	formatDifferences,
	normalizeRow,
	normalizeSection,
	parseSnapshot,
	parseSnapshotOptions,
	rowKey,
	serializeSnapshot,
	SNAPSHOT_QUERIES,
	sqlFilesOfListing,
	type SecuritySnapshot,
	type SnapshotOptions,
	type SnapshotQuery,
	type SnapshotRow,
} from "../security-snapshot";

const POLICIES: SnapshotQuery = { section: "policies", key: ["table", "name"], sql: "" };

function snapshot(policies: SnapshotRow[]): SecuritySnapshot {
	return { policies };
}

describe("security snapshot", () => {
	it("reads every section that decides who may touch what", () => {
		expect(SNAPSHOT_QUERIES.map((query) => query.section)).toStrictEqual([
			"policies",
			"functions",
			"triggers",
			"relations",
			"columnPrivileges",
			"schema",
			"defaultPrivileges",
			"roles",
			"memberships",
		]);
	});

	it("sorts a row's columns and its arrays, so the catalog's listing order never shows up as a difference", () => {
		expect(normalizeRow({ roles: ["b", "a"], name: "p" })).toStrictEqual({ name: "p", roles: ["a", "b"] });
		expect(JSON.stringify(normalizeRow({ b: "1", a: "2" }))).toBe('{"a":"2","b":"1"}');
	});

	it("sorts a section by its key and rejects a value the catalog never returns", () => {
		const rows = normalizeSection(POLICIES, [
			{ table: "B", name: "x" },
			{ table: "A", name: "y" },
		]);
		expect(rows.map((row) => rowKey(row, POLICIES.key))).toStrictEqual(["A · y", "B · x"]);
		expect((): SnapshotRow[] => normalizeSection(POLICIES, [{ table: "A", name: { nested: true } }])).toThrow();
	});

	it("reports nothing for identical snapshots", () => {
		const same = snapshot([{ table: "A", name: "p", using: "true" }]);
		expect(diffSnapshots(same, same, [POLICIES])).toStrictEqual([]);
		expect(formatDifferences([])).toMatch(/^Identical/u);
	});

	it("reports a missing, an unexpected and a changed row, naming the changed column", () => {
		const before = snapshot([
			{ table: "A", name: "gone", using: "true" },
			{ table: "A", name: "kept", using: 'app_owns("userId")' },
		]);
		const after = snapshot([
			{ table: "A", name: "kept", using: "true" },
			{ table: "A", name: "new", using: "true" },
		]);
		const differences = diffSnapshots(before, after, [POLICIES]);
		expect(differences).toHaveLength(1);
		const report = formatDifferences(differences);
		expect(report).toContain("- missing: A · gone");
		expect(report).toContain("+ unexpected: A · new");
		expect(report).toContain("~ changed: A · kept");
		expect(report).toContain('using: "app_owns(\\"userId\\")" → "true"');
	});

	it("round-trips through JSON", () => {
		const value = snapshot([{ table: "A", name: "p", roles: ["public"], permissive: "PERMISSIVE", using: null }]);
		expect(parseSnapshot(serializeSnapshot(value))).toStrictEqual(value);
		expect(serializeSnapshot(value).endsWith("\n")).toBe(true);
	});

	it("parses its options and requires --out", () => {
		expect(parseSnapshotOptions(["--out", "a.json", "--compare", "b.json", "--upgrade-from", "HEAD"])).toStrictEqual({
			out: "a.json",
			compare: "b.json",
			upgradeFrom: "HEAD",
		});
		expect(parseSnapshotOptions(["--out", "a.json"])).toStrictEqual({ out: "a.json", compare: undefined, upgradeFrom: undefined });
		expect((): SnapshotOptions => parseSnapshotOptions(["--compare", "b.json"])).toThrow(/Usage/u);
		expect((): SnapshotOptions => parseSnapshotOptions(["--out", "--compare"])).toThrow(/Usage/u);
	});

	it("takes the .sql files of a git listing in name order (the old apply order)", () => {
		expect(sqlFilesOfListing("prisma/rls/10-policies.sql\nprisma/rls/README.md\nprisma/rls/00-app-helpers.sql\n")).toStrictEqual([
			"prisma/rls/00-app-helpers.sql",
			"prisma/rls/10-policies.sql",
		]);
	});
});
