import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseMigrationBaseline } from "./migration-baseline.mjs";
import { BASELINE_MARKER_LABEL, checkMigrationHistory, parseNameStatus } from "./migration-history.mjs";

const INIT = "20260101000000_init";
const ORDERS = "20260301120000_add_orders";
const BASE = [INIT, ORDERS];

function marker(baseline) {
	return { baseline, reason: "fresh baseline before first deploy", since: "2026-10-03" };
}

/** Runs the check with no baseline at either side unless given. */
function check({ changes, baseDirectories = BASE, headDirectories, baseBaseline = null, headBaseline = null }) {
	const added = changes.filter((change) => change.status === "A").map((change) => change.path.split("/")[0]);
	return checkMigrationHistory({
		baseDirectories,
		headDirectories: headDirectories ?? [...new Set([...baseDirectories, ...added])],
		changes,
		baseBaseline,
		headBaseline,
	});
}

function violationsFor(changes) {
	return check({ changes }).violations;
}

describe("checkMigrationHistory — immutable history (no baseline)", () => {
	it("accepts a new, newer migration directory", () => {
		expect(violationsFor([{ status: "A", path: "20260401000000_add_refunds/migration.sql" }])).toEqual([]);
	});

	it("accepts no changes at all", () => {
		expect(check({ changes: [] })).toEqual({ violations: [], notices: [] });
	});

	it.each([
		["modified", "M", "committed migration modified"],
		["type-changed", "T", "committed migration changed (git status T)"],
	])("rejects a %s committed migration", (_case, status, reason) => {
		expect(violationsFor([{ status, path: `${INIT}/migration.sql` }])).toEqual([{ path: `${INIT}/migration.sql`, reason }]);
	});

	it("rejects a deleted committed migration and points at the baseline procedure", () => {
		expect(violationsFor([{ status: "D", path: `${INIT}/migration.sql` }])).toEqual([
			{ path: `${INIT}/migration.sql`, reason: expect.stringContaining("committed migration deleted (history can only be dropped by moving the baseline forward") },
		]);
	});

	it("rejects a file added to a committed migration", () => {
		expect(violationsFor([{ status: "A", path: `${ORDERS}/extra.sql` }])).toEqual([{ path: `${ORDERS}/extra.sql`, reason: "file added to an already committed migration" }]);
	});

	it("rejects a change to migration_lock.toml", () => {
		expect(violationsFor([{ status: "M", path: "migration_lock.toml" }])).toHaveLength(1);
	});

	it("rejects a new migration that sorts before the latest committed one", () => {
		expect(violationsFor([{ status: "A", path: "20260201000000_backdated/migration.sql" }])).toEqual([
			expect.objectContaining({ path: "20260201000000_backdated", reason: expect.stringContaining("forward-only") }),
		]);
	});

	it("rejects two new migrations sharing a timestamp prefix", () => {
		const violations = violationsFor([
			{ status: "A", path: "20260401000000_a/migration.sql" },
			{ status: "A", path: "20260401000000_b/migration.sql" },
		]);
		expect(violations).toEqual([{ path: "20260401000000_b", reason: "timestamp prefix 20260401000000 is already used by 20260401000000_a" }]);
	});

	it("rejects a badly named new migration", () => {
		expect(violationsFor([{ status: "A", path: "add_refunds/migration.sql" }])).toEqual([
			expect.objectContaining({ path: "add_refunds", reason: expect.stringContaining("14-digit") }),
		]);
	});
});

describe("checkMigrationHistory — explicit baseline", () => {
	it("ignores any change to migrations older than an unchanged baseline", () => {
		const result = check({ changes: [{ status: "M", path: `${INIT}/migration.sql` }], baseBaseline: marker(ORDERS), headBaseline: marker(ORDERS) });
		expect(result).toEqual({ violations: [], notices: [] });
	});

	it("keeps the baseline itself and everything after it immutable", () => {
		const result = check({ changes: [{ status: "M", path: `${ORDERS}/migration.sql` }], baseBaseline: marker(ORDERS), headBaseline: marker(ORDERS) });
		expect(result.violations).toEqual([{ path: `${ORDERS}/migration.sql`, reason: "committed migration modified" }]);
	});

	it("allows deleting migrations older than the new baseline in the diff that moves it, with a notice", () => {
		const result = check({
			changes: [{ status: "D", path: `${INIT}/migration.sql` }],
			headDirectories: [ORDERS],
			baseBaseline: marker(INIT),
			headBaseline: marker(ORDERS),
		});
		expect(result.violations).toEqual([]);
		expect(result.notices).toEqual([expect.stringContaining(`MIGRATION BASELINE MOVED: ${INIT} → ${ORDERS}`)]);
		expect(result.notices[0]).toContain(`History dropped in this change: ${INIT}`);
	});

	it("rejects deleting the baseline migration itself (the marker would then name nothing)", () => {
		const result = check({ changes: [{ status: "D", path: `${INIT}/migration.sql` }], headDirectories: [ORDERS], baseBaseline: marker(INIT), headBaseline: marker(INIT) });
		expect(result.violations).toEqual([
			{ path: BASELINE_MARKER_LABEL, reason: `baseline ${INIT} is not an existing migration directory` },
			expect.objectContaining({ path: `${INIT}/migration.sql`, reason: expect.stringContaining("committed migration deleted") }),
		]);
	});

	it("rejects editing (rather than deleting) a migration the moved baseline drops", () => {
		const result = check({ changes: [{ status: "M", path: `${INIT}/migration.sql` }], baseBaseline: marker(INIT), headBaseline: marker(ORDERS) });
		expect(result.violations).toEqual([{ path: `${INIT}/migration.sql`, reason: "a migration dropped by moving the baseline may only be deleted, never edited" }]);
	});

	it("rejects a baseline that names no existing migration", () => {
		const result = check({ changes: [], baseBaseline: null, headBaseline: marker("20260501000000_missing") });
		expect(result.violations).toEqual([{ path: BASELINE_MARKER_LABEL, reason: "baseline 20260501000000_missing is not an existing migration directory" }]);
	});

	it("rejects moving the baseline backwards", () => {
		const result = check({ changes: [], baseBaseline: marker(ORDERS), headBaseline: marker(INIT) });
		expect(result.violations).toEqual([{ path: BASELINE_MARKER_LABEL, reason: expect.stringContaining("moved backwards") }]);
	});

	it("rejects removing the baseline marker", () => {
		const result = check({ changes: [], baseBaseline: marker(ORDERS), headBaseline: null });
		expect(result.violations).toEqual([{ path: BASELINE_MARKER_LABEL, reason: expect.stringContaining("marker was removed") }]);
	});

	it("rejects a new migration older than the baseline", () => {
		const result = check({ changes: [{ status: "A", path: "20260201000000_old/migration.sql" }], baseBaseline: marker(ORDERS), headBaseline: marker(ORDERS) });
		expect(result.violations).toEqual(
			expect.arrayContaining([expect.objectContaining({ path: "20260201000000_old", reason: expect.stringContaining("older than the baseline") })]),
		);
	});

	describe("the repository's own baseline reset (old init deleted, fresh baseline added)", () => {
		const OLD_INIT = "20261002055618_init";
		const NEW_INIT = "20261003111645_init";
		const resetChanges = [
			{ status: "D", path: `${OLD_INIT}/migration.sql` },
			{ status: "A", path: `${NEW_INIT}/migration.sql` },
		];

		it("passes with the baseline marker naming the new init, and says so", () => {
			const result = check({ changes: resetChanges, baseDirectories: [OLD_INIT], headDirectories: [NEW_INIT], headBaseline: marker(NEW_INIT) });
			expect(result.violations).toEqual([]);
			expect(result.notices).toEqual([expect.stringContaining(`(no baseline) → ${NEW_INIT}`)]);
		});

		it("fails without the marker", () => {
			const result = check({ changes: resetChanges, baseDirectories: [OLD_INIT], headDirectories: [NEW_INIT] });
			expect(result.violations).toEqual([expect.objectContaining({ path: `${OLD_INIT}/migration.sql`, reason: expect.stringContaining("committed migration deleted") })]);
		});

		it("the checked-in marker is valid and names a migration directory that exists", () => {
			const prismaDirectory = path.resolve(import.meta.dirname, "../../../../apps/api/prisma");
			const text = readFileSync(path.join(prismaDirectory, "migrations-baseline.json"), "utf8");
			const baseline = parseMigrationBaseline(text, "migrations-baseline.json")?.baseline;
			expect(baseline).toBeDefined();
			expect(existsSync(path.join(prismaDirectory, "migrations", String(baseline), "migration.sql"))).toBe(true);
		});
	});
});

describe("parseMigrationBaseline", () => {
	it("treats a missing file as no baseline", () => {
		expect(parseMigrationBaseline(null, "x")).toBeNull();
	});

	it.each([
		["invalid JSON", "{", /not valid JSON/],
		["a non-migration name", JSON.stringify({ ...marker("init"), baseline: "init" }), /baseline: must be a migration directory name/],
		["an empty reason", JSON.stringify({ ...marker(INIT), reason: " " }), /reason: must say why/],
		["a non-ISO date", JSON.stringify({ ...marker(INIT), since: "03/10/2026" }), /since: must be an ISO date/],
		["an unknown key", JSON.stringify({ ...marker(INIT), extra: true }), /invalid/],
	])("rejects %s", (_case, text, expected) => {
		expect(() => parseMigrationBaseline(text, "marker")).toThrow(expected);
	});
});

describe("parseNameStatus", () => {
	it("keeps only paths under the migrations prefix, relative to it", () => {
		const output = ["M\tapps/api/prisma/migrations/20260101000000_init/migration.sql", "A\tapps/api/src/x.ts", "D\tapps/api/prisma/migrations/migration_lock.toml", ""].join(
			"\n",
		);
		expect(parseNameStatus(output, "apps/api/prisma/migrations/")).toEqual([
			{ status: "M", path: "20260101000000_init/migration.sql" },
			{ status: "D", path: "migration_lock.toml" },
		]);
	});
});
