import { describe, expect, it } from "vitest";
import { epochMs, type PermissionPair } from "@workspace/shared";

import { AccessDecider } from "../access-decider";
import type { AccessFacts, ActiveGrant, ActiveShare } from "../access-facts";
import { isLiveAt } from "../access-facts";
import type { AccessRequest, AccessTarget } from "../access-request";
import { GrantAllowPath, OwnershipAllowPath, RoleAllowPath, ShareAllowPath, type RecordOwnership } from "../allow-paths";
import { StoreScope } from "../store-scope";

const NOW = epochMs(1_800_000_000_000);
const HOUR = 3_600_000;
const STORE_A = "store-a";
const STORE_B = "store-b";

const readAnalytics: PermissionPair = { action: "READ", resource: "ANALYTICS" };
const readReward: PermissionPair = { action: "READ", resource: "REWARD" };
const updateReward: PermissionPair = { action: "UPDATE", resource: "REWARD" };

function facts(overrides: Partial<AccessFacts> = {}): AccessFacts {
	return { rolePermissions: [], stores: StoreScope.all(), grants: [], shares: [], ...overrides };
}

function request(permission: PermissionPair, target?: AccessRequest["target"]): AccessRequest {
	return { userId: "user-a", tenantId: "tenant-a", permission, ...(target === undefined ? {} : { target }) };
}

function grant(permission: PermissionPair, overrides: Partial<ActiveGrant> = {}): ActiveGrant {
	return { permission, locationId: null, expiresAt: null, ...overrides };
}

function share(overrides: Partial<ActiveShare> = {}): ActiveShare {
	return { resource: "REWARD", resourceId: "reward-1", level: "VIEW", expiresAt: null, ...overrides };
}

/** Ownership read from a fixed table, as the database would answer. */
const owners: RecordOwnership = {
	ownerOf: (resource, resourceId) => Promise.resolve(resource === "USER" && resourceId === "user-a" ? "user-a" : null),
};

const decider = new AccessDecider([new RoleAllowPath(), new GrantAllowPath(), new ShareAllowPath(), new OwnershipAllowPath(owners)]);

describe("StoreScope", () => {
	it("covers tenant-level records everywhere, and stores by membership", () => {
		expect(StoreScope.of([STORE_A]).covers(undefined)).toBe(true);
		expect(StoreScope.of([STORE_A]).covers(STORE_A)).toBe(true);
		expect(StoreScope.of([STORE_A]).covers(STORE_B)).toBe(false);
		expect(StoreScope.all().covers("a-store-added-later")).toBe(true);
	});

	it("knows when one scope sits inside another (grant-time delegation)", () => {
		expect(StoreScope.all().includes(StoreScope.of([STORE_A]))).toBe(true);
		expect(StoreScope.of([STORE_A, STORE_B]).includes(StoreScope.of([STORE_A]))).toBe(true);
		expect(StoreScope.of([STORE_A]).includes(StoreScope.of([STORE_B]))).toBe(false);
		expect(StoreScope.of([STORE_A]).includes(StoreScope.all())).toBe(false);
	});
});

describe("isLiveAt", () => {
	it("keeps a row until the instant it ends", () => {
		expect(isLiveAt(null, NOW)).toBe(true);
		expect(isLiveAt(epochMs(NOW + 1), NOW)).toBe(true);
		expect(isLiveAt(NOW, NOW)).toBe(false);
	});
});

describe("AccessDecider", () => {
	it("denies by default", async () => {
		expect(await decider.decide(request(readAnalytics), facts(), NOW)).toEqual({ allowed: false, path: null });
	});

	it("allows through the role, inside the member's stores only", async () => {
		const cashierAtA = facts({ rolePermissions: [readReward], stores: StoreScope.of([STORE_A]) });
		expect(await decider.decide(request(readReward, { resource: "REWARD", locationId: STORE_A }), cashierAtA, NOW)).toEqual({ allowed: true, path: "role" });
		expect((await decider.decide(request(readReward, { resource: "REWARD", locationId: STORE_B }), cashierAtA, NOW)).allowed).toBe(false);
	});

	it("allows a permission removed from the role nowhere", async () => {
		expect((await decider.decide(request(updateReward), facts({ rolePermissions: [readReward] }), NOW)).allowed).toBe(false);
	});

	it("allows through a grant until the instant it expires (a 48-hour grant)", async () => {
		const granted = facts({ grants: [grant(readAnalytics, { expiresAt: epochMs(NOW + 48 * HOUR) })] });
		expect(await decider.decide(request(readAnalytics), granted, epochMs(NOW + 48 * HOUR - 1))).toEqual({ allowed: true, path: "grant" });
		expect((await decider.decide(request(readAnalytics), granted, epochMs(NOW + 48 * HOUR))).allowed).toBe(false);
	});

	it("keeps a permanent grant forever", async () => {
		expect((await decider.decide(request(readAnalytics), facts({ grants: [grant(readAnalytics)] }), epochMs(NOW + 10_000 * HOUR))).allowed).toBe(true);
	});

	it("intersects a store-limited grant with the member's stores, and reactivates it when the store returns", async () => {
		const atA = request(updateReward, { resource: "REWARD", locationId: STORE_A });
		const grantAtA = [grant(updateReward, { locationId: STORE_A })];
		expect((await decider.decide(atA, facts({ grants: grantAtA, stores: StoreScope.of([STORE_A]) }), NOW)).path).toBe("grant");
		expect((await decider.decide(request(updateReward, { resource: "REWARD", locationId: STORE_B }), facts({ grants: grantAtA }), NOW)).allowed).toBe(false);
		expect((await decider.decide(atA, facts({ grants: grantAtA, stores: StoreScope.of([STORE_B]) }), NOW)).allowed).toBe(false);
		expect((await decider.decide(atA, facts({ grants: grantAtA, stores: StoreScope.of([STORE_B, STORE_A]) }), NOW)).allowed).toBe(true);
	});

	it("never lets a store-limited grant satisfy a record that has no store", async () => {
		expect((await decider.decide(request(readAnalytics), facts({ grants: [grant(readAnalytics, { locationId: STORE_A })] }), NOW)).allowed).toBe(false);
	});

	it("allows exactly one shared record: VIEW reads, EDIT also updates", async () => {
		const reward1: AccessTarget = { resource: "REWARD", resourceId: "reward-1" };
		const viewing = facts({ shares: [share()] });
		expect(await decider.decide(request(readReward, reward1), viewing, NOW)).toEqual({ allowed: true, path: "share" });
		expect((await decider.decide(request(updateReward, reward1), viewing, NOW)).allowed).toBe(false);
		expect((await decider.decide(request(updateReward, reward1), facts({ shares: [share({ level: "EDIT" })] }), NOW)).path).toBe("share");
		expect((await decider.decide(request(readReward, { resource: "REWARD", resourceId: "reward-2" }), viewing, NOW)).allowed).toBe(false);
		expect((await decider.decide(request({ action: "DELETE", resource: "REWARD" }, reward1), facts({ shares: [share({ level: "EDIT" })] }), NOW)).allowed).toBe(false);
	});

	it("stops a share the instant it expires", async () => {
		const expiring = facts({ shares: [share({ expiresAt: epochMs(NOW + HOUR) })] });
		expect((await decider.decide(request(readReward, { resource: "REWARD", resourceId: "reward-1" }), expiring, epochMs(NOW + HOUR))).allowed).toBe(false);
	});

	it("lets an owner read and update their own record only — never delete it, never another's", async () => {
		const own: AccessTarget = { resource: "USER", resourceId: "user-a" };
		expect(await decider.decide(request({ action: "READ", resource: "USER" }, own), facts(), NOW)).toEqual({ allowed: true, path: "ownership" });
		expect((await decider.decide(request({ action: "UPDATE", resource: "USER" }, own), facts(), NOW)).path).toBe("ownership");
		expect((await decider.decide(request({ action: "DELETE", resource: "USER" }, own), facts(), NOW)).allowed).toBe(false);
		expect((await decider.decide(request({ action: "BAN", resource: "USER" }, own), facts(), NOW)).allowed).toBe(false);
		expect((await decider.decide(request({ action: "READ", resource: "USER" }, { resource: "USER", resourceId: "user-b" }), facts(), NOW)).allowed).toBe(false);
	});

	it("names the first path that allowed, in order", async () => {
		const both = facts({ rolePermissions: [readAnalytics], grants: [grant(readAnalytics)] });
		expect((await decider.decide(request(readAnalytics), both, NOW)).path).toBe("role");
	});
});
