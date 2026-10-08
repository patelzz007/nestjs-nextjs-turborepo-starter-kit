import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResourceAcl } from "@prisma/client";
import {
	LIST_SLOT_INDEX,
	AuthorizationRowFilterSchema,
	type AuthorizationContext,
	type AuthorizationRequest,
	type PermissionAction,
	type PermissionResource,
	type PermissionScope,
} from "@workspace/shared";

import { createTestAuthorizationKernel } from "../../../../../test/support/test-service-graph";
import { AuthorizationException } from "../../exceptions/authorization.exception";
import type { AuthorizationKernelService } from "../authorization-kernel.service";
import type { PolicyEvaluation } from "../policy-engine.service";
import type { OwnershipLookup } from "../resource-ownership.resolver";
import type { GrantSource, SubjectGrant, SubjectGrants } from "../subject-grants.loader";
import type { TenantVerification } from "../tenant-membership.service";

/**
 * Collaborator mocks, hoisted so the `vi.mock` class factories can reference
 * them. Each collaborator is replaced by a fake class exposing the members the
 * kernel calls; the kernel is built through its real constructor graph
 * (test/support/test-service-graph.ts) — no casts anywhere.
 */
const mocks = vi.hoisted(() => ({
	load: vi.fn(),
	verify: vi.fn(),
	resolveOwner: vi.fn(),
	findApplicable: vi.fn(),
	evaluatePolicies: vi.fn(),
	hasUnconditionalDeny: vi.fn(),
	matchesStoredConditions: vi.fn(),
	auditResult: vi.fn(),
}));

vi.mock("../subject-grants.loader", async (importOriginal) => {
	const original = await importOriginal<typeof import("../subject-grants.loader")>();
	return {
		...original,
		SubjectGrantsLoader: class {
			public readonly load = mocks.load;
		},
	};
});

vi.mock("../tenant-membership.service", () => ({
	TenantMembershipService: class {
		public readonly verify = mocks.verify;
	},
}));

vi.mock("../resource-ownership.resolver", () => ({
	ResourceOwnershipResolver: class {
		public readonly resolve = mocks.resolveOwner;
	},
}));

vi.mock("../acl.service", () => ({
	AclService: class {
		public readonly findApplicable = mocks.findApplicable;
	},
}));

vi.mock("../policy-engine.service", () => ({
	PolicyEngineService: class {
		public readonly evaluate = mocks.evaluatePolicies;
		public readonly hasUnconditionalDeny = mocks.hasUnconditionalDeny;
		public readonly matchesStoredConditions = mocks.matchesStoredConditions;
	},
}));

vi.mock("../authorization-audit-kernel.service", () => ({
	AuthorizationAuditKernelService: class {
		public readonly auditResult = mocks.auditResult;
	},
}));

const USER_ID = "user-123";
const ORG_A = "org-a";
const ORG_B = "org-b";
const LOCATION_A1 = "loc-a1";

function grant(action: PermissionAction, resource: PermissionResource, scope: PermissionScope = "GLOBAL", source: GrantSource = "role"): SubjectGrant {
	return { action, resource, scope, source, sourceId: `${source}-1`, conditions: null };
}

function storeGrant(action: PermissionAction, resource: PermissionResource, storeId: string): SubjectGrant {
	return { action, resource, scope: "STORE", source: "store", sourceId: "sm-1", store: { storeId, organizationId: ORG_A }, conditions: null };
}

function subjectGrants(overrides: Partial<SubjectGrants> = {}): SubjectGrants {
	return { roleIds: ["role-1"], roleNames: ["Manager"], grants: [], denials: [], ...overrides };
}

function tenant(overrides: Partial<TenantVerification> = {}): TenantVerification {
	return { context: {}, organizationRejected: false, storeRejected: false, locationRejected: false, ...overrides };
}

function acl(effect: "ALLOW" | "DENY", resourceId: string | null, id = `acl-${effect}`): ResourceAcl {
	return {
		id,
		subjectType: "USER",
		subjectId: USER_ID,
		action: "DELETE",
		resourceType: "ORDER",
		resourceId,
		effect,
		scope: null,
		organizationId: null,
		locationId: null,
		conditions: null,
		expiresAt: null,
		assignedBy: null,
		reason: null,
		isDeleted: false,
		deletedAt: null,
		createdAt: BigInt(0),
		updatedAt: BigInt(0),
	};
}

const notApplicable: PolicyEvaluation = { decision: "NOT_APPLICABLE", evaluation: [] };

function subject(overrides: Partial<AuthorizationContext> = {}): AuthorizationContext {
	return { userId: USER_ID, isSuperAdmin: false, ...overrides };
}

function request(overrides: Partial<AuthorizationRequest> = {}): AuthorizationRequest {
	return { subject: subject(), action: "READ", resource: "ORDER", ...overrides };
}

function createKernel(): AuthorizationKernelService {
	return createTestAuthorizationKernel();
}

describe("AuthorizationKernelService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.load.mockResolvedValue(subjectGrants());
		mocks.verify.mockResolvedValue(tenant());
		mocks.resolveOwner.mockResolvedValue({ kind: "unsupported" });
		mocks.findApplicable.mockResolvedValue({ denies: [], allows: [] });
		mocks.evaluatePolicies.mockResolvedValue(notApplicable);
		mocks.hasUnconditionalDeny.mockResolvedValue(false);
		mocks.matchesStoredConditions.mockReturnValue(true);
		mocks.auditResult.mockResolvedValue(undefined);
	});

	describe("precedence", () => {
		it("denies by default when the subject holds no grant", async () => {
			const result = await createKernel().explain(request());

			expect(result.decision).toBe("DENY");
			expect(result.evaluation.at(-1)).toEqual(expect.objectContaining({ source: "default", effect: "DENY" }));
		});

		it("allows a SuperAdmin before any other evaluation", async () => {
			const result = await createKernel().explain(request({ subject: subject({ isSuperAdmin: true }) }));

			expect(result.decision).toBe("ALLOW");
			expect(mocks.load).not.toHaveBeenCalled();
			expect(mocks.verify).not.toHaveBeenCalled();
		});

		it("fails closed on unknown actions or resources", async () => {
			const result = await createKernel().explain(request({ action: "ASSUME" }));

			expect(result.decision).toBe("DENY");
			expect(result.evaluation[LIST_SLOT_INDEX.first]).toEqual(expect.objectContaining({ source: "validation" }));
		});

		it("allows a GLOBAL role grant", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("READ", "ORDER")] }));

			expect(await createKernel().can(request())).toBe("ALLOW");
		});

		it("treats MANAGE as every action on the same resource only", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("MANAGE", "ORDER")] }));
			const kernel = createKernel();

			expect(await kernel.can(request({ action: "DELETE" }))).toBe("ALLOW");
			expect(await kernel.can(request({ action: "DELETE", resource: "PAYMENT" }))).toBe("DENY");
		});

		it("a per-user DENY override beats a role grant", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("DELETE", "ORDER")], denials: [grant("DELETE", "ORDER", "GLOBAL", "override")] }));

			const result = await createKernel().explain(request({ action: "DELETE" }));

			expect(result.decision).toBe("DENY");
			expect(result.evaluation.at(-1)).toEqual(expect.objectContaining({ source: "override", effect: "DENY" }));
		});

		it("a DENY override on MANAGE revokes every action on the resource", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("READ", "ORDER")], denials: [grant("MANAGE", "ORDER", "GLOBAL", "override")] }));

			expect(await createKernel().can(request())).toBe("DENY");
		});

		it("ACL DENY beats a role ALLOW", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("DELETE", "ORDER")] }));
			mocks.findApplicable.mockResolvedValue({ denies: [acl("DENY", "order-1")], allows: [] });

			expect(await createKernel().can(request({ action: "DELETE", resourceId: "order-1" }))).toBe("DENY");
		});

		it("ACL DENY beats ownership", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("UPDATE", "URL", "OWN")] }));
			mocks.resolveOwner.mockResolvedValue({ kind: "owned", ownerUserId: USER_ID });
			mocks.findApplicable.mockResolvedValue({ denies: [acl("DENY", "url-1")], allows: [] });

			expect(await createKernel().can(request({ action: "UPDATE", resource: "URL", resourceId: "url-1" }))).toBe("DENY");
		});

		it("ACL ALLOW grants even without a role permission", async () => {
			mocks.findApplicable.mockResolvedValue({ denies: [], allows: [acl("ALLOW", "order-1")] });

			expect(await createKernel().can(request({ action: "DELETE", resourceId: "order-1" }))).toBe("ALLOW");
		});

		it("passes the verified tenant and role ids to the ACL lookup", async () => {
			mocks.verify.mockResolvedValue(tenant({ context: { organizationId: ORG_A } }));

			await createKernel().can(request({ subject: subject({ organizationId: ORG_A }), resourceId: "order-1" }));
			expect(mocks.verify).toHaveBeenCalledWith(USER_ID, { organizationId: ORG_A });

			expect(mocks.findApplicable).toHaveBeenCalledWith(
				expect.objectContaining({ userId: USER_ID, roleIds: ["role-1"], resourceScope: { kind: "resource", id: "order-1" }, organizationId: ORG_A }),
				expect.objectContaining({ action: "READ" }),
			);
		});

		it("a matching DENY policy overrides a satisfied grant", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("UPDATE", "ORDER")] }));
			mocks.evaluatePolicies.mockResolvedValue({ decision: "DENY", evaluation: [{ source: "policy", effect: "DENY", reason: "completed" }] });

			expect(await createKernel().can(request({ action: "UPDATE" }))).toBe("DENY");
		});

		it("unmet permission conditions do not grant", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("READ", "ORDER")] }));
			mocks.matchesStoredConditions.mockReturnValue(false);

			expect(await createKernel().can(request())).toBe("DENY");
		});
	});

	describe("tenant isolation and relationships", () => {
		it("rejects a claimed organization the subject is not a member of (forged tenant id)", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("READ", "ORDER")] }));
			mocks.verify.mockResolvedValue(tenant({ organizationRejected: true }));

			const result = await createKernel().explain(request({ subject: subject({ organizationId: ORG_B }) }));

			expect(result.decision).toBe("DENY");
			expect(result.evaluation.at(-1)).toEqual(expect.objectContaining({ source: "tenant", effect: "DENY" }));
			expect(mocks.load).not.toHaveBeenCalled();
		});

		it("rejects a location outside the membership scope", async () => {
			mocks.verify.mockResolvedValue(tenant({ context: { organizationId: ORG_A }, locationRejected: true }));

			expect(await createKernel().can(request({ subject: subject({ organizationId: ORG_A, locationId: "loc-x" }) }))).toBe("DENY");
		});

		it("organization membership alone never grants a permission", async () => {
			mocks.verify.mockResolvedValue(tenant({ context: { organizationId: ORG_A } }));

			for (const action of ["READ", "UPDATE", "DELETE", "MANAGE"] satisfies PermissionAction[]) {
				expect(await createKernel().can(request({ action, subject: subject({ organizationId: ORG_A }) }))).toBe("DENY");
			}
		});

		it("ORGANIZATION grants require a verified organization", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("READ", "ORDER", "ORGANIZATION")] }));

			expect(await createKernel().can(request())).toBe("DENY");
		});

		it("ORGANIZATION grants allow same-organization resources", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("UPDATE", "ORDER", "ORGANIZATION")] }));
			mocks.verify.mockResolvedValue(tenant({ context: { organizationId: ORG_A } }));

			const decision = await createKernel().can(
				request({ action: "UPDATE", subject: subject({ organizationId: ORG_A }), resourceId: "order-1", resourceAttributes: { organizationId: ORG_A } }),
			);

			expect(decision).toBe("ALLOW");
		});

		it.each(["READ", "UPDATE", "DELETE", "LIST", "CREATE"] satisfies PermissionAction[])("ORGANIZATION grants deny cross-tenant %s", async (action) => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant(action, "ORDER", "ORGANIZATION")] }));
			mocks.verify.mockResolvedValue(tenant({ context: { organizationId: ORG_A } }));

			const decision = await createKernel().can(
				request({ action, subject: subject({ organizationId: ORG_A }), resourceId: "order-b", resourceAttributes: { organizationId: ORG_B } }),
			);

			expect(decision).toBe("DENY");
		});

		it("ORGANIZATION grants deny a specific resource whose organization is unknown", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("READ", "ORDER", "ORGANIZATION")] }));
			mocks.verify.mockResolvedValue(tenant({ context: { organizationId: ORG_A } }));

			expect(await createKernel().can(request({ subject: subject({ organizationId: ORG_A }), resourceId: "order-1" }))).toBe("DENY");
		});

		it("LOCATION grants apply only inside the verified location", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("READ", "ORDER", "LOCATION")] }));
			mocks.verify.mockResolvedValue(tenant({ context: { organizationId: ORG_A, locationId: LOCATION_A1 } }));
			const kernel = createKernel();
			const scoped = subject({ organizationId: ORG_A, locationId: LOCATION_A1 });

			expect(await kernel.can(request({ subject: scoped, resourceId: "o1", resourceAttributes: { organizationId: ORG_A, locationId: LOCATION_A1 } }))).toBe("ALLOW");
			expect(await kernel.can(request({ subject: scoped, resourceId: "o2", resourceAttributes: { organizationId: ORG_A, locationId: "loc-a2" } }))).toBe("DENY");
		});
	});

	describe("stores (STORE scope)", () => {
		const inStore = (storeId: string): AuthorizationContext => subject({ organizationId: ORG_A, storeId });

		it("forwards the requested store to tenant verification and rejects a forged store", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [storeGrant("READ", "REWARD", "store-1")] }));
			mocks.verify.mockResolvedValue(tenant({ context: { organizationId: ORG_A }, storeRejected: true }));

			const result = await createKernel().explain(request({ resource: "REWARD", subject: inStore("store-9") }));

			expect(mocks.verify).toHaveBeenCalledWith(USER_ID, { organizationId: ORG_A, storeId: "store-9" });
			expect(result.decision).toBe("DENY");
			expect(result.evaluation.at(-1)).toEqual(expect.objectContaining({ source: "tenant" }));
		});

		it("allows a store-membership grant only inside its own store", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [storeGrant("CREATE", "REDEMPTION", "store-1")] }));
			const kernel = createKernel();

			mocks.verify.mockResolvedValue(tenant({ context: { organizationId: ORG_A, storeId: "store-1" } }));
			expect(await kernel.can(request({ action: "CREATE", resource: "REDEMPTION", subject: inStore("store-1") }))).toBe("ALLOW");

			mocks.verify.mockResolvedValue(tenant({ context: { organizationId: ORG_A, storeId: "store-2" } }));
			expect(await kernel.can(request({ action: "CREATE", resource: "REDEMPTION", subject: inStore("store-2") }))).toBe("DENY");
		});

		it("never applies a store grant without a verified store context", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [storeGrant("READ", "REWARD", "store-1")] }));

			expect(await createKernel().can(request({ resource: "REWARD" }))).toBe("DENY");
		});

		it("denies a store resource belonging to another store", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [storeGrant("READ", "REWARD", "store-1")] }));
			mocks.verify.mockResolvedValue(tenant({ context: { organizationId: ORG_A, storeId: "store-1" } }));
			const kernel = createKernel();

			expect(await kernel.can(request({ resource: "REWARD", subject: inStore("store-1"), resourceId: "r1", resourceAttributes: { storeId: "store-1" } }))).toBe("ALLOW");
			expect(await kernel.can(request({ resource: "REWARD", subject: inStore("store-1"), resourceId: "r2", resourceAttributes: { storeId: "store-2" } }))).toBe("DENY");
			expect(await kernel.can(request({ resource: "REWARD", subject: inStore("store-1"), resourceId: "r3" }))).toBe("DENY");
		});

		it("filters rows to the member's stores", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [storeGrant("LIST", "REDEMPTION", "store-1"), storeGrant("LIST", "REDEMPTION", "store-2")] }));
			const kernel = createKernel();

			const everyStore = await kernel.filter(subject(), "LIST", "REDEMPTION");
			expect(everyStore).toEqual({
				OR: [
					{ organizationId: ORG_A, storeId: "store-1" },
					{ organizationId: ORG_A, storeId: "store-2" },
				],
			});
			expect(AuthorizationRowFilterSchema.safeParse(everyStore).success).toBe(true);

			mocks.verify.mockResolvedValue(tenant({ context: { organizationId: ORG_A, storeId: "store-2" } }));
			expect(await kernel.filter(inStore("store-2"), "LIST", "REDEMPTION")).toEqual({ organizationId: ORG_A, storeId: "store-2" });
		});
	});

	describe("ownership (OWN scope)", () => {
		it("allows the owner", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("UPDATE", "URL", "OWN")] }));
			mocks.resolveOwner.mockResolvedValue({ kind: "owned", ownerUserId: USER_ID });

			expect(await createKernel().can(request({ action: "UPDATE", resource: "URL", resourceId: "url-1" }))).toBe("ALLOW");
		});

		it.each<[string, OwnershipLookup]>([
			["another owner", { kind: "owned", ownerUserId: "someone-else" }],
			["a missing resource", { kind: "missing" }],
			["a type without ownership", { kind: "unsupported" }],
		])("denies %s", async (_label, lookup) => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("UPDATE", "URL", "OWN")] }));
			mocks.resolveOwner.mockResolvedValue(lookup);

			expect(await createKernel().can(request({ action: "UPDATE", resource: "URL", resourceId: "url-1" }))).toBe("DENY");
		});

		it("OWN grants never satisfy a collection-level check", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("READ", "URL", "OWN")] }));

			expect(await createKernel().can(request({ resource: "URL" }))).toBe("DENY");
		});

		it("ownership only grants the actions of the OWN grant (owners cannot DELETE by default)", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("UPDATE", "USER", "OWN", "implicit")] }));
			mocks.resolveOwner.mockResolvedValue({ kind: "owned", ownerUserId: USER_ID });
			const kernel = createKernel();

			expect(await kernel.can(request({ action: "UPDATE", resource: "USER", resourceId: USER_ID }))).toBe("ALLOW");
			expect(await kernel.can(request({ action: "DELETE", resource: "USER", resourceId: USER_ID }))).toBe("DENY");
		});

		it("RESOURCE-scoped grants only apply through ACL entries", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("READ", "ORDER", "RESOURCE")] }));

			expect(await createKernel().can(request({ resourceId: "order-1" }))).toBe("DENY");
		});
	});

	describe("authorize()", () => {
		it("throws the uniform 403 and audits the denial", async () => {
			await expect(createKernel().authorize(request({ action: "DELETE" }), { requestId: "req-1" })).rejects.toBeInstanceOf(AuthorizationException);
			expect(mocks.auditResult).toHaveBeenCalledWith(expect.objectContaining({ decision: "DENY" }), { requestId: "req-1" });
		});

		it("resolves and audits allowed decisions", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("DELETE", "ORDER")] }));

			await expect(createKernel().authorize(request({ action: "DELETE" }))).resolves.toBeUndefined();
			expect(mocks.auditResult).toHaveBeenCalledWith(expect.objectContaining({ decision: "ALLOW" }), undefined);
		});
	});

	describe("filter()", () => {
		const context = subject({ organizationId: ORG_A });

		it("returns no restriction for SuperAdmin", async () => {
			expect(await createKernel().filter(subject({ isSuperAdmin: true }), "READ", "ORDER")).toEqual({});
		});

		it("matches no rows without a grant (default deny)", async () => {
			const filter = await createKernel().filter(context, "READ", "ORDER");

			expect(filter).toEqual({ id: { in: [] } });
			expect(AuthorizationRowFilterSchema.safeParse(filter).success).toBe(true);
		});

		it("matches no rows for a forged organization", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("READ", "ORDER")] }));
			mocks.verify.mockResolvedValue(tenant({ organizationRejected: true }));

			expect(await createKernel().filter(context, "READ", "ORDER")).toEqual({ id: { in: [] } });
		});

		it("is unrestricted for a GLOBAL grant", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("READ", "ORDER")] }));

			expect(await createKernel().filter(context, "READ", "ORDER")).toEqual({});
		});

		it("scopes ORGANIZATION grants to the verified organization", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("READ", "ORDER", "ORGANIZATION")] }));
			mocks.verify.mockResolvedValue(tenant({ context: { organizationId: ORG_A } }));

			expect(await createKernel().filter(context, "READ", "ORDER")).toEqual({ organizationId: ORG_A });
		});

		it("combines tenant and ownership alternatives with OR", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("READ", "URL", "ORGANIZATION"), grant("READ", "URL", "OWN")] }));
			mocks.verify.mockResolvedValue(tenant({ context: { organizationId: ORG_A } }));

			const filter = await createKernel().filter(context, "READ", "URL");

			expect(filter).toEqual({ OR: [{ organizationId: ORG_A }, { userId: USER_ID }] });
			expect(AuthorizationRowFilterSchema.safeParse(filter).success).toBe(true);
		});

		it("uses the primary key for implicit own-user grants", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("READ", "USER", "OWN", "implicit")] }));

			expect(await createKernel().filter(subject(), "READ", "USER")).toEqual({ id: { in: [USER_ID] } });
		});

		it("applies ACL allow-lists and explicit resource denials", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("READ", "ORDER", "ORGANIZATION")] }));
			mocks.verify.mockResolvedValue(tenant({ context: { organizationId: ORG_A } }));
			mocks.findApplicable.mockResolvedValue({ denies: [acl("DENY", "order-9")], allows: [acl("ALLOW", "order-7")] });

			const filter = await createKernel().filter(context, "READ", "ORDER");

			expect(filter).toEqual({ AND: [{ OR: [{ organizationId: ORG_A }, { id: { in: ["order-7"] } }] }, { NOT: { id: { in: ["order-9"] } } }] });
			expect(AuthorizationRowFilterSchema.safeParse(filter).success).toBe(true);
		});

		it("a type-wide ACL DENY or DENY override removes every row", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("READ", "ORDER")] }));
			mocks.findApplicable.mockResolvedValue({ denies: [acl("DENY", null)], allows: [] });
			expect(await createKernel().filter(context, "READ", "ORDER")).toEqual({ id: { in: [] } });

			mocks.findApplicable.mockResolvedValue({ denies: [], allows: [] });
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("READ", "ORDER")], denials: [grant("READ", "ORDER", "GLOBAL", "override")] }));
			expect(await createKernel().filter(context, "READ", "ORDER")).toEqual({ id: { in: [] } });
		});

		it("an unconditional DENY policy removes every row", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("READ", "ORDER")] }));
			mocks.hasUnconditionalDeny.mockResolvedValue(true);

			expect(await createKernel().filter(context, "READ", "ORDER")).toEqual({ id: { in: [] } });
		});
	});

	describe("resourceCapabilities() and hasRoles()", () => {
		it("maps each action to a server-evaluated boolean", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ grants: [grant("READ", "ORDER"), grant("UPDATE", "ORDER")] }));

			const capabilities = await createKernel().resourceCapabilities(subject(), "ORDER", "order-1", undefined, ["READ", "UPDATE", "DELETE"]);

			expect(capabilities).toEqual({ can: { read: true, update: true, delete: false } });
		});

		it("evaluates role requirements with all/any semantics", async () => {
			mocks.load.mockResolvedValue(subjectGrants({ roleNames: ["Manager", "Auditor"] }));
			const kernel = createKernel();

			expect(await kernel.hasRoles(USER_ID, ["Manager", "Auditor"], "all")).toBe(true);
			expect(await kernel.hasRoles(USER_ID, ["Manager", "Admin"], "all")).toBe(false);
			expect(await kernel.hasRoles(USER_ID, ["Admin", "Auditor"], "any")).toBe(true);
			expect(await kernel.hasRoles(USER_ID, [], "any")).toBe(false);
		});
	});
});
