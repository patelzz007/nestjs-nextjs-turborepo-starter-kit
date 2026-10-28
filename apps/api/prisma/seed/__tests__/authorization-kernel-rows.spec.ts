import { DAY_MS } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { buildKernelSeedRows, KERNEL_SEED_IDS } from "../authorization-kernel-rows";
import { TENANT_SEED_IDS } from "../tenant-seed-ids";
import { REWARD_SEED_IDS } from "../rewards";

const NOW = 1_800_000_000_000;
const ACTORS = { adminUserId: "admin", managerUserId: "manager", userRoleId: "user-role", managerRoleId: "manager-role" };
const rows = buildKernelSeedRows(ACTORS, NOW);

/** The nullable columns the seed must fill in at least one row (every column seeded). */
const OPTIONAL_COLUMNS: readonly ("scope" | "tenantId" | "locationId" | "expiresAt" | "reason" | "assignedBy")[] = [
	"scope",
	"tenantId",
	"locationId",
	"expiresAt",
	"reason",
	"assignedBy",
];

describe("buildKernelSeedRows", () => {
	it("is deterministic, so a re-seed upserts the same rows instead of adding new ones", () => {
		const again = buildKernelSeedRows(ACTORS, NOW);
		expect(again.acls.map((row) => row.id)).toEqual(rows.acls.map((row) => row.id));
		expect(new Set(rows.acls.map((row) => row.id)).size).toBe(rows.acls.length);
	});

	it("binds the product row to its tenant, store and product, and keeps one retired row", () => {
		expect(rows.acls.find((row) => row.id === KERNEL_SEED_IDS.productScopedAcl)).toMatchObject({
			subjectId: REWARD_SEED_IDS.mlkCashierUser,
			resourceId: KERNEL_SEED_IDS.productTarget,
			tenantId: TENANT_SEED_IDS.mlkTenant,
			locationId: TENANT_SEED_IDS.mlkLocationBeruang,
		});
		const retired = rows.acls.find((row) => row.id === KERNEL_SEED_IDS.retiredAcl);
		expect(retired?.isDeleted).toBe(true);
		expect(retired?.deletedAt).toBe(NOW - 7 * DAY_MS);
	});

	it("covers every optional column at least once: scope, tenant, store, expiry, reason and assigner", () => {
		for (const column of OPTIONAL_COLUMNS) {
			expect(
				rows.acls.some((row) => row[column] !== undefined && row[column] !== null),
				column,
			).toBe(true);
		}
	});
});
