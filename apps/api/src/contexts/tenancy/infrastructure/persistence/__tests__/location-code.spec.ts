import { describe, expect, it } from "vitest";

import { allocateUniqueLocationCode, slugifyLocationName } from "../location-code";

const TENANT = "tenant-1";

interface StoreRow {
	readonly tenantId: string;
	readonly code: string;
	readonly isDeleted: boolean;
}

/** The stores of a tenant, answering the allocator's lookup the way PostgreSQL would. */
function storesOf(rows: readonly StoreRow[]): Parameters<typeof allocateUniqueLocationCode>[0] {
	return {
		location: {
			findFirst: ({ where }): Promise<{ id: string } | null> => {
				const row = rows.find((candidate) => candidate.tenantId === where.tenantId && candidate.code === where.code && candidate.isDeleted === where.isDeleted);
				return Promise.resolve(row === undefined ? null : { id: `${row.tenantId}/${row.code}` });
			},
		},
	};
}

describe("allocateUniqueLocationCode", () => {
	it("reuses a deleted store's code, since codes are unique among live stores only", async () => {
		const stores = storesOf([{ tenantId: TENANT, code: "bukit-bintang", isDeleted: true }]);
		await expect(allocateUniqueLocationCode(stores, TENANT, "Bukit Bintang")).resolves.toBe("bukit-bintang");
	});

	it("skips codes live stores use, numbering from 2", async () => {
		const stores = storesOf([
			{ tenantId: TENANT, code: "bukit-bintang", isDeleted: false },
			{ tenantId: TENANT, code: "bukit-bintang-2", isDeleted: false },
			{ tenantId: "other-tenant", code: "bukit-bintang-3", isDeleted: false },
		]);
		await expect(allocateUniqueLocationCode(stores, TENANT, "Bukit Bintang")).resolves.toBe("bukit-bintang-3");
	});
});

describe("slugifyLocationName", () => {
	it('makes a URL-safe code, and falls back to "store" for a name with no letters or digits', () => {
		expect(slugifyLocationName("  Brew & Bean — KLCC  ")).toBe("brew-bean-klcc");
		expect(slugifyLocationName("!!!")).toBe("store");
	});
});
