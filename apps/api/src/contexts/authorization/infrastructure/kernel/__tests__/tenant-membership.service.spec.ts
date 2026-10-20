import { beforeEach, describe, expect, it, vi } from "vitest";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../../../prisma/prisma.service";
import type { SystemDatabaseContext } from "../../../../../prisma/tenant-context";
import { TenantMembershipService } from "../tenant-membership.service";
import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";

const mocks = vi.hoisted(() => ({
	membershipFindFirst: vi.fn(),
	supportGrantFindFirst: vi.fn(),
	locationFindFirst: vi.fn(),
	storeFindFirst: vi.fn(),
	storeMembershipFindFirst: vi.fn(),
	tenantFindFirst: vi.fn(),
}));

vi.mock("../../../../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly membership = { findFirst: mocks.membershipFindFirst };
		public readonly supportAccessGrant = { findFirst: mocks.supportGrantFindFirst };
		public readonly location = { findFirst: mocks.locationFindFirst };
		public readonly store = { findFirst: mocks.storeFindFirst };
		public readonly storeMembership = { findFirst: mocks.storeMembershipFindFirst };
		public readonly tenant = { findFirst: mocks.tenantFindFirst };
	},
}));

/** Live tenants and their lifecycle state. */
const tenants: Record<string, string> = { "org-a": "ACTIVE", "org-b": "ACTIVE" };

const locations: Readonly<Record<string, string>> = { "loc-a1": "org-a", "loc-a2": "org-a", "loc-b1": "org-b" };
const stores: Readonly<Record<string, { readonly id: string; readonly tenantId: string; readonly locationId: string }>> = {
	"store-a1": { id: "store-a1", tenantId: "org-a", locationId: "loc-a1" },
	"store-a2": { id: "store-a2", tenantId: "org-a", locationId: "loc-a2" },
	"store-b1": { id: "store-b1", tenantId: "org-b", locationId: "loc-b1" },
};

const service = (): TenantMembershipService => {
	const prisma = new PrismaService(createTestTypedConfig());
	return new TenantMembershipService({
		withSystemOperation: <TResult>(_context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> => work(prisma),
	});
};

describe("TenantMembershipService.verify", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.locationFindFirst.mockImplementation(({ where }: { where: { id: string } }) => {
			const tenantId = locations[where.id];
			return Promise.resolve(tenantId === undefined ? null : { tenantId });
		});
		mocks.storeFindFirst.mockImplementation(({ where }: { where: { id: string } }) => Promise.resolve(stores[where.id] ?? null));
		mocks.storeMembershipFindFirst.mockResolvedValue(null);
		mocks.supportGrantFindFirst.mockResolvedValue(null);
		tenants["org-a"] = "ACTIVE";
		mocks.tenantFindFirst.mockImplementation(({ where }: { where: { id: string } }) => {
			const lifecycleState = tenants[where.id];
			return Promise.resolve(lifecycleState === undefined ? null : { lifecycleState });
		});
	});

	it("returns an empty context when nothing is requested", async () => {
		const result = await service().verify("user-1", {});

		expect(result).toEqual({ context: {}, target: null, tenantRejected: false, storeRejected: false, locationRejected: false });
		expect(mocks.membershipFindFirst).not.toHaveBeenCalled();
	});

	it("rejects a tenant without an active membership (forged tenantId)", async () => {
		mocks.membershipFindFirst.mockResolvedValue(null);

		const result = await service().verify("user-1", { tenantId: "org-b" });

		expect(result.tenantRejected).toBe(true);
		expect(result.context).toEqual({});
		expect(mocks.membershipFindFirst.mock.lastCall?.[LIST_SLOT_INDEX.first]).toMatchObject({
			where: { userId: "user-1", tenantId: "org-b", isDeleted: false },
		});
	});

	it("accepts an approved unexpired support grant when the user has no membership", async () => {
		mocks.membershipFindFirst.mockResolvedValue(null);
		mocks.supportGrantFindFirst.mockResolvedValue({ id: "grant-1" });

		const result = await service().verify("user-1", { tenantId: "org-b" });

		expect(result.tenantRejected).toBe(false);
		expect(result.context).toEqual({ tenantId: "org-b" });
		expect(result.supportAccessGrantId).toBe("grant-1");
		expect(result.target).toEqual({ tenantId: "org-b", lifecycleState: "ACTIVE", membershipStatus: "ACTIVE" });
	});

	it("MT-005: a suspended membership is inactive and grants no tenant", async () => {
		mocks.membershipFindFirst.mockResolvedValue({ status: "SUSPENDED", locationScopes: [] });

		const result = await service().verify("user-1", { tenantId: "org-a" });

		expect(result).toEqual({
			context: {},
			target: { tenantId: "org-a", lifecycleState: "ACTIVE", membershipStatus: "SUSPENDED" },
			tenantRejected: true,
			storeRejected: false,
			locationRejected: false,
		});
	});

	it("reports the lifecycle of a tenant reached only through a store, so a suspended tenant is not served (C1)", async () => {
		tenants["org-a"] = "SUSPENDED";
		mocks.membershipFindFirst.mockResolvedValue({ status: "ACTIVE", locationScopes: [{ scopeType: "ALL_LOCATIONS", locationId: null }] });

		const result = await service().verify("user-1", { storeId: "store-a1" });

		expect(result.context).toEqual({ tenantId: "org-a", storeId: "store-a1" });
		expect(result.target).toEqual({ tenantId: "org-a", lifecycleState: "SUSPENDED", membershipStatus: "ACTIVE" });
	});

	it("rejects a tenant that is no longer live (soft-deleted), with no target", async () => {
		mocks.membershipFindFirst.mockResolvedValue({ status: "ACTIVE", locationScopes: [] });

		const result = await service().verify("user-1", { tenantId: "org-gone" });

		expect(result).toMatchObject({ context: {}, target: null, tenantRejected: true });
	});

	it("verifies an active membership", async () => {
		mocks.membershipFindFirst.mockResolvedValue({ status: "ACTIVE", locationScopes: [] });

		expect((await service().verify("user-1", { tenantId: "org-a" })).context).toEqual({ tenantId: "org-a" });
	});

	describe("locations", () => {
		it("accepts locations covered by an ALL_LOCATIONS or SELECTED scope", async () => {
			mocks.membershipFindFirst.mockResolvedValue({ status: "ACTIVE", locationScopes: [{ scopeType: "ALL_LOCATIONS", locationId: null }] });
			expect((await service().verify("user-1", { tenantId: "org-a", locationId: "loc-a2" })).context).toEqual({ tenantId: "org-a", locationId: "loc-a2" });

			mocks.membershipFindFirst.mockResolvedValue({ status: "ACTIVE", locationScopes: [{ scopeType: "SELECTED", locationId: "loc-a1" }] });
			expect((await service().verify("user-1", { tenantId: "org-a", locationId: "loc-a1" })).context).toEqual({ tenantId: "org-a", locationId: "loc-a1" });
		});

		it("rejects a location outside the SELECTED scope (forged locationId)", async () => {
			mocks.membershipFindFirst.mockResolvedValue({ status: "ACTIVE", locationScopes: [{ scopeType: "SELECTED", locationId: "loc-a1" }] });

			const result = await service().verify("user-1", { tenantId: "org-a", locationId: "loc-a2" });

			expect(result).toEqual({
				context: { tenantId: "org-a" },
				target: { tenantId: "org-a", lifecycleState: "ACTIVE", membershipStatus: "ACTIVE" },
				tenantRejected: false,
				storeRejected: false,
				locationRejected: true,
			});
		});

		it("rejects a location owned by another tenant even with ALL_LOCATIONS", async () => {
			mocks.membershipFindFirst.mockResolvedValue({ status: "ACTIVE", locationScopes: [{ scopeType: "ALL_LOCATIONS", locationId: null }] });

			expect((await service().verify("user-1", { tenantId: "org-a", locationId: "loc-b1" })).locationRejected).toBe(true);
		});

		it("never implies location access from a membership without scope rows", async () => {
			mocks.membershipFindFirst.mockResolvedValue({ status: "ACTIVE", locationScopes: [] });

			expect((await service().verify("user-1", { tenantId: "org-a", locationId: "loc-a1" })).locationRejected).toBe(true);
		});

		it("derives the tenant from a location when only the location is requested", async () => {
			mocks.membershipFindFirst.mockResolvedValue({ status: "ACTIVE", locationScopes: [{ scopeType: "ALL_LOCATIONS", locationId: null }] });

			expect((await service().verify("user-1", { locationId: "loc-a1" })).context).toEqual({ tenantId: "org-a", locationId: "loc-a1" });
		});

		it("rejects an unknown location", async () => {
			const result = await service().verify("user-1", { locationId: "loc-missing" });

			expect(result).toEqual({ context: {}, target: null, tenantRejected: false, storeRejected: false, locationRejected: true });
		});
	});

	describe("stores", () => {
		it("accepts a store through an active store membership, even without a tenant membership", async () => {
			mocks.membershipFindFirst.mockResolvedValue(null);
			mocks.storeMembershipFindFirst.mockResolvedValue({ id: "sm-1" });

			const result = await service().verify("user-1", { storeId: "store-a1" });

			expect(result.context).toEqual({ tenantId: "org-a", storeId: "store-a1" });
		});

		it("accepts a store covered by the tenant membership location scope", async () => {
			mocks.membershipFindFirst.mockResolvedValue({ status: "ACTIVE", locationScopes: [{ scopeType: "SELECTED", locationId: "loc-a2" }] });

			expect((await service().verify("user-1", { tenantId: "org-a", storeId: "store-a2" })).context).toEqual({ tenantId: "org-a", storeId: "store-a2" });
		});

		it("rejects a store outside the member's scope (forged storeId)", async () => {
			mocks.membershipFindFirst.mockResolvedValue({ status: "ACTIVE", locationScopes: [{ scopeType: "SELECTED", locationId: "loc-a1" }] });

			const result = await service().verify("user-1", { tenantId: "org-a", storeId: "store-a2" });

			expect(result.storeRejected).toBe(true);
			expect(result.context).toEqual({ tenantId: "org-a" });
		});

		it("rejects a store belonging to another tenant", async () => {
			mocks.membershipFindFirst.mockResolvedValue({ status: "ACTIVE", locationScopes: [{ scopeType: "ALL_LOCATIONS", locationId: null }] });

			expect((await service().verify("user-1", { tenantId: "org-a", storeId: "store-b1" })).storeRejected).toBe(true);
		});

		it("rejects an unknown or inactive store", async () => {
			const result = await service().verify("user-1", { storeId: "store-missing" });

			expect(result).toEqual({ context: {}, target: null, tenantRejected: false, storeRejected: true, locationRejected: false });
			expect(mocks.storeFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "store-missing", isDeleted: false, status: "ACTIVE" } }));
		});

		it("rejects a store member claiming another tenant", async () => {
			mocks.membershipFindFirst.mockResolvedValue(null);
			mocks.storeMembershipFindFirst.mockResolvedValue({ id: "sm-1" });

			expect((await service().verify("user-1", { tenantId: "org-b", storeId: "store-a1" })).tenantRejected).toBe(true);
		});
	});
});
