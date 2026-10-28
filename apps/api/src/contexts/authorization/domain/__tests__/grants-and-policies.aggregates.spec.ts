import { describe, expect, it } from "vitest";
import { epochMs, type EpochMs } from "@workspace/shared";

import { SupportAccessGrantAggregate } from "../aggregates/support-access-grant.aggregate";
import { UserAuthorizationAggregate, type UserAuthorizationState } from "../aggregates/user-authorization.aggregate";
import {
	AllowDenyConflictError,
	PermissionOverrideNotFoundError,
	RoleAssignmentNotFoundError,
	RoleLimitExceededError,
	SupportAccessGrantNotPendingError,
	SupportAccessGrantNotRevocableError,
} from "../errors/authorization.errors";
import { MAX_ROLES_PER_USER } from "../rbac-catalog";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";

const NOW: EpochMs = epochMs(1_800_000_000_000);
const MINUTE_MS = 60_000;

function userAuthorization(overrides: Partial<UserAuthorizationState> = {}): UserAuthorizationAggregate {
	return UserAuthorizationAggregate.rehydrate({ userId: "user-1", isSuperAdmin: false, roleIds: ["role-1"], overrides: [], ...overrides });
}

describe("UserAuthorizationAggregate roles", () => {
	it("assigns and unassigns roles, refusing to unassign one the user does not hold", () => {
		const subject = userAuthorization();

		subject.assignRole("role-2", "admin-1");
		subject.unassignRole("role-1");

		expect(subject.assignedRoleIds).toEqual(["role-2"]);
		expect(() => {
			subject.unassignRole("role-1");
		}).toThrow(RoleAssignmentNotFoundError);
		expect(subject.pullChanges().map((change) => change.kind)).toEqual(["role_assigned", "role_unassigned"]);
	});

	it("caps the roles per user, counting a re-assignment once", () => {
		const full = userAuthorization({ roleIds: Array.from({ length: MAX_ROLES_PER_USER }, (_unused, index) => `role-${String(index)}`) });

		expect(() => {
			full.assignRole("role-0", "admin-1");
		}).not.toThrow();
		expect(() => {
			full.assignRole("role-new", "admin-1");
		}).toThrow(RoleLimitExceededError);
	});

	it("syncs roles and reports what was added and removed", () => {
		const subject = userAuthorization({ roleIds: ["role-1", "role-2"] });

		expect(subject.syncRoles(["role-2", "role-3", "role-3"], "admin-1")).toEqual({ added: ["role-3"], removed: ["role-1"] });
		expect(subject.assignedRoleIds).toEqual(["role-2", "role-3"]);
	});

	it("attaches a provisioning role without the per-user cap", () => {
		const full = userAuthorization({ roleIds: Array.from({ length: MAX_ROLES_PER_USER }, (_unused, index) => `role-${String(index)}`) });

		full.attachProvisioningRole("role-owner", "system");

		expect(full.hasRole("role-owner")).toBe(true);
	});
});

describe("UserAuthorizationAggregate direct permissions", () => {
	it("grants an override, keeping the stored id and earlier expiry when none is given", () => {
		const subject = userAuthorization({ overrides: [{ id: "ov-1", permissionId: "perm-1", effect: "ALLOW", expiresAt: NOW }] });

		subject.grantPermission({ permissionId: "perm-1", effect: "DENY", expiresAt: undefined }, "admin-1");

		expect(subject.overridesWithEffect("DENY")).toEqual([{ id: "ov-1", permissionId: "perm-1", effect: "DENY", expiresAt: NOW }]);
	});

	it("revokes an override and refuses an unknown one", () => {
		const subject = userAuthorization({ overrides: [{ id: "ov-1", permissionId: "perm-1", effect: "ALLOW", expiresAt: null }] });

		subject.revokePermission("perm-1");

		expect(() => {
			subject.revokePermission("perm-1");
		}).toThrow(PermissionOverrideNotFoundError);
	});

	it("syncs the ALLOW set, dropping the others, and refuses to ALLOW what is DENIED", () => {
		const subject = userAuthorization({
			overrides: [
				{ id: "ov-1", permissionId: "perm-1", effect: "ALLOW", expiresAt: null },
				{ id: "ov-2", permissionId: "perm-2", effect: "DENY", expiresAt: null },
			],
		});

		expect(() => subject.syncAllowGrants(["perm-2"], "admin-1")).toThrow(AllowDenyConflictError);
		expect(subject.syncAllowGrants(["perm-3"], "admin-1")).toEqual(["perm-1"]);
		expect(subject.overridesWithEffect("ALLOW").map((override) => override.permissionId)).toEqual(["perm-3"]);
		expect(subject.overridesWithEffect("DENY")).toHaveLength(1);
	});

	it("expires stored overrides past their expiry, once", () => {
		const subject = userAuthorization({
			overrides: [
				{ id: "ov-1", permissionId: "perm-1", effect: "ALLOW", expiresAt: epochMs(NOW - 1) },
				{ id: "ov-2", permissionId: "perm-2", effect: "ALLOW", expiresAt: epochMs(NOW + 1) },
			],
		});

		expect(subject.expireOverrides(NOW)).toEqual([{ id: "ov-1", permissionId: "perm-1", effect: "ALLOW", expiresAt: NOW - 1 }]);
		expect(subject.expireOverrides(NOW)).toEqual([]);
		expect(subject.pullChanges()).toEqual([{ kind: "overrides_expired", overrideIds: ["ov-1"], expiredAt: NOW }]);
	});

	it("refuses a corrupt stored row", () => {
		expect(() => userAuthorization({ userId: "" })).toThrow(CorruptAggregateStateError);
	});
});

describe("SupportAccessGrantAggregate", () => {
	function requested(): SupportAccessGrantAggregate {
		return SupportAccessGrantAggregate.request(
			{ id: "grant-1", tenantId: "org-1", supportUserId: "support-1", mode: "READ_ONLY", reason: "ticket #42", ticketRef: "SUP-42", durationMinutes: 30 },
			NOW,
		);
	}

	it("starts pending tenant approval, time-boxed", () => {
		expect(requested().snapshot()).toMatchObject({ status: "PENDING_TENANT_APPROVAL", expiresAt: NOW + 30 * MINUTE_MS, tenantApprovedById: null });
		expect(requested().concurrencyToken).toBe("PENDING_TENANT_APPROVAL");
	});

	it("is approved by someone else before it expires, never by the support user", () => {
		const grant = requested();

		expect(() => {
			grant.approve("support-1", NOW);
		}).toThrow(SupportAccessGrantNotPendingError);
		expect(() => {
			requested().approve("owner-1", epochMs(NOW + 30 * MINUTE_MS));
		}).toThrow(SupportAccessGrantNotPendingError);
		grant.approve("owner-1", NOW);
		expect(grant.snapshot()).toMatchObject({ status: "ACTIVE", tenantApprovedById: "owner-1" });
		expect(() => {
			grant.approve("owner-1", NOW);
		}).toThrow(SupportAccessGrantNotPendingError);
	});

	it("revokes a pending or active grant once", () => {
		const grant = requested();

		grant.revoke(NOW);

		expect(grant.snapshot()).toMatchObject({ status: "REVOKED", revokedAt: NOW });
		expect(() => {
			grant.revoke(NOW);
		}).toThrow(SupportAccessGrantNotRevocableError);
	});
});
