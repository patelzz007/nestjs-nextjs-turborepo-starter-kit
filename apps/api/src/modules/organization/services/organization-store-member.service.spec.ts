import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError, NotFoundError } from "../../../common/errors/app-error";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { StoreAccessRepository, type MembershipWithScopes } from "../repositories/store-access.repository";
import { OrganizationAuditService } from "./organization-audit.service";
import type { OrganizationTeamActor } from "./organization-membership.service";
import { OrganizationRewardAuthService } from "./organization-reward-auth.service";
import { OrganizationStoreMemberService, STORE_MEMBER_ERROR_CODES } from "./organization-store-member.service";

vi.mock("../../../prisma/tenant-transaction.service", () => ({ TenantTransactionService: class {} }));
vi.mock("./organization-reward-auth.service", () => ({ OrganizationRewardAuthService: class {} }));

const ORG_ID = "6f0c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f";
const ACTOR_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const MEMBER_USER_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
const MEMBERSHIP_ID = "c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f";
const STORE_A = "e5f6a7b8-c9d0-4e1f-8a3b-4c5d6e7f8091";
const STORE_B = "f6a7b8c9-d0e1-4f2a-9b4c-5d6e7f8091a2";
const POLICY_VERSION = 7;

const MANAGER: OrganizationTeamActor = {
	userId: ACTOR_ID,
	organizationId: ORG_ID,
	role: "ADMIN",
	locationScopeType: "ALL_LOCATIONS",
	locationIds: [],
	policyVersion: POLICY_VERSION,
};

function member(overrides: Partial<MembershipWithScopes> = {}): MembershipWithScopes {
	return {
		id: MEMBERSHIP_ID,
		userId: MEMBER_USER_ID,
		role: "CASHIER",
		scopes: [
			{ scopeType: "SELECTED", locationId: STORE_A },
			{ scopeType: "SELECTED", locationId: STORE_B },
		],
		...overrides,
	};
}

describe("OrganizationStoreMemberService.removeFromStore", () => {
	let service: OrganizationStoreMemberService;
	const tx = { organizationAuditLog: { create: vi.fn() } };
	const tenantTx = { withSystemOperation: vi.fn() };
	const auth = { requireMembershipCapability: vi.fn() };
	const storeAccess = {
		findLiveMembershipForUpdateInTx: vi.fn(),
		deleteMemberScopeInTx: vi.fn(),
		listMemberLocationIdsInTx: vi.fn(),
		softDeleteUserStoreMembershipInTx: vi.fn(),
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		tenantTx.withSystemOperation.mockImplementation(async (_context: object, work: (client: typeof tx) => Promise<object>) => work(tx));
		auth.requireMembershipCapability.mockResolvedValue(undefined);
		tx.organizationAuditLog.create.mockResolvedValue({});
		storeAccess.findLiveMembershipForUpdateInTx.mockResolvedValue(member());
		storeAccess.deleteMemberScopeInTx.mockResolvedValue(true);
		storeAccess.listMemberLocationIdsInTx.mockResolvedValue([STORE_B]);
		storeAccess.softDeleteUserStoreMembershipInTx.mockResolvedValue(1);

		const moduleRef = await Test.createTestingModule({
			providers: [
				OrganizationStoreMemberService,
				OrganizationAuditService,
				{ provide: TenantTransactionService, useValue: tenantTx },
				{ provide: OrganizationRewardAuthService, useValue: auth },
				{ provide: StoreAccessRepository, useValue: storeAccess },
			],
		}).compile();
		service = moduleRef.get(OrganizationStoreMemberService);
	});

	it("removes the scope row, soft-deletes the store membership as the actor and audits in the same transaction", async () => {
		const result = await service.removeFromStore(MANAGER, MEMBERSHIP_ID, STORE_A, { allowNoStores: false });

		expect(tenantTx.withSystemOperation).toHaveBeenCalledTimes(1);
		expect(storeAccess.deleteMemberScopeInTx).toHaveBeenCalledWith(tx, MEMBERSHIP_ID, STORE_A);
		expect(storeAccess.softDeleteUserStoreMembershipInTx).toHaveBeenCalledWith(tx, STORE_A, MEMBER_USER_ID, expect.objectContaining({ actorUserId: ACTOR_ID }));
		expect(tx.organizationAuditLog.create.mock.lastCall).toMatchObject([
			{ data: { action: "membership.removed_from_store", actorUserId: ACTOR_ID, policyVersion: POLICY_VERSION, resourceId: MEMBERSHIP_ID } },
		]);
		expect(result).toMatchObject({ membershipId: MEMBERSHIP_ID, locationId: STORE_A, remainingLocationIds: [STORE_B] });
	});

	it("refuses to leave a member with no store unless allowNoStores is set (nothing is written)", async () => {
		storeAccess.listMemberLocationIdsInTx.mockResolvedValue([]);

		await expect(service.removeFromStore(MANAGER, MEMBERSHIP_ID, STORE_A, { allowNoStores: false })).rejects.toMatchObject({
			httpStatus: 409,
			code: STORE_MEMBER_ERROR_CODES.lastStore,
		});
		expect(storeAccess.softDeleteUserStoreMembershipInTx).not.toHaveBeenCalled();
		expect(tx.organizationAuditLog.create).not.toHaveBeenCalled();

		await expect(service.removeFromStore(MANAGER, MEMBERSHIP_ID, STORE_A, { allowNoStores: true })).resolves.toMatchObject({ remainingLocationIds: [] });
		expect(storeAccess.softDeleteUserStoreMembershipInTx).toHaveBeenCalledTimes(1);
	});

	it("protects the OWNER and members who cover every store", async () => {
		storeAccess.findLiveMembershipForUpdateInTx.mockResolvedValue(member({ role: "OWNER" }));
		await expect(service.removeFromStore(MANAGER, MEMBERSHIP_ID, STORE_A, { allowNoStores: true })).rejects.toMatchObject({ code: STORE_MEMBER_ERROR_CODES.ownerProtected });

		storeAccess.findLiveMembershipForUpdateInTx.mockResolvedValue(member({ scopes: [{ scopeType: "ALL_LOCATIONS", locationId: null }] }));
		await expect(service.removeFromStore(MANAGER, MEMBERSHIP_ID, STORE_A, { allowNoStores: true })).rejects.toMatchObject({
			code: STORE_MEMBER_ERROR_CODES.allLocationsMember,
		});
		expect(storeAccess.deleteMemberScopeInTx).not.toHaveBeenCalled();
	});

	it("answers 404 for an unknown member or a store the member is not scoped to", async () => {
		storeAccess.findLiveMembershipForUpdateInTx.mockResolvedValue(null);
		await expect(service.removeFromStore(MANAGER, MEMBERSHIP_ID, STORE_A, { allowNoStores: false })).rejects.toBeInstanceOf(NotFoundError);

		storeAccess.findLiveMembershipForUpdateInTx.mockResolvedValue(member());
		storeAccess.deleteMemberScopeInTx.mockResolvedValue(false);
		await expect(service.removeFromStore(MANAGER, MEMBERSHIP_ID, STORE_A, { allowNoStores: false })).rejects.toBeInstanceOf(NotFoundError);
	});

	it("needs manage_team and a location scope covering the store", async () => {
		auth.requireMembershipCapability.mockRejectedValueOnce(new AuthorizationError());
		await expect(service.removeFromStore(MANAGER, MEMBERSHIP_ID, STORE_A, { allowNoStores: false })).rejects.toBeInstanceOf(AuthorizationError);

		const scoped: OrganizationTeamActor = { ...MANAGER, locationScopeType: "SELECTED", locationIds: [STORE_B] };
		await expect(service.removeFromStore(scoped, MEMBERSHIP_ID, STORE_A, { allowNoStores: false })).rejects.toMatchObject({
			httpStatus: 403,
			code: "ORGANIZATION_STORE_OUT_OF_SCOPE",
		});
		expect(tenantTx.withSystemOperation).not.toHaveBeenCalled();
	});
});
