import { describe, expect, it } from "vitest";

import { kybAdminDecisionFor, kybAdminDecisionsFrom, KYB_REVIEW } from "../kyb-review-machine";
import { LOCATION_LIFECYCLE } from "../location-machine";
import { SUPPORT_ACCESS_GRANT_LIFECYCLE } from "../support-access-grant-machine";
import { TENANT_LIFECYCLE } from "../tenant-lifecycle-machine";
import type { SupportAccessGrantStatus } from "../tenant";

/** `event: FROM → TO` per edge — one readable line each, so a changed graph shows up as a reviewed diff. */
function edgeLines(edges: readonly { readonly event: string; readonly from: string; readonly to: string }[]): string[] {
	return edges.map((edge) => `${edge.event}: ${edge.from} → ${edge.to}`);
}

describe("TENANT_LIFECYCLE", () => {
	it("holds exactly the moves the Tenant aggregate made before it was declared", () => {
		expect(edgeLines(TENANT_LIFECYCLE.edges)).toEqual([
			"activate: PROVISIONING → ACTIVE",
			"suspend: ACTIVE → SUSPENDED",
			"suspend: RESTRICTED → SUSPENDED",
			"reinstate: SUSPENDED → ACTIVE",
			"ban: ACTIVE → BANNED",
			"ban: RESTRICTED → BANNED",
			"ban: SUSPENDED → BANNED",
			"unban: BANNED → ACTIVE",
			"reactivate: PENDING_DELETION → ACTIVE",
		]);
	});

	it("offers an admin the suspension and ban moves of each state", () => {
		expect(TENANT_LIFECYCLE.eventsFrom("ACTIVE")).toEqual(["suspend", "ban"]);
		expect(TENANT_LIFECYCLE.eventsFrom("SUSPENDED")).toEqual(["reinstate", "ban"]);
		expect(TENANT_LIFECYCLE.eventsFrom("DELETED")).toEqual([]);
		expect(TENANT_LIFECYCLE.isTerminal("DELETED")).toBe(true);
	});
});

describe("SUPPORT_ACCESS_GRANT_LIFECYCLE", () => {
	it("lets every open grant expire or be revoked, and only a grant waiting for the owner be approved", () => {
		expect(SUPPORT_ACCESS_GRANT_LIFECYCLE.sourcesOf("revoke")).toEqual(["PENDING_APPROVAL", "PENDING_TENANT_APPROVAL", "ACTIVE"]);
		expect(SUPPORT_ACCESS_GRANT_LIFECYCLE.sourcesOf("expire")).toEqual(["PENDING_APPROVAL", "PENDING_TENANT_APPROVAL", "ACTIVE"]);
		expect(SUPPORT_ACCESS_GRANT_LIFECYCLE.sourcesOf("approve")).toEqual(["PENDING_TENANT_APPROVAL"]);
		const closed: readonly SupportAccessGrantStatus[] = ["EXPIRED", "REVOKED", "DENIED"];
		expect(closed.map((status) => SUPPORT_ACCESS_GRANT_LIFECYCLE.eventsFrom(status))).toEqual([[], [], []]);
	});
});

describe("LOCATION_LIFECYCLE", () => {
	it("reviews a pending store, resubmits a rejected one, and closes or completes from any status", () => {
		expect(LOCATION_LIFECYCLE.eventsFrom("PENDING_APPROVAL")).toEqual(["approve", "reject", "completeOnboarding", "close"]);
		expect(LOCATION_LIFECYCLE.eventsFrom("REJECTED")).toEqual(["resubmit", "completeOnboarding", "close"]);
		expect(LOCATION_LIFECYCLE.eventsFrom("ACTIVE")).toEqual(["completeOnboarding", "close"]);
		expect(LOCATION_LIFECYCLE.targetOf("close")).toBe("INACTIVE");
	});
});

describe("KYB_REVIEW", () => {
	it("allows the admin decisions of migration plan §7.5 from each status, and nothing back to PENDING", () => {
		expect(kybAdminDecisionsFrom("PENDING")).toEqual(["APPROVED", "REJECTED", "ACTION_REQUIRED"]);
		expect(kybAdminDecisionsFrom("ACTION_REQUIRED")).toEqual(["APPROVED", "REJECTED"]);
		expect(kybAdminDecisionsFrom("APPROVED")).toEqual(["REJECTED", "ACTION_REQUIRED"]);
		expect(kybAdminDecisionsFrom("REJECTED")).toEqual([]);
		expect(kybAdminDecisionFor("PENDING", "PENDING")).toBeNull();
	});

	it("names the admin decision behind a status change", () => {
		expect(kybAdminDecisionFor("PENDING", "APPROVED")).toBe("approve");
		expect(kybAdminDecisionFor("APPROVED", "ACTION_REQUIRED")).toBe("requestAction");
		expect(kybAdminDecisionFor("REJECTED", "APPROVED")).toBeNull();
	});

	it("lets the merchant resubmit anything but an approved review, and scans change only an undecided one", () => {
		expect(KYB_REVIEW.can("submit", "APPROVED")).toBe(false);
		expect(KYB_REVIEW.can("submit", "REJECTED")).toBe(true);
		expect(KYB_REVIEW.sourcesOf("flagEvidence")).toEqual(["PENDING", "ACTION_REQUIRED"]);
		expect(KYB_REVIEW.sourcesOf("clearEvidence")).toEqual(["ACTION_REQUIRED"]);
	});
});
