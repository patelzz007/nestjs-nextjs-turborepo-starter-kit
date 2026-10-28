import { beforeEach, describe, expect, it, vi } from "vitest";
import { epochMs, type AuthorizationContext, type AuthorizationRequest, type PermissionPair } from "@workspace/shared";

import { createTestAuthorizationKernel } from "../../../../../../test/support/test-service-graph";
import type { AccessFacts } from "../../../domain/access/access-facts";
import { StoreScope } from "../../../domain/access/store-scope";
import { AccessDeniedError } from "../../../domain/errors/authorization.errors";
import type { AuthorizationKernelService } from "../authorization-kernel.service";
import type { TenantVerification } from "../tenant-membership.service";

/**
 * The kernel is a FACADE (ADR 067): tenant verification → `AccessControlService` → an audited result.
 * Its I/O collaborators are faked — the tenant verification, the caller's standing (facts) and the
 * record-owner lookup — while the decision service and every allow path run for real, built through
 * the real constructor graph (test/support/test-service-graph.ts).
 */
const mocks = vi.hoisted(() => ({
	verify: vi.fn(),
	readFacts: vi.fn(),
	ownerOf: vi.fn(),
	auditResult: vi.fn(),
}));

vi.mock("../tenant-membership.service", () => ({
	TenantMembershipService: class {
		public readonly verify = mocks.verify;
	},
}));

vi.mock("../../access/prisma-access-facts.reader", () => ({
	PrismaAccessFactsReader: class {
		public readonly read = mocks.readFacts;
	},
}));

vi.mock("../../access/prisma-record-ownership", () => ({
	PrismaRecordOwnership: class {
		public readonly ownerOf = mocks.ownerOf;
	},
}));

vi.mock("../authorization-audit-kernel.service", () => ({
	AuthorizationAuditKernelService: class {
		public readonly auditResult = mocks.auditResult;
	},
}));

const USER_ID = "user-123";
const ORG_A = "org-a";
const STORE_1 = "store-1";
const STORE_2 = "store-2";
/** `FixedClock`'s default now (the test graph's clock). */
const NOW = 1_800_000_000_000;
const HOUR_MS = 3_600_000;

const READ_REWARD: PermissionPair = { action: "READ", resource: "REWARD" };

function facts(overrides: Partial<AccessFacts> = {}): AccessFacts {
	return { rolePermissions: [], stores: StoreScope.all(), grants: [], shares: [], ...overrides };
}

function tenant(overrides: Partial<TenantVerification> = {}): TenantVerification {
	return { context: {}, target: null, tenantRejected: false, locationRejected: false, ...overrides };
}

function memberOf(tenantId: string): TenantVerification {
	return tenant({ context: { tenantId }, target: { tenantId, lifecycleState: "ACTIVE", membershipStatus: "ACTIVE" } });
}

function subject(overrides: Partial<AuthorizationContext> = {}): AuthorizationContext {
	return { userId: USER_ID, isSuperAdmin: false, ...overrides };
}

function request(overrides: Partial<AuthorizationRequest> = {}): AuthorizationRequest {
	return { subject: subject(), action: "READ", resource: "REWARD", ...overrides };
}

function tenantRequest(overrides: Partial<AuthorizationRequest> = {}): AuthorizationRequest {
	return request({ subject: subject({ tenantId: ORG_A }), ...overrides });
}

function createKernel(): AuthorizationKernelService {
	return createTestAuthorizationKernel();
}

describe("AuthorizationKernelService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.verify.mockResolvedValue(tenant());
		mocks.readFacts.mockResolvedValue(facts());
		mocks.ownerOf.mockResolvedValue(null);
		mocks.auditResult.mockResolvedValue(undefined);
	});

	describe("deny by default, then the four allow paths", () => {
		it("denies by default when nothing allows, naming the default step", async () => {
			const result = await createKernel().explain(request());

			expect(result.decision).toBe("DENY");
			expect(result.evaluation.at(-1)).toMatchObject({ source: "default", effect: "DENY" });
		});

		it("allows a SuperAdmin with no tenant before any other evaluation", async () => {
			expect(await createKernel().can(request({ subject: subject({ isSuperAdmin: true }), action: "DELETE" }))).toBe("ALLOW");
			expect(mocks.readFacts).not.toHaveBeenCalled();
		});

		it("does not bypass a SuperAdmin who names a tenant: the tenant decides", async () => {
			mocks.verify.mockResolvedValue(tenant({ tenantRejected: true }));

			expect(await createKernel().can(request({ subject: subject({ isSuperAdmin: true, tenantId: ORG_A }) }))).toBe("DENY");
		});

		it("fails closed on an unknown action or resource", async () => {
			expect(await createKernel().can(request({ action: "FROBNICATE" }))).toBe("DENY");
			expect(mocks.readFacts).not.toHaveBeenCalled();
		});

		it("allows through the role and records the path", async () => {
			mocks.verify.mockResolvedValue(memberOf(ORG_A));
			mocks.readFacts.mockResolvedValue(facts({ rolePermissions: [READ_REWARD] }));

			const result = await createKernel().explain(tenantRequest());

			expect(result.decision).toBe("ALLOW");
			expect(result.evaluation.at(-1)).toMatchObject({ source: "role", effect: "ALLOW" });
			expect(mocks.readFacts).toHaveBeenCalledWith(USER_ID, ORG_A);
		});

		it("allows through a live grant on top of the role, and not once it has expired", async () => {
			mocks.verify.mockResolvedValue(memberOf(ORG_A));
			mocks.readFacts.mockResolvedValueOnce(facts({ grants: [{ permission: READ_REWARD, locationId: null, expiresAt: epochMs(NOW + 48 * HOUR_MS) }] }));
			mocks.readFacts.mockResolvedValueOnce(facts({ grants: [{ permission: READ_REWARD, locationId: null, expiresAt: epochMs(NOW - HOUR_MS) }] }));
			const kernel = createKernel();

			expect((await kernel.explain(tenantRequest())).evaluation.at(-1)).toMatchObject({ source: "grant", effect: "ALLOW" });
			expect(await kernel.can(tenantRequest())).toBe("DENY");
		});

		it("allows through a share for that one record only", async () => {
			mocks.verify.mockResolvedValue(memberOf(ORG_A));
			mocks.readFacts.mockResolvedValue(facts({ shares: [{ resource: "REWARD", resourceId: "reward-1", level: "VIEW", expiresAt: null }] }));
			const kernel = createKernel();

			expect((await kernel.explain(tenantRequest({ resourceId: "reward-1" }))).evaluation.at(-1)).toMatchObject({ source: "share", effect: "ALLOW" });
			expect(await kernel.can(tenantRequest({ resourceId: "reward-2" }))).toBe("DENY");
			expect(await kernel.can(tenantRequest({ action: "UPDATE", resourceId: "reward-1" }))).toBe("DENY");
		});

		it("allows the owner to read and update their own record, never delete it", async () => {
			mocks.ownerOf.mockResolvedValue(USER_ID);
			const kernel = createKernel();

			expect((await kernel.explain(request({ resource: "PROFILE", resourceId: "profile-1" }))).evaluation.at(-1)).toMatchObject({ source: "ownership" });
			expect(await kernel.can(request({ action: "UPDATE", resource: "PROFILE", resourceId: "profile-1" }))).toBe("ALLOW");
			expect(await kernel.can(request({ action: "DELETE", resource: "PROFILE", resourceId: "profile-1" }))).toBe("DENY");
		});

		it("never lets user A reach user B's record", async () => {
			mocks.ownerOf.mockResolvedValue("user-b");

			expect(await createKernel().can(request({ resource: "PROFILE", resourceId: "profile-b" }))).toBe("DENY");
		});
	});

	describe("tenant isolation and stores", () => {
		it("rejects a claimed tenant the subject is not a member of (a forged tenant id) before any decision", async () => {
			mocks.verify.mockResolvedValue(tenant({ tenantRejected: true }));

			const result = await createKernel().explain(tenantRequest());

			expect(result.decision).toBe("DENY");
			expect(result.evaluation).toEqual([expect.objectContaining({ source: "tenant", effect: "DENY" })]);
			expect(mocks.readFacts).not.toHaveBeenCalled();
		});

		it("rejects a location outside the membership's stores", async () => {
			mocks.verify.mockResolvedValue(tenant({ locationRejected: true }));

			expect(await createKernel().can(request({ subject: subject({ locationId: STORE_2 }) }))).toBe("DENY");
		});

		it("never grants a permission for membership alone", async () => {
			mocks.verify.mockResolvedValue(memberOf(ORG_A));

			expect(await createKernel().can(tenantRequest())).toBe("DENY");
		});

		it("decides a tenant request with no active membership as denied (no standing)", async () => {
			mocks.verify.mockResolvedValue(memberOf(ORG_A));
			mocks.readFacts.mockResolvedValue(null);

			expect(await createKernel().can(tenantRequest())).toBe("DENY");
		});

		it("limits a role to the member's stores, read from the record's server-side store attribute", async () => {
			mocks.verify.mockResolvedValue(memberOf(ORG_A));
			mocks.readFacts.mockResolvedValue(facts({ rolePermissions: [READ_REWARD], stores: StoreScope.of([STORE_1]) }));
			const kernel = createKernel();

			expect(await kernel.can(tenantRequest({ resourceId: "r-1", resourceAttributes: { locationId: STORE_1 } }))).toBe("ALLOW");
			expect(await kernel.can(tenantRequest({ resourceId: "r-2", resourceAttributes: { locationId: STORE_2 } }))).toBe("DENY");
		});

		it("lets a store-limited grant reach only that store (grant ∩ membership)", async () => {
			mocks.verify.mockResolvedValue(memberOf(ORG_A));
			mocks.readFacts.mockResolvedValue(facts({ grants: [{ permission: READ_REWARD, locationId: STORE_1, expiresAt: null }] }));
			const kernel = createKernel();

			expect(await kernel.can(tenantRequest({ resourceId: "r-1", resourceAttributes: { locationId: STORE_1 } }))).toBe("ALLOW");
			expect(await kernel.can(tenantRequest({ resourceId: "r-2", resourceAttributes: { locationId: STORE_2 } }))).toBe("DENY");
			expect(await kernel.can(tenantRequest())).toBe("DENY");
		});
	});

	describe("authorize()", () => {
		it("throws the uniform 403 and audits the denial", async () => {
			await expect(createKernel().authorize(request({ action: "DELETE" }), { requestId: "req-1" })).rejects.toBeInstanceOf(AccessDeniedError);
			expect(mocks.auditResult).toHaveBeenCalledWith(expect.objectContaining({ decision: "DENY" }), { requestId: "req-1" });
		});

		it("resolves and audits allowed decisions", async () => {
			mocks.readFacts.mockResolvedValue(facts({ rolePermissions: [{ action: "DELETE", resource: "REWARD" }] }));

			await expect(createKernel().authorize(request({ action: "DELETE" }))).resolves.toBeUndefined();
			expect(mocks.auditResult).toHaveBeenCalledWith(expect.objectContaining({ decision: "ALLOW" }), undefined);
		});
	});
});
