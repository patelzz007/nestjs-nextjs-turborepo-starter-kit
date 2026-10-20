import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import {
	MERCHANT_CAPABILITY,
	MerchantCapabilitySchema,
	merchantRoleHasCapability,
	MembershipRoleSchema,
	type MerchantCapability,
	type MembershipRole,
} from "@workspace/shared";

import { createTestPrisma } from "../../../../../../test/support/test-service-graph";
import { TenantTransactionService } from "../../../../../prisma/tenant-transaction.service";
import { createCedarPolicyEvaluator, DEFAULT_TENANT_CEDAR } from "../../../../authorization/public-api";
import { MERCHANT_CAPABILITY_CEDAR_ACTIONS } from "../../../domain/policies/merchant-capability.policy";
import { TenantAuditService } from "../../audit/tenant-audit.adapter";
import { TenantContextService } from "../tenant-context.service";
import { TenantRewardAuthService } from "../tenant-reward-auth.service";
import { RequestContextService } from "../../../../../platform/infrastructure/context/request-context";
import { createTestPublicUrls } from "../../../../../../test/support/public-urls";

const mocks = vi.hoisted(() => ({
	policyFindMany: vi.fn(),
	auditCreate: vi.fn(),
	tenantFindUnique: vi.fn(),
	resolveBySlug: vi.fn(),
	membershipFindFirst: vi.fn(),
}));

// The real Cedar evaluator and audit service run on top of this fake transaction client.
vi.mock("../../../../../prisma/tenant-transaction.service", () => ({
	TenantTransactionService: class {
		public readonly withSystemOperation = async <T>(_context: object, work: (tx: object) => Promise<T>): Promise<T> =>
			work({ authorizationPolicyVersion: { findMany: mocks.policyFindMany }, tenant: { findUnique: mocks.tenantFindUnique } });
		public readonly withTenantTransaction = async <T>(_context: object, work: (tx: object) => Promise<T>): Promise<T> =>
			work({ tenantAuditLog: { create: mocks.auditCreate }, membership: { findFirst: mocks.membershipFindFirst } });
	},
}));

vi.mock("../tenant-context.service", () => ({
	TenantContextService: class {
		public readonly resolveBySlug = mocks.resolveBySlug;
	},
}));

const subjectFor = (role: MembershipRole): { userId: string; tenantId: string; role: MembershipRole } => ({
	userId: "user-1",
	tenantId: "org-1",
	role,
});

function service(): TenantRewardAuthService {
	const tenantTx = new TenantTransactionService(createTestPrisma(), new RequestContextService());
	const cedar = createCedarPolicyEvaluator(tenantTx);
	const audit = new TenantAuditService();
	return new TenantRewardAuthService(tenantTx, new TenantContextService(tenantTx, cedar, audit, createTestPublicUrls()), cedar, audit);
}

/** The caller's live membership row as the tenant transaction reads it (scope rows included). */
function memberWithScopes(locationScopes: readonly { scopeType: "ALL_LOCATIONS" | "SELECTED"; locationId: string | null }[]): void {
	mocks.membershipFindFirst.mockResolvedValue({ id: "membership-1", tenantId: "org-1", userId: "user-1", role: "OWNER", locationScopes });
}

function publishTenantPolicy(cedarSource: string): void {
	mocks.policyFindMany.mockResolvedValue([{ version: 1, cedarSource }]);
}

/**
 * Roles each tenant-management capability allowed BEFORE the capability
 * migration, when the services hard-coded them (`assertCanManageTeam`,
 * `assertCanManageLocations`, `requireOwnerRole`). The capability path must
 * allow exactly these roles — no more, no fewer.
 */
const PRE_MIGRATION_ALLOWED_ROLES: readonly [MerchantCapability, readonly MembershipRole[]][] = [
	[MERCHANT_CAPABILITY.manageTeam, ["OWNER", "ADMIN"]],
	[MERCHANT_CAPABILITY.manageLocations, ["OWNER", "ADMIN"]],
	[MERCHANT_CAPABILITY.manageVerification, ["OWNER"]],
];

const ROLE_CAPABILITY_CASES: readonly [MerchantCapability, MembershipRole, boolean][] = PRE_MIGRATION_ALLOWED_ROLES.flatMap(([capability, allowedRoles]) =>
	MembershipRoleSchema.options.map((role): [MerchantCapability, MembershipRole, boolean] => [capability, role, allowedRoles.includes(role)]),
);

describe("TenantRewardAuthService.requireMembershipCapability", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		publishTenantPolicy(DEFAULT_TENANT_CEDAR);
		mocks.auditCreate.mockResolvedValue({});
		memberWithScopes([{ scopeType: "ALL_LOCATIONS", locationId: null }]);
	});

	it.each(ROLE_CAPABILITY_CASES)("%s for %s → allowed: %s (same roles as the pre-migration role checks)", async (capability, role, allowed) => {
		const check = service().requireMembershipCapability(subjectFor(role), capability);

		if (allowed) {
			await expect(check).resolves.toBeUndefined();
			expect(mocks.auditCreate.mock.lastCall).toMatchObject([
				{ data: { action: `authorize.${MERCHANT_CAPABILITY_CEDAR_ACTIONS[capability] ?? ""}`, decision: "Allow", tenantId: "org-1" } },
			]);
		} else {
			await expect(check).rejects.toMatchObject({ response: { error: "TENANT_ROLE_CAPABILITY_REQUIRED", capability } });
			// The role table rejects before Cedar is consulted (no policy load, no audit row).
			expect(mocks.policyFindMany).not.toHaveBeenCalled();
		}
	});

	it("agrees with the default tenant Cedar policy for every role and every API-enforced capability", async () => {
		const disagreements: string[] = [];
		for (const capability of MerchantCapabilitySchema.options) {
			if (MERCHANT_CAPABILITY_CEDAR_ACTIONS[capability] === null) {
				continue;
			}
			for (const role of MembershipRoleSchema.options) {
				const allowed = await service()
					.requireMembershipCapability(subjectFor(role), capability)
					.then(() => true)
					.catch(() => false);
				if (allowed !== merchantRoleHasCapability(role, capability)) {
					disagreements.push(`${role} ${capability}`);
				}
			}
		}
		expect(disagreements).toEqual([]);
	});

	it("lets a tenant Cedar policy narrow the role table (owner-only team management)", async () => {
		publishTenantPolicy('permit(principal, action, resource) when { principal.role == "OWNER" };');

		await expect(service().requireMembershipCapability(subjectFor("OWNER"), MERCHANT_CAPABILITY.manageTeam)).resolves.toBeUndefined();
		await expect(service().requireMembershipCapability(subjectFor("ADMIN"), MERCHANT_CAPABILITY.manageTeam)).rejects.toMatchObject({
			response: { error: "TENANT_ACTION_FORBIDDEN", action: "tenant:manage_team" },
		});
		expect(mocks.auditCreate.mock.lastCall).toMatchObject([{ data: { action: "authorize.tenant:manage_team", decision: "Deny" } }]);
	});

	it.each([MERCHANT_CAPABILITY.viewDashboard, MERCHANT_CAPABILITY.viewLocations, "merchant:manage_kyb"])(
		"fails closed for %s, which guards no API action",
		async (capability: string) => {
			await expect(service().requireMembershipCapability(subjectFor("OWNER"), capability)).rejects.toMatchObject({
				response: { error: "TENANT_CAPABILITY_UNKNOWN", capability },
			});
			expect(mocks.policyFindMany).not.toHaveBeenCalled();
		},
	);
});

describe("TenantRewardAuthService.requireCapabilityForSlug", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		publishTenantPolicy(DEFAULT_TENANT_CEDAR);
		mocks.auditCreate.mockResolvedValue({});
		mocks.tenantFindUnique.mockResolvedValue({ displayName: "Brew", lifecycleState: "ACTIVE", merchantProfile: { kybStatus: "APPROVED" } });
		memberWithScopes([{ scopeType: "ALL_LOCATIONS", locationId: null }]);
	});

	function resolvedMemberAs(role: MembershipRole): void {
		mocks.resolveBySlug.mockResolvedValue({ tenantId: "org-1", slug: "brew", userId: "user-1", membership: { role }, policyVersion: 3 });
	}

	it("returns the server-resolved tenant context when the member holds the capability", async () => {
		resolvedMemberAs("OWNER");

		await expect(service().requireCapabilityForSlug("user-1", "brew", MERCHANT_CAPABILITY.manageVerification)).resolves.toMatchObject({
			tenantId: "org-1",
			slug: "brew",
			policyVersion: 3,
			membership: { role: "OWNER", kybStatus: "APPROVED" },
		});
		expect(mocks.resolveBySlug).toHaveBeenCalledWith("user-1", "brew");
	});

	it("rejects with 403 for a member whose role lacks the capability", async () => {
		resolvedMemberAs("ADMIN");

		await expect(service().requireCapabilityForSlug("user-1", "brew", MERCHANT_CAPABILITY.manageVerification)).rejects.toBeInstanceOf(ForbiddenException);
	});
});

/** A tenant policy that only permits members who reach at least one store. */
const STORE_SCOPED_POLICY = 'permit(principal, action, resource) when { principal.locationScope == "ALL_LOCATIONS" || !principal.locationIds.isEmpty() };';

describe("TenantRewardAuthService.requireCedarAction — the member's REAL location scope reaches Cedar", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		publishTenantPolicy(STORE_SCOPED_POLICY);
		mocks.auditCreate.mockResolvedValue({});
	});

	it("allows an ALL_LOCATIONS member", async () => {
		memberWithScopes([{ scopeType: "ALL_LOCATIONS", locationId: null }]);

		await expect(service().requireCedarAction("user-1", "org-1", "tenant:manage_rewards", "Tenant", "org-1", "OWNER")).resolves.toBeUndefined();
	});

	it("allows a SELECTED member with at least one store", async () => {
		memberWithScopes([{ scopeType: "SELECTED", locationId: "loc-1" }]);

		await expect(service().requireCedarAction("user-1", "org-1", "tenant:manage_rewards", "Tenant", "org-1", "OWNER")).resolves.toBeUndefined();
	});

	it("denies (fail closed) a membership with NO scope rows — it is not treated as ALL_LOCATIONS", async () => {
		memberWithScopes([]);

		await expect(service().requireCedarAction("user-1", "org-1", "tenant:manage_rewards", "Tenant", "org-1", "OWNER")).rejects.toMatchObject({
			response: { error: "TENANT_ACTION_FORBIDDEN" },
		});
		expect(mocks.auditCreate.mock.lastCall).toMatchObject([
			{ data: { action: "authorize.tenant:manage_rewards", decision: "Deny", actorUserId: "user-1", policyVersion: 1 } },
		]);
	});

	it("denies and audits when the caller has no live membership", async () => {
		mocks.membershipFindFirst.mockResolvedValue(null);
		publishTenantPolicy(DEFAULT_TENANT_CEDAR);

		await expect(service().requireCedarAction("user-1", "org-1", "tenant:manage_team", "Tenant", "org-1", "OWNER")).rejects.toBeInstanceOf(ForbiddenException);
		expect(mocks.auditCreate.mock.lastCall).toMatchObject([{ data: { decision: "Deny", tenantId: "org-1", actorUserId: "user-1" } }]);
	});
});
