import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import {
	MERCHANT_CAPABILITY,
	MerchantCapabilitySchema,
	merchantRoleHasCapability,
	OrganizationMembershipRoleSchema,
	type MerchantCapability,
	type OrganizationMembershipRole,
} from "@workspace/shared";

import { createTestPrisma } from "../../../../test/support/test-service-graph";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { CedarPolicyEvaluatorService } from "../../authorization-cedar/services/cedar-policy-evaluator.service";
import { MERCHANT_CAPABILITY_CEDAR_ACTIONS } from "../constants/merchant-capability-cedar-actions";
import { REWARDHUB_DEFAULT_TENANT_CEDAR } from "../utils/rewardhub-policy-seed.util";
import { OrganizationAuditService } from "./organization-audit.service";
import { OrganizationContextService } from "./organization-context.service";
import { OrganizationRewardAuthService } from "./organization-reward-auth.service";

const mocks = vi.hoisted(() => ({
	policyFindMany: vi.fn(),
	auditCreate: vi.fn(),
	organizationFindUnique: vi.fn(),
	resolveBySlug: vi.fn(),
}));

// The real Cedar evaluator and audit service run on top of this fake transaction client.
vi.mock("../../../prisma/tenant-transaction.service", () => ({
	TenantTransactionService: class {
		public readonly withSystemOperation = async <T>(_context: object, work: (tx: object) => Promise<T>): Promise<T> =>
			work({ authorizationPolicyVersion: { findMany: mocks.policyFindMany }, organization: { findUnique: mocks.organizationFindUnique } });
		public readonly withTenantTransaction = async <T>(_context: object, work: (tx: object) => Promise<T>): Promise<T> =>
			work({ organizationAuditLog: { create: mocks.auditCreate } });
	},
}));

vi.mock("./organization-context.service", () => ({
	OrganizationContextService: class {
		public readonly resolveBySlug = mocks.resolveBySlug;
	},
}));

const subjectFor = (role: OrganizationMembershipRole): { userId: string; organizationId: string; role: OrganizationMembershipRole } => ({
	userId: "user-1",
	organizationId: "org-1",
	role,
});

function service(): OrganizationRewardAuthService {
	const tenantTx = new TenantTransactionService(createTestPrisma());
	const cedar = new CedarPolicyEvaluatorService(tenantTx);
	const audit = new OrganizationAuditService(tenantTx);
	return new OrganizationRewardAuthService(tenantTx, new OrganizationContextService(tenantTx, cedar, audit), cedar, audit);
}

function publishTenantPolicy(cedarSource: string): void {
	mocks.policyFindMany.mockResolvedValue([{ version: 1, cedarSource }]);
}

/**
 * Roles each organization-management capability allowed BEFORE the capability
 * migration, when the services hard-coded them (`assertCanManageTeam`,
 * `assertCanManageLocations`, `requireOwnerRole`). The capability path must
 * allow exactly these roles — no more, no fewer.
 */
const PRE_MIGRATION_ALLOWED_ROLES: readonly [MerchantCapability, readonly OrganizationMembershipRole[]][] = [
	[MERCHANT_CAPABILITY.manageTeam, ["OWNER", "ADMIN"]],
	[MERCHANT_CAPABILITY.manageLocations, ["OWNER", "ADMIN"]],
	[MERCHANT_CAPABILITY.manageVerification, ["OWNER"]],
];

const ROLE_CAPABILITY_CASES: readonly [MerchantCapability, OrganizationMembershipRole, boolean][] = PRE_MIGRATION_ALLOWED_ROLES.flatMap(([capability, allowedRoles]) =>
	OrganizationMembershipRoleSchema.options.map((role): [MerchantCapability, OrganizationMembershipRole, boolean] => [capability, role, allowedRoles.includes(role)]),
);

describe("OrganizationRewardAuthService.requireMembershipCapability", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		publishTenantPolicy(REWARDHUB_DEFAULT_TENANT_CEDAR);
		mocks.auditCreate.mockResolvedValue({});
	});

	it.each(ROLE_CAPABILITY_CASES)("%s for %s → allowed: %s (same roles as the pre-migration role checks)", async (capability, role, allowed) => {
		const check = service().requireMembershipCapability(subjectFor(role), capability);

		if (allowed) {
			await expect(check).resolves.toBeUndefined();
			expect(mocks.auditCreate.mock.lastCall).toMatchObject([
				{ data: { action: `authorize.${MERCHANT_CAPABILITY_CEDAR_ACTIONS[capability] ?? ""}`, decision: "Allow", organizationId: "org-1" } },
			]);
		} else {
			await expect(check).rejects.toMatchObject({ response: { error: "ORGANIZATION_ROLE_CAPABILITY_REQUIRED", capability } });
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
			for (const role of OrganizationMembershipRoleSchema.options) {
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
			response: { error: "ORGANIZATION_ACTION_FORBIDDEN", action: "rewardhub:manage_team" },
		});
		expect(mocks.auditCreate.mock.lastCall).toMatchObject([{ data: { action: "authorize.rewardhub:manage_team", decision: "Deny" } }]);
	});

	it.each([MERCHANT_CAPABILITY.viewDashboard, MERCHANT_CAPABILITY.viewLocations, "merchant:manage_kyb"])(
		"fails closed for %s, which guards no API action",
		async (capability: string) => {
			await expect(service().requireMembershipCapability(subjectFor("OWNER"), capability)).rejects.toMatchObject({
				response: { error: "ORGANIZATION_CAPABILITY_UNKNOWN", capability },
			});
			expect(mocks.policyFindMany).not.toHaveBeenCalled();
		},
	);
});

describe("OrganizationRewardAuthService.requireCapabilityForSlug", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		publishTenantPolicy(REWARDHUB_DEFAULT_TENANT_CEDAR);
		mocks.auditCreate.mockResolvedValue({});
		mocks.organizationFindUnique.mockResolvedValue({ displayName: "Brew", lifecycleState: "ACTIVE", merchantProfile: { kybStatus: "APPROVED" } });
	});

	function resolvedMemberAs(role: OrganizationMembershipRole): void {
		mocks.resolveBySlug.mockResolvedValue({ organizationId: "org-1", slug: "brew", userId: "user-1", membership: { role }, policyVersion: 3 });
	}

	it("returns the server-resolved organization context when the member holds the capability", async () => {
		resolvedMemberAs("OWNER");

		await expect(service().requireCapabilityForSlug("user-1", "brew", MERCHANT_CAPABILITY.manageVerification)).resolves.toMatchObject({
			organizationId: "org-1",
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
