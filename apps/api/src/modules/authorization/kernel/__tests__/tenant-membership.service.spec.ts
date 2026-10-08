import { beforeEach, describe, expect, it, vi } from "vitest";
import { LIST_SLOT_INDEX } from "@workspace/shared";

import { PrismaService } from "../../../../prisma/prisma.service";
import { TenantMembershipService } from "../tenant-membership.service";
import { createTestTypedConfig } from "../../../../../test/support/test-api-env";

const mocks = vi.hoisted(() => ({
	membershipFindFirst: vi.fn(),
	locationFindFirst: vi.fn(),
	storeFindFirst: vi.fn(),
	storeMembershipFindFirst: vi.fn(),
}));

vi.mock("../../../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly organizationMembership = { findFirst: mocks.membershipFindFirst };
		public readonly organizationLocation = { findFirst: mocks.locationFindFirst };
		public readonly store = { findFirst: mocks.storeFindFirst };
		public readonly storeMembership = { findFirst: mocks.storeMembershipFindFirst };
	},
}));

const locations: Readonly<Record<string, string>> = { "loc-a1": "org-a", "loc-a2": "org-a", "loc-b1": "org-b" };
const stores: Readonly<Record<string, { readonly id: string; readonly organizationId: string; readonly locationId: string }>> = {
	"store-a1": { id: "store-a1", organizationId: "org-a", locationId: "loc-a1" },
	"store-a2": { id: "store-a2", organizationId: "org-a", locationId: "loc-a2" },
	"store-b1": { id: "store-b1", organizationId: "org-b", locationId: "loc-b1" },
};

const service = (): TenantMembershipService => new TenantMembershipService(new PrismaService(createTestTypedConfig()));

describe("TenantMembershipService.verify", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.locationFindFirst.mockImplementation(({ where }: { where: { id: string } }) => {
			const organizationId = locations[where.id];
			return Promise.resolve(organizationId === undefined ? null : { organizationId });
		});
		mocks.storeFindFirst.mockImplementation(({ where }: { where: { id: string } }) => Promise.resolve(stores[where.id] ?? null));
		mocks.storeMembershipFindFirst.mockResolvedValue(null);
	});

	it("returns an empty context when nothing is requested", async () => {
		const result = await service().verify("user-1", {});

		expect(result).toEqual({ context: {}, organizationRejected: false, storeRejected: false, locationRejected: false });
		expect(mocks.membershipFindFirst).not.toHaveBeenCalled();
	});

	it("rejects an organization without an active membership (forged organizationId)", async () => {
		mocks.membershipFindFirst.mockResolvedValue(null);

		const result = await service().verify("user-1", { organizationId: "org-b" });

		expect(result.organizationRejected).toBe(true);
		expect(result.context).toEqual({});
		expect(mocks.membershipFindFirst.mock.lastCall?.[LIST_SLOT_INDEX.first]).toMatchObject({
			where: { userId: "user-1", organizationId: "org-b", status: "ACTIVE", isDeleted: false },
		});
	});

	it("verifies an active membership", async () => {
		mocks.membershipFindFirst.mockResolvedValue({ locationScopes: [] });

		expect((await service().verify("user-1", { organizationId: "org-a" })).context).toEqual({ organizationId: "org-a" });
	});

	describe("locations", () => {
		it("accepts locations covered by an ALL_LOCATIONS or SELECTED scope", async () => {
			mocks.membershipFindFirst.mockResolvedValue({ locationScopes: [{ scopeType: "ALL_LOCATIONS", locationId: null }] });
			expect((await service().verify("user-1", { organizationId: "org-a", locationId: "loc-a2" })).context).toEqual({ organizationId: "org-a", locationId: "loc-a2" });

			mocks.membershipFindFirst.mockResolvedValue({ locationScopes: [{ scopeType: "SELECTED", locationId: "loc-a1" }] });
			expect((await service().verify("user-1", { organizationId: "org-a", locationId: "loc-a1" })).context).toEqual({ organizationId: "org-a", locationId: "loc-a1" });
		});

		it("rejects a location outside the SELECTED scope (forged locationId)", async () => {
			mocks.membershipFindFirst.mockResolvedValue({ locationScopes: [{ scopeType: "SELECTED", locationId: "loc-a1" }] });

			const result = await service().verify("user-1", { organizationId: "org-a", locationId: "loc-a2" });

			expect(result).toEqual({ context: { organizationId: "org-a" }, organizationRejected: false, storeRejected: false, locationRejected: true });
		});

		it("rejects a location owned by another organization even with ALL_LOCATIONS", async () => {
			mocks.membershipFindFirst.mockResolvedValue({ locationScopes: [{ scopeType: "ALL_LOCATIONS", locationId: null }] });

			expect((await service().verify("user-1", { organizationId: "org-a", locationId: "loc-b1" })).locationRejected).toBe(true);
		});

		it("never implies location access from a membership without scope rows", async () => {
			mocks.membershipFindFirst.mockResolvedValue({ locationScopes: [] });

			expect((await service().verify("user-1", { organizationId: "org-a", locationId: "loc-a1" })).locationRejected).toBe(true);
		});

		it("derives the organization from a location when only the location is requested", async () => {
			mocks.membershipFindFirst.mockResolvedValue({ locationScopes: [{ scopeType: "ALL_LOCATIONS", locationId: null }] });

			expect((await service().verify("user-1", { locationId: "loc-a1" })).context).toEqual({ organizationId: "org-a", locationId: "loc-a1" });
		});

		it("rejects an unknown location", async () => {
			const result = await service().verify("user-1", { locationId: "loc-missing" });

			expect(result).toEqual({ context: {}, organizationRejected: false, storeRejected: false, locationRejected: true });
		});
	});

	describe("stores", () => {
		it("accepts a store through an active store membership, even without an organization membership", async () => {
			mocks.membershipFindFirst.mockResolvedValue(null);
			mocks.storeMembershipFindFirst.mockResolvedValue({ id: "sm-1" });

			const result = await service().verify("user-1", { storeId: "store-a1" });

			expect(result.context).toEqual({ organizationId: "org-a", storeId: "store-a1" });
		});

		it("accepts a store covered by the organization membership location scope", async () => {
			mocks.membershipFindFirst.mockResolvedValue({ locationScopes: [{ scopeType: "SELECTED", locationId: "loc-a2" }] });

			expect((await service().verify("user-1", { organizationId: "org-a", storeId: "store-a2" })).context).toEqual({ organizationId: "org-a", storeId: "store-a2" });
		});

		it("rejects a store outside the member's scope (forged storeId)", async () => {
			mocks.membershipFindFirst.mockResolvedValue({ locationScopes: [{ scopeType: "SELECTED", locationId: "loc-a1" }] });

			const result = await service().verify("user-1", { organizationId: "org-a", storeId: "store-a2" });

			expect(result.storeRejected).toBe(true);
			expect(result.context).toEqual({ organizationId: "org-a" });
		});

		it("rejects a store belonging to another organization", async () => {
			mocks.membershipFindFirst.mockResolvedValue({ locationScopes: [{ scopeType: "ALL_LOCATIONS", locationId: null }] });

			expect((await service().verify("user-1", { organizationId: "org-a", storeId: "store-b1" })).storeRejected).toBe(true);
		});

		it("rejects an unknown or inactive store", async () => {
			const result = await service().verify("user-1", { storeId: "store-missing" });

			expect(result).toEqual({ context: {}, organizationRejected: false, storeRejected: true, locationRejected: false });
			expect(mocks.storeFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "store-missing", isDeleted: false, status: "ACTIVE" } }));
		});

		it("rejects a store member claiming another organization", async () => {
			mocks.membershipFindFirst.mockResolvedValue(null);
			mocks.storeMembershipFindFirst.mockResolvedValue({ id: "sm-1" });

			expect((await service().verify("user-1", { organizationId: "org-b", storeId: "store-a1" })).organizationRejected).toBe(true);
		});
	});
});
