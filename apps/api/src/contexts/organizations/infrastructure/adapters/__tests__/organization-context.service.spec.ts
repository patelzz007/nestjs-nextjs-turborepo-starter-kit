import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DependencyUnavailableError } from "../../../../../platform/application/errors/app-error";
import { TenantTransactionService } from "../../../../../prisma/tenant-transaction.service";
import { CEDAR_POLICY_EVALUATOR, type CedarPolicyEvaluatorPort } from "../../../../authorization/public-api";
import { mapMembershipLocationScope } from "../../persistence/organization-membership.mapper";
import { OrganizationAuditService } from "../../audit/organization-audit.adapter";
import { OrganizationContextService } from "../organization-context.service";
import { PublicUrlResolver } from "../../../../../config/public-url.resolver";
import { createTestPublicUrls } from "../../../../../../test/support/public-urls";
import { LIVE_ROW_FIELDS } from "../../../../../platform/infrastructure/persistence/__tests__/base-row-fields";

vi.mock("../../../../../prisma/tenant-transaction.service", () => ({ TenantTransactionService: class {} }));

const USER_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const ORG_ID = "6f0c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f";
const STORE_A = "e5f6a7b8-c9d0-4e1f-8a3b-4c5d6e7f8091";
const POLICY_VERSION = 5;

type ScopeRow = Parameters<typeof mapMembershipLocationScope>[0]["locationScopes"][number];

function scopeRow(scopeType: ScopeRow["scopeType"], locationId: string | null): ScopeRow {
	return { ...LIVE_ROW_FIELDS, id: `scope-${locationId ?? "all"}`, organizationId: ORG_ID, membershipId: "membership-1", scopeType, locationId, createdAt: 0n, updatedAt: 0n };
}

function membershipRow(locationScopes: readonly ScopeRow[]): Parameters<typeof mapMembershipLocationScope>[0] {
	return {
		...LIVE_ROW_FIELDS,
		id: "membership-1",
		organizationId: ORG_ID,
		userId: USER_ID,
		role: "CASHIER",
		status: "ACTIVE",
		displayName: null,
		isDeleted: false,
		deletedAt: null,
		createdAt: 0n,
		updatedAt: 0n,
		locationScopes,
	};
}

describe("mapMembershipLocationScope (fail closed)", () => {
	it("maps an explicit ALL_LOCATIONS row to ALL_LOCATIONS", () => {
		expect(mapMembershipLocationScope(membershipRow([scopeRow("ALL_LOCATIONS", null)]))).toEqual({ locationScopeType: "ALL_LOCATIONS", locationIds: [] });
	});

	it("maps SELECTED rows to exactly those stores", () => {
		expect(mapMembershipLocationScope(membershipRow([scopeRow("SELECTED", STORE_A)]))).toEqual({ locationScopeType: "SELECTED", locationIds: [STORE_A] });
	});

	it("maps a membership with NO scope rows to SELECTED with no stores — never to ALL_LOCATIONS", () => {
		expect(mapMembershipLocationScope(membershipRow([]))).toEqual({ locationScopeType: "SELECTED", locationIds: [] });
	});

	it("lets a SELECTED row narrow a conflicting ALL_LOCATIONS row", () => {
		expect(mapMembershipLocationScope(membershipRow([scopeRow("ALL_LOCATIONS", null), scopeRow("SELECTED", STORE_A)]))).toEqual({
			locationScopeType: "SELECTED",
			locationIds: [STORE_A],
		});
	});
});

describe("OrganizationContextService.resolveBySlug", () => {
	let service: OrganizationContextService;
	const findFirst = vi.fn();
	const tenantTx = { withSystemOperation: vi.fn() };
	const cedar = { getActivePolicyVersion: vi.fn<CedarPolicyEvaluatorPort["getActivePolicyVersion"]>() };

	beforeEach(async () => {
		vi.clearAllMocks();
		tenantTx.withSystemOperation.mockImplementation(async (_context: object, work: (tx: { organization: { findFirst: typeof findFirst } }) => Promise<object>) =>
			work({ organization: { findFirst } }),
		);
		cedar.getActivePolicyVersion.mockResolvedValue(POLICY_VERSION);
		const moduleRef = await Test.createTestingModule({
			providers: [
				OrganizationContextService,
				{ provide: PublicUrlResolver, useValue: createTestPublicUrls() },
				OrganizationAuditService,
				{ provide: TenantTransactionService, useValue: tenantTx },
				{ provide: CEDAR_POLICY_EVALUATOR, useValue: cedar },
			],
		}).compile();
		service = moduleRef.get(OrganizationContextService);
	});

	it("resolves a member with their real scope and the active policy version", async () => {
		findFirst.mockResolvedValue({ id: ORG_ID, slug: "brew", memberships: [membershipRow([scopeRow("SELECTED", STORE_A)])] });

		await expect(service.resolveBySlug(USER_ID, "brew")).resolves.toMatchObject({
			organizationId: ORG_ID,
			policyVersion: POLICY_VERSION,
			membership: { locationScopeType: "SELECTED", locationIds: [STORE_A] },
		});
	});

	it("answers 404 for a missing organization and for a non-member", async () => {
		findFirst.mockResolvedValueOnce(null);
		await expect(service.resolveBySlug(USER_ID, "brew")).rejects.toBeInstanceOf(NotFoundException);

		findFirst.mockResolvedValueOnce({ id: ORG_ID, slug: "brew", memberships: [] });
		await expect(service.resolveBySlug(USER_ID, "brew")).rejects.toBeInstanceOf(NotFoundException);
	});

	it("propagates infrastructure failures instead of disguising them as 404", async () => {
		findFirst.mockRejectedValue(new DependencyUnavailableError());
		await expect(service.resolveBySlug(USER_ID, "brew")).rejects.toBeInstanceOf(DependencyUnavailableError);

		findFirst.mockResolvedValue({ id: ORG_ID, slug: "brew", memberships: [membershipRow([scopeRow("ALL_LOCATIONS", null)])] });
		cedar.getActivePolicyVersion.mockRejectedValueOnce(new Error("policy bundle unavailable"));
		await expect(service.resolveBySlug(USER_ID, "brew")).rejects.toThrow("policy bundle unavailable");
	});
});
