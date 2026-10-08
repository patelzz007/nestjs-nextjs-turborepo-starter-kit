import { Test } from "@nestjs/testing";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import type { OrganizationLocation } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError, NotFoundError } from "../../../common/errors/app-error";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { CedarPolicyEvaluatorService } from "../../authorization-cedar/services/cedar-policy-evaluator.service";
import { OrganizationLocationRepository } from "../repositories/organization-location.repository";
import { StoreAccessRepository } from "../repositories/store-access.repository";
import { OrganizationAuditService } from "./organization-audit.service";
import { OrganizationContextService } from "./organization-context.service";
import { OrganizationLocationService } from "./organization-location.service";
import { OrganizationRewardAuthService } from "./organization-reward-auth.service";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));
vi.mock("../../../prisma/tenant-transaction.service", () => ({ TenantTransactionService: class {} }));
vi.mock("../../authorization-cedar/services/cedar-policy-evaluator.service", () => ({ CedarPolicyEvaluatorService: class {} }));
vi.mock("./organization-context.service", () => ({ OrganizationContextService: class {} }));
vi.mock("./organization-reward-auth.service", () => ({ OrganizationRewardAuthService: class {} }));

const USER_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const ORG_ID = "6f0c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f";
const LOCATION_ID = "e5f6a7b8-c9d0-4e1f-8a3b-4c5d6e7f8091";
const STORE_ID = "a7b8c9d0-e1f2-4a3b-8c5d-6e7f8091a2b3";
const POLICY_VERSION = 6;

function locationRow(overrides: Partial<OrganizationLocation> = {}): OrganizationLocation {
	return {
		id: LOCATION_ID,
		organizationId: ORG_ID,
		name: "Bangsar",
		code: "bangsar",
		addressText: "1 Jalan Telawi, Bangsar",
		city: "KUALA_LUMPUR",
		contactPhone: "+60312345678",
		status: "PENDING_APPROVAL",
		rejectionReason: null,
		requestedByUserId: USER_ID,
		reviewedByUserId: null,
		reviewedAt: null,
		isPrimary: false,
		closureReason: null,
		isDeleted: false,
		deletedAt: null,
		deletedBy: null,
		createdAt: 0n,
		updatedAt: 0n,
		...overrides,
	};
}

/** A fake transaction client: the spec's delegate mocks on top of a (module-mocked, connection-less) PrismaService. */
function asTransaction<TFake extends object>(fake: TFake): PrismaService & TFake {
	return Object.assign(new PrismaService(createTestTypedConfig()), fake);
}

/** Records the order of the location statements a request issues. */
function createTx(calls: string[]): {
	$executeRaw: ReturnType<typeof vi.fn>;
	organization: { findUnique: ReturnType<typeof vi.fn> };
	organizationLocation: {
		count: ReturnType<typeof vi.fn>;
		findFirst: ReturnType<typeof vi.fn>;
		findFirstOrThrow: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
		updateMany: ReturnType<typeof vi.fn>;
	};
	store: { upsert: ReturnType<typeof vi.fn> };
	organizationAuditLog: { create: ReturnType<typeof vi.fn> };
} {
	return {
		$executeRaw: vi.fn().mockImplementation(() => {
			calls.push("lock");
			return Promise.resolve(1);
		}),
		organization: { findUnique: vi.fn().mockResolvedValue({ merchantProfile: { city: "KUALA_LUMPUR" } }) },
		organizationLocation: {
			count: vi.fn().mockImplementation(() => {
				calls.push("count");
				return Promise.resolve(0);
			}),
			findFirst: vi.fn().mockResolvedValue(null),
			findFirstOrThrow: vi.fn().mockResolvedValue(locationRow()),
			create: vi.fn().mockImplementation(() => {
				calls.push("create");
				return Promise.resolve(locationRow());
			}),
			update: vi.fn().mockResolvedValue(locationRow({ isPrimary: true, status: "ACTIVE" })),
			updateMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		store: { upsert: vi.fn().mockResolvedValue({}) },
		organizationAuditLog: { create: vi.fn().mockResolvedValue({}) },
	};
}

describe("OrganizationLocationService", () => {
	let service: OrganizationLocationService;
	let calls: string[];
	let tx: ReturnType<typeof createTx>;
	const tenantTx = { withTenantTransaction: vi.fn(), withSystemOperation: vi.fn() };
	const context = { resolveBySlug: vi.fn() };
	const auth = { requireMembershipCapability: vi.fn() };
	const cedar = { getActivePolicyVersion: vi.fn() };
	const storeAccess = {
		findStoreIdByLocationInTx: vi.fn(),
		softDeleteStoreMembershipsInTx: vi.fn(),
		deleteLocationScopesInTx: vi.fn(),
		removeTerminalsAndRevokeKeysInTx: vi.fn(),
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		calls = [];
		tx = createTx(calls);
		tenantTx.withTenantTransaction.mockImplementation(async (_context: object, work: (client: ReturnType<typeof createTx>) => Promise<object>) => work(tx));
		tenantTx.withSystemOperation.mockImplementation(async (_context: object, work: (client: ReturnType<typeof createTx>) => Promise<object>) => work(tx));
		context.resolveBySlug.mockResolvedValue({
			organizationId: ORG_ID,
			slug: "brew",
			userId: USER_ID,
			policyVersion: POLICY_VERSION,
			membership: { role: "OWNER", locationScopeType: "ALL_LOCATIONS", locationIds: [] },
		});
		auth.requireMembershipCapability.mockResolvedValue(undefined);
		cedar.getActivePolicyVersion.mockResolvedValue(POLICY_VERSION);
		storeAccess.findStoreIdByLocationInTx.mockResolvedValue(STORE_ID);
		storeAccess.softDeleteStoreMembershipsInTx.mockResolvedValue(3);
		storeAccess.deleteLocationScopesInTx.mockResolvedValue(2);
		storeAccess.removeTerminalsAndRevokeKeysInTx.mockResolvedValue({ terminalsRemoved: 1, apiKeysRevoked: 2 });

		const moduleRef = await Test.createTestingModule({
			providers: [
				OrganizationLocationService,
				OrganizationLocationRepository,
				{ provide: StoreAccessRepository, useValue: storeAccess },
				OrganizationAuditService,
				{ provide: PrismaService, useValue: {} },
				{ provide: TenantTransactionService, useValue: tenantTx },
				{ provide: OrganizationContextService, useValue: context },
				{ provide: OrganizationRewardAuthService, useValue: auth },
				{ provide: CedarPolicyEvaluatorService, useValue: cedar },
			],
		}).compile();
		service = moduleRef.get(OrganizationLocationService);
	});

	it("counts pending requests INSIDE the transaction, after taking the organization's location lock", async () => {
		await service.createMerchantLocation(USER_ID, "brew", { name: "Bangsar", addressText: "1 Jalan Telawi" });

		expect(calls.slice(0, 2)).toEqual(["lock", "count"]);
		expect(calls).toContain("create");
		expect(tx.organizationAuditLog.create.mock.lastCall).toMatchObject([
			{
				data: { action: "organization.location.requested", policyVersion: POLICY_VERSION, actorUserId: USER_ID },
			},
		]);
	});

	it("resubmits only a still-REJECTED location (compare-and-set) and answers 409 when it changed", async () => {
		tx.organizationLocation.updateMany.mockResolvedValue({ count: 0 });
		tx.organizationLocation.findFirst.mockResolvedValue(locationRow({ status: "PENDING_APPROVAL" }));

		await expect(service.resubmitMerchantLocation(USER_ID, "brew", LOCATION_ID, { name: "Bangsar", addressText: "1 Jalan Telawi" })).rejects.toMatchObject({
			httpStatus: 409,
		});
		expect(tx.organizationLocation.updateMany.mock.lastCall).toMatchObject([{ where: { id: LOCATION_ID, organizationId: ORG_ID, isDeleted: false, status: "REJECTED" } }]);
		expect(tx.organizationAuditLog.create).not.toHaveBeenCalled();
	});

	it("answers 404 for a resubmit of a location outside the organization", async () => {
		tx.organizationLocation.updateMany.mockResolvedValue({ count: 0 });
		tx.organizationLocation.findFirst.mockResolvedValue(null);

		await expect(service.resubmitMerchantLocation(USER_ID, "brew", LOCATION_ID, { name: "Bangsar", addressText: "1 Jalan Telawi" })).rejects.toBeInstanceOf(NotFoundError);
	});

	it("reviews only a still-pending location (compare-and-set) and audits in the same transaction", async () => {
		await service.reviewAdminLocation(USER_ID, ORG_ID, LOCATION_ID, { approve: true });
		expect(tx.organizationLocation.updateMany.mock.lastCall).toMatchObject([
			{ where: { id: LOCATION_ID, organizationId: ORG_ID, isDeleted: false, status: "PENDING_APPROVAL" } },
		]);
		expect(tx.organizationAuditLog.create.mock.lastCall).toMatchObject([
			{
				data: { action: "organization.location.approved", policyVersion: POLICY_VERSION },
			},
		]);

		tx.organizationLocation.updateMany.mockResolvedValue({ count: 0 });
		tx.organizationLocation.findFirst.mockResolvedValue(locationRow({ status: "ACTIVE" }));
		await expect(service.reviewAdminLocation(USER_ID, ORG_ID, LOCATION_ID, { approve: true })).rejects.toMatchObject({ httpStatus: 409 });
	});

	it("creates the primary store at onboarding from the submitted address (none exists before onboarding)", async () => {
		await service.finalizeOnboardingLocationsInTx(asTransaction(tx), {
			organizationId: ORG_ID,
			userId: USER_ID,
			policyVersion: POLICY_VERSION,
			city: "KUALA_LUMPUR",
			primary: { name: "Brew HQ", addressText: "1 Jalan Telawi, Bangsar", contactPhone: "+60312345678" },
			additionalLocations: [],
		});

		expect(calls[LIST_SLOT_INDEX.first]).toBe("lock");
		expect(tx.organizationLocation.create.mock.lastCall).toMatchObject([
			{
				data: { organizationId: ORG_ID, isPrimary: true, status: "ACTIVE", addressText: "1 Jalan Telawi, Bangsar", city: "KUALA_LUMPUR" },
			},
		]);
		expect(tx.organizationAuditLog.create.mock.lastCall).toMatchObject([{ data: { action: "organization.location.primary_finalized" } }]);
	});

	describe("closeMerchantLocation", () => {
		const CLOSE_INPUT = { reason: "Franchise partner went bankrupt" };

		it("closes the store, removes its access rows and audits — all inside one system-operation transaction", async () => {
			tx.organizationLocation.findFirstOrThrow.mockResolvedValue(locationRow({ isDeleted: true, status: "INACTIVE" }));

			const result = await service.closeMerchantLocation(USER_ID, "brew", LOCATION_ID, CLOSE_INPUT);

			expect(tenantTx.withSystemOperation).toHaveBeenCalledTimes(1);
			expect(calls[LIST_SLOT_INDEX.first]).toBe("lock");
			expect(tx.organizationLocation.updateMany.mock.lastCall).toMatchObject([
				{
					where: { id: LOCATION_ID, organizationId: ORG_ID, isDeleted: false, isPrimary: false },
					data: { status: "INACTIVE", isDeleted: true, deletedBy: USER_ID, closureReason: CLOSE_INPUT.reason },
				},
			]);
			expect(storeAccess.softDeleteStoreMembershipsInTx).toHaveBeenCalledWith(tx, STORE_ID, expect.objectContaining({ actorUserId: USER_ID }));
			expect(tx.organizationAuditLog.create.mock.lastCall).toMatchObject([
				{
					data: {
						action: "organization.location.closed",
						actorUserId: USER_ID,
						policyVersion: POLICY_VERSION,
						resourceId: LOCATION_ID,
						metadata: { reason: CLOSE_INPUT.reason, storeMembershipsRemoved: 3, memberScopesRemoved: 2, terminalsRemoved: 1, apiKeysRevoked: 2 },
					},
				},
			]);
			expect(result).toMatchObject({ locationId: LOCATION_ID, storeId: STORE_ID, storeMembershipsRemoved: 3, memberScopesRemoved: 2, terminalsRemoved: 1, apiKeysRevoked: 2 });
		});

		it("requires manage_locations before touching anything", async () => {
			auth.requireMembershipCapability.mockRejectedValue(new AuthorizationError());

			await expect(service.closeMerchantLocation(USER_ID, "brew", LOCATION_ID, CLOSE_INPUT)).rejects.toBeInstanceOf(AuthorizationError);
			expect(tenantTx.withSystemOperation).not.toHaveBeenCalled();
		});

		it("refuses a store outside the actor's location scope with 403", async () => {
			context.resolveBySlug.mockResolvedValue({
				organizationId: ORG_ID,
				userId: USER_ID,
				policyVersion: POLICY_VERSION,
				membership: { role: "ADMIN", locationScopeType: "SELECTED", locationIds: [STORE_ID] },
			});

			await expect(service.closeMerchantLocation(USER_ID, "brew", LOCATION_ID, CLOSE_INPUT)).rejects.toMatchObject({
				httpStatus: 403,
				code: "ORGANIZATION_STORE_OUT_OF_SCOPE",
			});
			expect(tenantTx.withSystemOperation).not.toHaveBeenCalled();
		});

		it("refuses to close the primary store with 409 and writes nothing else", async () => {
			tx.organizationLocation.updateMany.mockResolvedValue({ count: 0 });
			tx.organizationLocation.findFirst.mockResolvedValue(locationRow({ isPrimary: true, status: "ACTIVE" }));

			await expect(service.closeMerchantLocation(USER_ID, "brew", LOCATION_ID, CLOSE_INPUT)).rejects.toMatchObject({
				httpStatus: 409,
				code: "ORGANIZATION_LOCATION_PRIMARY_CANNOT_CLOSE",
			});
			expect(storeAccess.softDeleteStoreMembershipsInTx).not.toHaveBeenCalled();
			expect(tx.organizationAuditLog.create).not.toHaveBeenCalled();
		});

		it("answers 404 for an unknown or already-closed store and 409 when a concurrent change won the compare-and-set", async () => {
			tx.organizationLocation.updateMany.mockResolvedValue({ count: 0 });
			tx.organizationLocation.findFirst.mockResolvedValue(null);
			await expect(service.closeMerchantLocation(USER_ID, "brew", LOCATION_ID, CLOSE_INPUT)).rejects.toBeInstanceOf(NotFoundError);

			tx.organizationLocation.findFirst.mockResolvedValue(locationRow({ status: "ACTIVE" }));
			await expect(service.closeMerchantLocation(USER_ID, "brew", LOCATION_ID, CLOSE_INPUT)).rejects.toMatchObject({
				httpStatus: 409,
				code: "ORGANIZATION_LOCATION_STATUS_CONFLICT",
			});
		});
	});
});
