import { beforeEach, describe, expect, it } from "vitest";
import { epochMs, type PermissionPair } from "@workspace/shared";

import { NotFoundError } from "../../../../../platform/application/errors/app-error";
import type { ActorContext } from "../../../../../platform/application/actor-context";
import { StoreScope } from "../../../domain/access/store-scope";
import { DelegationRefusedError, OwnerRequiredError, OwnerRoleProtectedError, RoleInUseError, StaleHoldersError } from "../../../domain/access/tenant-access.policy";
import { AccessDeniedError } from "../../../domain/errors/authorization.errors";
import { FixedClock, NOW } from "../../__tests__/fakes/authorization.fakes";
import { InMemoryTenant, TENANT_SLUG } from "../../__tests__/fakes/tenant-access.fakes";
import { AccessControlService } from "../access-control.service";
import { holdersVersionOf, TenantAccessService, type TenantRoute } from "../tenant-access.service";

const HOUR_MS = 3_600_000;
const READ_ANALYTICS: PermissionPair = { action: "READ", resource: "ANALYTICS" };
const UPDATE_KYB: PermissionPair = { action: "UPDATE", resource: "KYB" };
const READ_REWARD: PermissionPair = { action: "READ", resource: "REWARD" };
/** A platform-only permission: never part of a tenant role or grant. */
const PLATFORM_SETTINGS: PermissionPair = { action: "UPDATE", resource: "SYSTEM_SETTINGS" };

function actor(userId: string): ActorContext {
	return {
		kind: "user",
		userId,
		sessionId: "session",
		tenantId: null,
		isSuperAdmin: false,
		accessScope: "tenant",
		impersonatorUserId: null,
		request: { requestId: "req", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
	};
}

function as(userId: string): TenantRoute {
	return { actor: actor(userId), tenantSlug: TENANT_SLUG };
}

let tenant: InMemoryTenant;
let clock: FixedClock;
let access: TenantAccessService;
let cashierMember: string;
let managerMember: string;
let ownerMember: string;

beforeEach(() => {
	tenant = new InMemoryTenant();
	clock = new FixedClock();
	ownerMember = tenant.addMember("owner", "OWNER");
	managerMember = tenant.addMember("manager", "MANAGER");
	cashierMember = tenant.addMember("cashier", "CASHIER", StoreScope.of(["store-1"]));
	const decisions = new AccessControlService(tenant, { ownerOf: (): Promise<string | null> => Promise.resolve(null) }, clock);
	access = new TenantAccessService(decisions, tenant, tenant);
});

describe("TenantAccessService — the tenant and the caller", () => {
	it("answers the uniform 404 for an unknown tenant or a caller that is not a user", async () => {
		await expect(access.listRoles({ actor: actor("owner"), tenantSlug: "nope" })).rejects.toBeInstanceOf(NotFoundError);
		await expect(
			access.listRoles({
				actor: { kind: "anonymous", tenantId: null, request: { requestId: "r", ip: null, userAgent: null, deviceLabel: null, endpoint: null } },
				tenantSlug: TENANT_SLUG,
			}),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("denies a user with no membership in the tenant (tenant A never administers tenant B)", async () => {
		await expect(access.listRoles(as("stranger"))).rejects.toBeInstanceOf(AccessDeniedError);
	});
});

describe("TenantAccessService — roles (add and remove permissions)", () => {
	it("lists the tenant's roles with their holders", async () => {
		const roles = await access.listRoles(as("owner"));

		expect(roles.map((role) => [role.name, role.holderCount])).toEqual([
			["Owner", 1],
			["Manager", 1],
			["Cashier", 1],
		]);
	});

	it("adds and removes a permission on a role, and the holders' access follows at once", async () => {
		const cashierRole = tenant.roleIdOf("CASHIER");

		const held = tenant.roles.find((role) => role.id === cashierRole)?.permissions ?? [];
		await access.updateRole(as("owner"), cashierRole, { permissions: [...held, READ_ANALYTICS] });
		expect(
			await new AccessControlService(tenant, { ownerOf: (): Promise<string | null> => Promise.resolve(null) }, clock).decide({
				userId: "cashier",
				tenantId: "tenant-1",
				permission: READ_ANALYTICS,
			}),
		).toMatchObject({ allowed: true });

		await access.updateRole(as("owner"), cashierRole, { permissions: [READ_REWARD] });
		expect(tenant.roles.find((role) => role.id === cashierRole)?.permissions).toEqual([READ_REWARD]);
		expect(tenant.audit.map((entry) => entry.action)).toEqual(["role.updated", "role.updated"]);
	});

	it("never edits, resets or deletes the Owner role", async () => {
		const ownerRole = tenant.roleIdOf("OWNER");

		await expect(access.updateRole(as("owner"), ownerRole, { name: "Boss" })).rejects.toBeInstanceOf(OwnerRoleProtectedError);
		await expect(access.resetRole(as("owner"), ownerRole)).rejects.toBeInstanceOf(OwnerRoleProtectedError);
		await expect(access.deleteRole(as("owner"), ownerRole)).rejects.toBeInstanceOf(OwnerRoleProtectedError);
	});

	it("puts only tenant permissions the caller's own role holds into a role", async () => {
		await expect(access.createRole(as("owner"), { name: "Ops", permissions: [PLATFORM_SETTINGS] })).rejects.toBeInstanceOf(DelegationRefusedError);
		await expect(access.createRole(as("manager"), { name: "Ops", permissions: [UPDATE_KYB] })).rejects.toThrow("You can only give a permission your own role gives you");
		await expect(access.createRole(as("owner"), { name: "Ops", permissions: [UPDATE_KYB] })).resolves.toMatchObject({
			name: "Ops",
			templateKey: null,
			permissions: [UPDATE_KYB],
		});
	});

	it("lets only a role holding role.* administer roles", async () => {
		await expect(access.createRole(as("cashier"), { name: "Ops", permissions: [] })).rejects.toBeInstanceOf(AccessDeniedError);
	});

	it("resets a changed role to its template, and refuses a role that has none", async () => {
		const managerRole = tenant.roleIdOf("MANAGER");
		await access.updateRole(as("owner"), managerRole, { permissions: [READ_REWARD] });

		const reset = await access.resetRole(as("owner"), managerRole);
		const custom = await access.createRole(as("owner"), { name: "Ops", permissions: [] });

		expect(reset.permissions.length).toBeGreaterThan(1);
		await expect(access.resetRole(as("owner"), custom.id)).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe("TenantAccessService — deleting a role people hold", () => {
	it("refuses with the holders' count and version, reassigns them atomically, then deletes", async () => {
		const role = await access.createRole(as("owner"), { name: "Floor", permissions: [READ_REWARD] });
		await access.changeMemberRole(as("owner"), cashierMember, role.id);

		const refused = access.deleteRole(as("owner"), role.id);
		await expect(refused).rejects.toBeInstanceOf(RoleInUseError);
		await expect(refused).rejects.toMatchObject({ details: { holderCount: 1, holdersVersion: holdersVersionOf([cashierMember]) } });

		const { holdersVersion } = await access.roleHolders(as("owner"), role.id);
		await access.reassignHolders(as("owner"), role.id, { holdersVersion, assignments: [{ membershipId: cashierMember, roleId: tenant.roleIdOf("CASHIER") }] });
		await expect(access.deleteRole(as("owner"), role.id)).resolves.toBeUndefined();
	});

	it("refuses a reassignment made for a holder list that has since changed", async () => {
		const role = await access.createRole(as("owner"), { name: "Floor", permissions: [READ_REWARD] });
		await access.changeMemberRole(as("owner"), cashierMember, role.id);
		const { holdersVersion } = await access.roleHolders(as("owner"), role.id);
		await access.changeMemberRole(as("owner"), managerMember, role.id);

		await expect(
			access.reassignHolders(as("owner"), role.id, { holdersVersion, assignments: [{ membershipId: cashierMember, roleId: tenant.roleIdOf("CASHIER") }] }),
		).rejects.toBeInstanceOf(StaleHoldersError);
	});
});

describe("TenantAccessService — the Owner guardrails", () => {
	it("lets only an Owner make someone an Owner", async () => {
		await expect(access.changeMemberRole(as("manager"), cashierMember, tenant.roleIdOf("OWNER"))).rejects.toThrow("Only an Owner can make someone an Owner");
		await expect(access.changeMemberRole(as("owner"), cashierMember, tenant.roleIdOf("OWNER"))).resolves.toBeUndefined();
	});

	it("keeps at least one Owner: the last one cannot be moved off the role or removed", async () => {
		await expect(access.changeMemberRole(as("owner"), ownerMember, tenant.roleIdOf("MANAGER"))).rejects.toBeInstanceOf(OwnerRequiredError);
		await expect(access.removeMember(as("owner"), ownerMember)).rejects.toBeInstanceOf(OwnerRequiredError);
	});

	it("shows one member's access to a caller with member.read, and 404s an unknown member", async () => {
		await expect(access.memberAccess(as("manager"), cashierMember)).resolves.toMatchObject({ membershipId: cashierMember, roleName: "Cashier", templateKey: "CASHIER" });
		await expect(access.memberAccess(as("manager"), "nobody")).rejects.toBeInstanceOf(NotFoundError);
		await expect(access.memberAccess(as("cashier"), managerMember)).rejects.toBeInstanceOf(AccessDeniedError);
	});

	it("removes a member, writing the audit row", async () => {
		await access.removeMember(as("owner"), cashierMember);

		expect(tenant.members.some((member) => member.id === cashierMember)).toBe(false);
		expect(tenant.audit.at(-1)).toMatchObject({ action: "member.removed", resourceId: cashierMember });
	});
});

describe("TenantAccessService — grants (permanent or for 48 hours)", () => {
	it("gives a cashier a permission for 48 hours on top of their role, and it stops on its own", async () => {
		const decisions = new AccessControlService(tenant, { ownerOf: (): Promise<string | null> => Promise.resolve(null) }, clock);
		const grant = await access.grant(as("owner"), cashierMember, { permission: READ_ANALYTICS, expiresAt: epochMs(NOW + 48 * HOUR_MS) });

		expect(grant).toMatchObject({ membershipId: cashierMember, expiresAt: NOW + 48 * HOUR_MS, grantedBy: "owner", grantedVia: "Owner" });
		expect(await decisions.decide({ userId: "cashier", tenantId: "tenant-1", permission: READ_ANALYTICS })).toEqual({ allowed: true, path: "grant" });

		clock.advance(48 * HOUR_MS);
		expect(await decisions.decide({ userId: "cashier", tenantId: "tenant-1", permission: READ_ANALYTICS })).toEqual({ allowed: false, path: null });
	});

	it("keeps a permanent grant, listed for the member", async () => {
		await access.grant(as("owner"), cashierMember, { permission: READ_ANALYTICS });

		await expect(access.listGrants(as("manager"), cashierMember)).resolves.toEqual([expect.objectContaining({ expiresAt: null, permission: READ_ANALYTICS })]);
	});

	it("never gives more than the granter's own role or stores", async () => {
		await expect(access.grant(as("manager"), cashierMember, { permission: UPDATE_KYB })).rejects.toBeInstanceOf(DelegationRefusedError);
		await expect(access.grant(as("owner"), cashierMember, { permission: PLATFORM_SETTINGS })).rejects.toBeInstanceOf(DelegationRefusedError);

		const storeManager = tenant.addMember("store-manager", "MANAGER", StoreScope.of(["store-1"]));
		await expect(access.grant(as("store-manager"), cashierMember, { permission: READ_ANALYTICS })).rejects.toThrow("within your own stores");
		await expect(access.grant(as("store-manager"), cashierMember, { permission: READ_ANALYTICS, locationId: "store-1" })).resolves.toMatchObject({ locationId: "store-1" });
		expect(storeManager).toBe("member-store-manager");
	});

	it("needs member.update to grant: a cashier cannot", async () => {
		await expect(access.grant(as("cashier"), managerMember, { permission: READ_REWARD })).rejects.toBeInstanceOf(AccessDeniedError);
	});

	it("lets the granter always take their grant back; anyone else needs member.update", async () => {
		const grant = await access.grant(as("manager"), cashierMember, { permission: READ_ANALYTICS });
		await access.changeMemberRole(as("owner"), managerMember, tenant.roleIdOf("CASHIER"));
		tenant.addMember("cashier-2", "CASHIER");

		await expect(access.revokeGrant(as("cashier-2"), grant.id)).rejects.toBeInstanceOf(AccessDeniedError);
		await expect(access.revokeGrant(as("manager"), grant.id)).resolves.toBeUndefined();
		await expect(access.revokeGrant(as("owner"), grant.id)).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe("TenantAccessService — sharing one record", () => {
	beforeEach(() => {
		tenant.records.REWARD.push({ id: "reward-1", locationIds: ["store-1"] }, { id: "reward-2", locationIds: ["store-2"] });
	});

	it("shares one reward with one member at a level the sharer's role gives, until it expires", async () => {
		const share = await access.share(as("owner"), {
			resource: "REWARD",
			resourceId: "reward-2",
			membershipId: cashierMember,
			level: "EDIT",
			expiresAt: epochMs(NOW + HOUR_MS),
		});

		expect(share).toMatchObject({ level: "EDIT", sharedBy: "owner", resourceId: "reward-2" });
		await expect(access.listShares(as("manager"))).resolves.toHaveLength(1);
		expect(tenant.audit.at(-1)).toMatchObject({ action: "share.created" });
	});

	it("refuses a level beyond the sharer's role, a store outside the sharer's stores, and a missing record", async () => {
		await expect(access.share(as("cashier"), { resource: "REWARD", resourceId: "reward-1", membershipId: managerMember, level: "EDIT" })).rejects.toBeInstanceOf(
			DelegationRefusedError,
		);
		await expect(access.share(as("cashier"), { resource: "REWARD", resourceId: "reward-2", membershipId: managerMember, level: "VIEW" })).rejects.toThrow(
			"within your own stores",
		);
		await expect(access.share(as("owner"), { resource: "REWARD", resourceId: "missing", membershipId: cashierMember, level: "VIEW" })).rejects.toBeInstanceOf(NotFoundError);
		await expect(access.share(as("stranger"), { resource: "REWARD", resourceId: "reward-1", membershipId: cashierMember, level: "VIEW" })).rejects.toBeInstanceOf(
			DelegationRefusedError,
		);
	});

	it("lets the sharer always take a share back; anyone else needs share.delete", async () => {
		const share = await access.share(as("cashier"), { resource: "REWARD", resourceId: "reward-1", membershipId: managerMember, level: "VIEW" });
		tenant.addMember("cashier-2", "CASHIER");

		await expect(access.unshare(as("cashier-2"), share.id)).rejects.toBeInstanceOf(AccessDeniedError);
		await expect(access.unshare(as("cashier"), share.id)).resolves.toBeUndefined();
		expect(tenant.shares).toEqual([]);
	});
});

describe("holdersVersionOf", () => {
	it("is the same for the same holders in any order, and changes when they change", () => {
		expect(holdersVersionOf(["b", "a"])).toBe(holdersVersionOf(["a", "b"]));
		expect(holdersVersionOf(["a"])).not.toBe(holdersVersionOf(["a", "b"]));
	});
});
