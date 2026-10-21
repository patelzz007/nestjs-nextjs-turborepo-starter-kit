import { beforeEach, describe, expect, it, vi } from "vitest";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../../../prisma/prisma.service";
import type { SystemDatabaseContext } from "../../../../../prisma/tenant-context";
import { TenantMembershipService } from "../tenant-membership.service";
import { SERVES_EVERY_TENANT, servesOnly } from "../../../../../../test/support/served-tenants";
import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";
import type { ServedTenantPolicy } from "../../../../../platform/application/tenancy/served-tenant.port";

const mocks = vi.hoisted(() => ({
	membershipFindFirst: vi.fn(),
	supportGrantFindFirst: vi.fn(),
	locationFindFirst: vi.fn(),
	tenantFindFirst: vi.fn(),
}));

vi.mock("../../../../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly membership = { findFirst: mocks.membershipFindFirst };
		public readonly supportAccessGrant = { findFirst: mocks.supportGrantFindFirst };
		public readonly location = { findFirst: mocks.locationFindFirst };
		public readonly tenant = { findFirst: mocks.tenantFindFirst };
	},
}));

/** Live tenants and their lifecycle state. */
const tenants: Record<string, string> = { "org-a": "ACTIVE", "org-b": "ACTIVE" };

const locations: Readonly<Record<string, string>> = { "loc-a1": "org-a", "loc-a2": "org-a", "loc-b1": "org-b" };
const service = (servedTenants: ServedTenantPolicy = SERVES_EVERY_TENANT): TenantMembershipService => {
	const prisma = new PrismaService(createTestTypedConfig());
	return new TenantMembershipService(
		{
			withSystemOperation: <TResult>(_context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> => work(prisma),
		},
		servedTenants,
	);
};

describe("TenantMembershipService.verify", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.locationFindFirst.mockImplementation(({ where }: { where: { id: string } }) => {
			const tenantId = locations[where.id];
			return Promise.resolve(tenantId === undefined ? null : { tenantId });
		});
		mocks.supportGrantFindFirst.mockResolvedValue(null);
		tenants["org-a"] = "ACTIVE";
		mocks.tenantFindFirst.mockImplementation(({ where }: { where: { id: string } }) => {
			const lifecycleState = tenants[where.id];
			return Promise.resolve(lifecycleState === undefined ? null : { lifecycleState });
		});
	});

	it("returns an empty context when nothing is requested", async () => {
		const result = await service().verify("user-1", {});

		expect(result).toEqual({ context: {}, target: null, tenantRejected: false, locationRejected: false });
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
			locationRejected: false,
		});
	});

	it("reports the lifecycle of a tenant reached only through a location, so a suspended tenant is not served (C1)", async () => {
		tenants["org-a"] = "SUSPENDED";
		mocks.membershipFindFirst.mockResolvedValue({ status: "ACTIVE", locationScopes: [{ scopeType: "ALL_LOCATIONS", locationId: null }] });

		const result = await service().verify("user-1", { locationId: "loc-a1" });

		expect(result.context).toEqual({ tenantId: "org-a", locationId: "loc-a1" });
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

			expect(result).toEqual({ context: {}, target: null, tenantRejected: false, locationRejected: true });
		});
	});

	describe("single-tenant deployment", () => {
		it("never reaches another tenant through a location id, even for one of its active members", async () => {
			mocks.membershipFindFirst.mockResolvedValue({ status: "ACTIVE", locationScopes: [{ scopeType: "ALL_LOCATIONS", locationId: null }] });

			const result = await service(servesOnly("org-a")).verify("user-1", { locationId: "loc-b1" });

			expect(result).toEqual({ context: {}, target: null, tenantRejected: false, locationRejected: true });
			expect(mocks.membershipFindFirst).not.toHaveBeenCalled();
		});

		it("still serves the configured tenant's locations", async () => {
			mocks.membershipFindFirst.mockResolvedValue({ status: "ACTIVE", locationScopes: [{ scopeType: "ALL_LOCATIONS", locationId: null }] });

			expect((await service(servesOnly("org-a")).verify("user-1", { locationId: "loc-a1" })).context).toEqual({ tenantId: "org-a", locationId: "loc-a1" });
		});

		it("rejects a named tenant it does not serve", async () => {
			mocks.membershipFindFirst.mockResolvedValue({ status: "ACTIVE", locationScopes: [] });

			expect(await service(servesOnly("org-a")).verify("user-1", { tenantId: "org-b" })).toMatchObject({ context: {}, target: null, tenantRejected: true });
		});
	});
});
