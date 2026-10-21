import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { Membership } from "../aggregates/membership.aggregate";
import { SuspensionAppeal } from "../aggregates/suspension-appeal.aggregate";
import { Tenant } from "../aggregates/tenant.aggregate";
import { TenantAppealNotPendingError, TenantDeletionGraceOverError, TenantLifecycleTransitionError, TenantOwnerCannotLeaveError } from "../errors/tenants.errors";

const NOW = epochMs(1_792_368_000_000);
const LATER = epochMs(NOW + 60_000);
const ADMIN = "admin-1";
const OWNER = "owner-1";

function tenant(lifecycleState: string, deletionGraceEndsAt: number | null = null): Tenant {
	return Tenant.rehydrate({
		id: "tenant-1",
		slug: "brew",
		displayName: "Brew",
		lifecycleState,
		deletionGraceEndsAt: deletionGraceEndsAt === null ? null : epochMs(deletionGraceEndsAt),
	});
}

describe("Tenant lifecycle transitions (MT-23)", () => {
	it.each(["ACTIVE", "RESTRICTED"])("suspends a %s tenant with the admin and reason on the lifecycle event", (state) => {
		const subject = tenant(state);

		subject.suspend(ADMIN, "  Chargebacks  ", NOW);

		expect(subject.lifecycleState).toBe("SUSPENDED");
		expect(subject.pendingTransitions).toEqual([{ from: state, to: "SUSPENDED", actorUserId: ADMIN, reason: "Chargebacks" }]);
		expect(subject.pullEvents()).toEqual([expect.objectContaining({ from: state, to: "SUSPENDED" })]);
	});

	it.each(["PROVISIONING", "SUSPENDED", "PENDING_DELETION"])("refuses to suspend a %s tenant", (state) => {
		expect(() => {
			tenant(state).suspend(ADMIN, "x", NOW);
		}).toThrow(TenantLifecycleTransitionError);
	});

	it("reinstates only a suspended tenant, and only a suspended tenant may appeal", () => {
		const suspended = tenant("SUSPENDED");
		suspended.assertAppealable();
		suspended.reinstate(ADMIN, "Appeal accepted", NOW);
		expect(suspended.lifecycleState).toBe("ACTIVE");

		expect(() => {
			tenant("ACTIVE").reinstate(ADMIN, "x", NOW);
		}).toThrow(TenantLifecycleTransitionError);
		expect(() => {
			tenant("ACTIVE").assertAppealable();
		}).toThrow(TenantLifecycleTransitionError);
	});

	it.each(["ACTIVE", "RESTRICTED", "SUSPENDED"])("bans a %s tenant with the admin and reason on the lifecycle event", (state) => {
		const subject = tenant(state);

		subject.ban(ADMIN, "  Counterfeit vouchers  ", NOW);

		expect(subject.lifecycleState).toBe("BANNED");
		expect(subject.pendingTransitions).toEqual([{ from: state, to: "BANNED", actorUserId: ADMIN, reason: "Counterfeit vouchers" }]);
		expect(subject.pullEvents()).toEqual([expect.objectContaining({ from: state, to: "BANNED" })]);
	});

	it.each(["PROVISIONING", "BANNED", "PENDING_DELETION"])("refuses to ban a %s tenant", (state) => {
		expect(() => {
			tenant(state).ban(ADMIN, "x", NOW);
		}).toThrow(TenantLifecycleTransitionError);
	});

	it("lifts only a ban, and a banned tenant can neither appeal, be reinstated nor be reactivated by its owner", () => {
		const banned = tenant("BANNED");
		expect(() => {
			banned.assertAppealable();
		}).toThrow(TenantLifecycleTransitionError);
		expect(() => {
			banned.reinstate(ADMIN, "x", NOW);
		}).toThrow(TenantLifecycleTransitionError);
		expect(() => {
			banned.reactivate(OWNER, NOW);
		}).toThrow(TenantLifecycleTransitionError);

		banned.unban(ADMIN, "  Cleared  ", NOW);
		expect(banned.lifecycleState).toBe("ACTIVE");
		expect(banned.pendingTransitions).toEqual([{ from: "BANNED", to: "ACTIVE", actorUserId: ADMIN, reason: "Cleared" }]);
		expect(() => {
			tenant("SUSPENDED").unban(ADMIN, "x", NOW);
		}).toThrow(TenantLifecycleTransitionError);
	});

	it("reactivates a tenant pending deletion while the grace period runs, clearing it", () => {
		const subject = tenant("PENDING_DELETION", LATER);

		subject.reactivate(OWNER, NOW);

		expect(subject.lifecycleState).toBe("ACTIVE");
		expect(subject.deletionGraceEndsAt).toBeNull();
		expect(subject.pendingTransitions).toEqual([{ from: "PENDING_DELETION", to: "ACTIVE", actorUserId: OWNER, reason: "The owner cancelled the deletion" }]);
	});

	it("refuses to reactivate once the grace period is over, or a tenant that is not pending deletion", () => {
		expect(() => {
			tenant("PENDING_DELETION", NOW).reactivate(OWNER, NOW);
		}).toThrow(TenantDeletionGraceOverError);
		expect(() => {
			tenant("SUSPENDED").reactivate(OWNER, NOW);
		}).toThrow(TenantLifecycleTransitionError);
	});
});

describe("SuspensionAppeal", () => {
	it("is submitted PENDING with a trimmed message and reviewed once", () => {
		const appeal = SuspensionAppeal.submit("appeal-1", "tenant-1", OWNER, "  Please reinstate us  ");
		expect(appeal).toMatchObject({ message: "Please reinstate us", status: "PENDING", review: null });

		appeal.reject(ADMIN, " Not yet ", NOW);

		expect(appeal.status).toBe("REJECTED");
		expect(appeal.review).toEqual({ status: "REJECTED", reviewedByUserId: ADMIN, reviewedAt: NOW, reviewNote: "Not yet" });
		expect(() => {
			appeal.accept(ADMIN, "Changed my mind", LATER);
		}).toThrow(TenantAppealNotPendingError);
	});

	it("accepts a pending appeal", () => {
		const appeal = SuspensionAppeal.rehydrate({
			id: "appeal-1",
			tenantId: "tenant-1",
			submittedByUserId: OWNER,
			message: "m",
			status: "PENDING",
			reviewedByUserId: null,
			reviewedAt: null,
			reviewNote: null,
		});

		appeal.accept(ADMIN, "Reinstated", NOW);

		expect(appeal.review).toMatchObject({ status: "ACCEPTED", reviewNote: "Reinstated" });
	});
});

describe("Membership.leave", () => {
	function membership(role: string, status: string): Membership {
		return Membership.rehydrate({
			id: "m-1",
			tenantId: "tenant-1",
			userId: "user-1",
			role,
			status,
			displayName: null,
			scopeRows: [{ scopeType: "ALL_LOCATIONS", locationId: null }],
		});
	}

	it.each(["ACTIVE", "SUSPENDED", "PENDING"])("lets a %s member leave", (status) => {
		const subject = membership("CASHIER", status);

		subject.leave(NOW);

		expect(subject.changes).toEqual([{ kind: "left", leftAt: NOW }]);
	});

	it("refuses the owner", () => {
		expect(() => {
			membership("OWNER", "ACTIVE").leave(NOW);
		}).toThrow(TenantOwnerCannotLeaveError);
	});
});
