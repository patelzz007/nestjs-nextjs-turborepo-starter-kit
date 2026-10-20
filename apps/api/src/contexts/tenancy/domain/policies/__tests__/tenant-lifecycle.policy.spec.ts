import { describe, expect, it } from "vitest";

import { decideTenantLifecycle, type TenantLifecycleCheck } from "../tenant-lifecycle.policy";

function check(overrides: Partial<TenantLifecycleCheck> & Pick<TenantLifecycleCheck, "lifecycleState" | "route" | "membershipStatus">): TenantLifecycleCheck {
	return { isDeleted: false, ...overrides };
}

describe("decideTenantLifecycle", () => {
	it("allows an active member on an active or restricted tenant", () => {
		expect(decideTenantLifecycle(check({ lifecycleState: "ACTIVE", route: "ordinary", membershipStatus: "ACTIVE" }))).toEqual({ kind: "allow" });
		expect(decideTenantLifecycle(check({ lifecycleState: "RESTRICTED", route: "ordinary", membershipStatus: "ACTIVE" }))).toEqual({ kind: "allow" });
	});

	it("rejects a suspended tenant on an ordinary route and allows it on a lifecycle route", () => {
		expect(decideTenantLifecycle(check({ lifecycleState: "SUSPENDED", route: "ordinary", membershipStatus: "ACTIVE" }))).toEqual({ kind: "tenant_suspended" });
		expect(decideTenantLifecycle(check({ lifecycleState: "SUSPENDED", route: "lifecycle", membershipStatus: "ACTIVE" }))).toEqual({ kind: "allow" });
	});

	it("rejects provisioning and pending deletion on ordinary routes and allows them on lifecycle routes", () => {
		expect(decideTenantLifecycle(check({ lifecycleState: "PROVISIONING", route: "ordinary", membershipStatus: "ACTIVE" }))).toEqual({ kind: "tenant_not_active" });
		expect(decideTenantLifecycle(check({ lifecycleState: "PENDING_DELETION", route: "ordinary", membershipStatus: "ACTIVE" }))).toEqual({ kind: "tenant_not_active" });
		expect(decideTenantLifecycle(check({ lifecycleState: "PROVISIONING", route: "lifecycle", membershipStatus: "ACTIVE" }))).toEqual({ kind: "allow" });
		expect(decideTenantLifecycle(check({ lifecycleState: "PENDING_DELETION", route: "leave", membershipStatus: "ACTIVE" }))).toEqual({ kind: "allow" });
	});

	it("answers not found for a deleted tenant on every route", () => {
		expect(decideTenantLifecycle(check({ lifecycleState: "DELETED", route: "lifecycle", membershipStatus: "ACTIVE" }))).toEqual({ kind: "not_found" });
		expect(decideTenantLifecycle(check({ lifecycleState: "ACTIVE", route: "ordinary", membershipStatus: "ACTIVE", isDeleted: true }))).toEqual({ kind: "not_found" });
	});

	it("rejects a suspended or pending membership except when leaving", () => {
		expect(decideTenantLifecycle(check({ lifecycleState: "ACTIVE", route: "lifecycle", membershipStatus: "SUSPENDED" }))).toEqual({ kind: "membership_inactive" });
		expect(decideTenantLifecycle(check({ lifecycleState: "ACTIVE", route: "ordinary", membershipStatus: "PENDING" }))).toEqual({ kind: "membership_inactive" });
		expect(decideTenantLifecycle(check({ lifecycleState: "ACTIVE", route: "leave", membershipStatus: "SUSPENDED" }))).toEqual({ kind: "allow" });
	});

	it("does not describe the tenant to a caller with no membership", () => {
		expect(decideTenantLifecycle(check({ lifecycleState: "SUSPENDED", route: "ordinary", membershipStatus: "none" }))).toEqual({ kind: "no_membership" });
		expect(decideTenantLifecycle(check({ lifecycleState: "DELETED", route: "ordinary", membershipStatus: "none" }))).toEqual({ kind: "not_found" });
	});
});
