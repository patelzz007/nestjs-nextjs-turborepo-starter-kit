import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import {
	MERCHANT_CAPABILITY,
	MERCHANT_CAPABILITY_PERMISSION,
	MerchantCapabilitySchema,
	MembershipRoleSchema,
	TENANT_ROLE_TEMPLATES,
	type MerchantCapability,
	type MembershipRole,
	type PermissionPair,
} from "@workspace/shared";

import { createTestPrisma } from "../../../../../../test/support/test-service-graph";
import { createTestPublicUrls } from "../../../../../../test/support/public-urls";
import { TenantTransactionService } from "../../../../../prisma/tenant-transaction.service";
import { RequestContextService } from "../../../../../platform/infrastructure/context/request-context";
import { type AccessControlPort, type AccessDecision, type AccessRequest } from "../../../../authorization/public-api";
import { TenantAuditService } from "../../audit/tenant-audit.adapter";
import { TenantContextService } from "../tenant-context.service";
import { TenantRewardAuthService } from "../tenant-reward-auth.service";

const mocks = vi.hoisted(() => ({
	auditCreate: vi.fn(),
	tenantFindUnique: vi.fn(),
	resolveBySlug: vi.fn(),
}));

// The real access-control service and audit service run on top of this fake transaction client.
vi.mock("../../../../../prisma/tenant-transaction.service", () => ({
	TenantTransactionService: class {
		public readonly withSystemOperation = async <T>(_context: object, work: (tx: object) => Promise<T>): Promise<T> =>
			work({ tenant: { findUnique: mocks.tenantFindUnique } });
		public readonly withTenantTransaction = async <T>(_context: object, work: (tx: object) => Promise<T>): Promise<T> =>
			work({ tenantAuditLog: { create: mocks.auditCreate } });
	},
}));

vi.mock("../tenant-context.service", () => ({
	TenantContextService: class {
		public readonly resolveBySlug = mocks.resolveBySlug;
	},
}));

const NOW = 1_800_000_000_000;
const HOUR_MS = 3_600_000;

/** A grant on top of the role: a permission, until `expiresAt` (`null`: permanent). */
interface Grant {
	readonly permission: PermissionPair;
	readonly expiresAt: number | null;
}

function same(a: PermissionPair, b: PermissionPair): boolean {
	return a.action === b.action && a.resource === b.resource;
}

/**
 * The access decision this service depends on (`AccessControlPort`), faked as the caller's standing:
 * their role's template permissions (the tenant's untouched copy) plus live grants, deny by default.
 * The decision service itself is tested in the authorization context; here the subject is the gate.
 */
class StandingOf implements AccessControlPort {
	public constructor(
		private readonly role: MembershipRole | null,
		private readonly grants: readonly Grant[] = [],
	) {}

	public decide(request: AccessRequest): Promise<AccessDecision> {
		if (this.role !== null && TENANT_ROLE_TEMPLATES[this.role].some((held) => same(held, request.permission))) {
			return Promise.resolve({ allowed: true, path: "role" });
		}
		const granted = this.live().some((permission) => same(permission, request.permission));
		return Promise.resolve(granted && this.role !== null ? { allowed: true, path: "grant" } : { allowed: false, path: null });
	}

	public effectivePermissions(): Promise<readonly PermissionPair[]> {
		return Promise.resolve(this.role === null ? [] : [...TENANT_ROLE_TEMPLATES[this.role], ...this.live()]);
	}

	private live(): readonly PermissionPair[] {
		return this.grants.filter((grant) => grant.expiresAt === null || NOW < grant.expiresAt).map((grant) => grant.permission);
	}
}

function service(standing: AccessControlPort): TenantRewardAuthService {
	const tenantTx = new TenantTransactionService(createTestPrisma(), new RequestContextService());
	const audit = new TenantAuditService();
	return new TenantRewardAuthService(tenantTx, new TenantContextService(tenantTx, createTestPublicUrls()), standing, audit);
}

function subjectFor(role: MembershipRole): { userId: string; tenantId: string; role: MembershipRole } {
	return { userId: "user-1", tenantId: "org-1", role };
}

function holds(role: MembershipRole, permission: PermissionPair): boolean {
	return TENANT_ROLE_TEMPLATES[role].some((held) => held.action === permission.action && held.resource === permission.resource);
}

/**
 * The roles each tenant-management capability allowed BEFORE ADR 067, when the services hard-coded them
 * (`assertCanManageTeam`, `assertCanManageLocations`, `requireOwnerRole`; ADMIN is now MANAGER). The
 * templates must keep exactly these roles — no more, no fewer.
 */
const PRE_MIGRATION_ALLOWED_ROLES: readonly [MerchantCapability, readonly MembershipRole[]][] = [
	[MERCHANT_CAPABILITY.manageTeam, ["OWNER", "MANAGER"]],
	[MERCHANT_CAPABILITY.manageLocations, ["OWNER", "MANAGER"]],
	[MERCHANT_CAPABILITY.manageVerification, ["OWNER"]],
];

const ROLE_CAPABILITY_CASES: readonly [MerchantCapability, MembershipRole, boolean][] = PRE_MIGRATION_ALLOWED_ROLES.flatMap(([capability, allowedRoles]) =>
	MembershipRoleSchema.options.map((role): [MerchantCapability, MembershipRole, boolean] => [capability, role, allowedRoles.includes(role)]),
);

describe("TenantRewardAuthService.requireMembershipCapability", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.auditCreate.mockResolvedValue({});
	});

	it.each(ROLE_CAPABILITY_CASES)("%s for %s → allowed: %s (same roles as the pre-migration role checks)", async (capability, role, allowed) => {
		const check = service(new StandingOf(role)).requireMembershipCapability(subjectFor(role), capability);

		if (allowed) {
			await expect(check).resolves.toBeUndefined();
			expect(mocks.auditCreate.mock.lastCall).toMatchObject([
				{ data: { action: `authorize.${capability}`, decision: "Allow", tenantId: "org-1", metadata: { allowedBy: "role" } } },
			]);
		} else {
			await expect(check).rejects.toMatchObject({ response: { error: "TENANT_ROLE_CAPABILITY_REQUIRED", capability } });
			expect(mocks.auditCreate.mock.lastCall).toMatchObject([{ data: { action: `authorize.${capability}`, decision: "Deny" } }]);
		}
	});

	it("allows exactly what each role's template permission allows, for every capability", async () => {
		const disagreements: string[] = [];
		for (const capability of MerchantCapabilitySchema.options) {
			for (const role of MembershipRoleSchema.options) {
				const allowed = await service(new StandingOf(role))
					.requireMembershipCapability(subjectFor(role), capability)
					.then(() => true)
					.catch(() => false);
				if (allowed !== holds(role, MERCHANT_CAPABILITY_PERMISSION[capability])) {
					disagreements.push(`${role} ${capability}`);
				}
			}
		}
		expect(disagreements).toEqual([]);
	});

	it("lets a live grant add a capability on top of the role, and stops when it expires", async () => {
		const analytics = MERCHANT_CAPABILITY_PERMISSION[MERCHANT_CAPABILITY.viewAnalytics];
		const live = service(new StandingOf("CASHIER", [{ permission: analytics, expiresAt: NOW + 48 * HOUR_MS }]));
		const lapsed = service(new StandingOf("CASHIER", [{ permission: analytics, expiresAt: NOW - HOUR_MS }]));

		await expect(live.requireMembershipCapability(subjectFor("CASHIER"), MERCHANT_CAPABILITY.viewAnalytics)).resolves.toBeUndefined();
		expect(mocks.auditCreate.mock.lastCall).toMatchObject([{ data: { decision: "Allow", metadata: { allowedBy: "grant" } } }]);
		await expect(lapsed.requireMembershipCapability(subjectFor("CASHIER"), MERCHANT_CAPABILITY.viewAnalytics)).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("denies and audits a caller with no active membership", async () => {
		await expect(service(new StandingOf(null)).requireMembershipCapability(subjectFor("OWNER"), MERCHANT_CAPABILITY.manageTeam)).rejects.toBeInstanceOf(ForbiddenException);
		expect(mocks.auditCreate.mock.lastCall).toMatchObject([{ data: { decision: "Deny", tenantId: "org-1", actorUserId: "user-1" } }]);
	});

	it("fails closed for a slug no permission backs", async () => {
		await expect(service(new StandingOf("OWNER")).requireMembershipCapability(subjectFor("OWNER"), "merchant:manage_kyb")).rejects.toMatchObject({
			response: { error: "TENANT_CAPABILITY_UNKNOWN", capability: "merchant:manage_kyb" },
		});
		expect(mocks.auditCreate).not.toHaveBeenCalled();
	});
});

describe("TenantRewardAuthService.requireCapabilityForSlug", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.auditCreate.mockResolvedValue({});
		mocks.tenantFindUnique.mockResolvedValue({ displayName: "Brew", lifecycleState: "ACTIVE", merchantProfile: { kybStatus: "APPROVED" } });
	});

	function resolvedMemberAs(role: MembershipRole): void {
		mocks.resolveBySlug.mockResolvedValue({ tenantId: "org-1", slug: "brew", userId: "user-1", membership: { role } });
	}

	it("returns the server-resolved tenant context, with the member's capabilities, when the member holds the capability", async () => {
		resolvedMemberAs("OWNER");

		await expect(service(new StandingOf("OWNER")).requireCapabilityForSlug("user-1", "brew", MERCHANT_CAPABILITY.manageVerification)).resolves.toMatchObject({
			tenantId: "org-1",
			slug: "brew",
			membership: { role: "OWNER", kybStatus: "APPROVED", capabilities: MerchantCapabilitySchema.options },
		});
		expect(mocks.resolveBySlug).toHaveBeenCalledWith("user-1", "brew");
	});

	it("rejects with 403 for a member whose role lacks the capability", async () => {
		resolvedMemberAs("MANAGER");

		await expect(service(new StandingOf("MANAGER")).requireCapabilityForSlug("user-1", "brew", MERCHANT_CAPABILITY.manageVerification)).rejects.toBeInstanceOf(
			ForbiddenException,
		);
	});
});
