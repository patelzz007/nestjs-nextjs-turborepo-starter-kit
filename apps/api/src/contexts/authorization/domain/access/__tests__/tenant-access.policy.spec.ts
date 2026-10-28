import { describe, expect, it } from "vitest";
import type { PermissionPair } from "@workspace/shared";

import { StoreScope } from "../store-scope";
import {
	assertDelegable,
	assertOwnerChange,
	assertRoleEditable,
	assertTenantPermissions,
	DelegationRefusedError,
	OwnerRequiredError,
	OwnerRoleProtectedError,
	RoleInUseError,
	StaleHoldersError,
} from "../tenant-access.policy";

const READ_REWARD: PermissionPair = { action: "READ", resource: "REWARD" };
const UPDATE_REWARD: PermissionPair = { action: "UPDATE", resource: "REWARD" };
/** A platform-only permission: never part of a tenant role or grant. */
const PLATFORM_SETTINGS: PermissionPair = { action: "UPDATE", resource: "SYSTEM_SETTINGS" };
const OWNER = { templateKey: "OWNER" } satisfies { templateKey: "OWNER" };
const MANAGER = { templateKey: "MANAGER" } satisfies { templateKey: "MANAGER" };
const CUSTOM = { templateKey: null };

describe("assertRoleEditable", () => {
	it("refuses the Owner role and allows every other role", () => {
		expect((): void => {
			assertRoleEditable(OWNER);
		}).toThrow(OwnerRoleProtectedError);
		expect((): void => {
			assertRoleEditable(MANAGER);
		}).not.toThrow();
		expect((): void => {
			assertRoleEditable(CUSTOM);
		}).not.toThrow();
	});
});

describe("assertTenantPermissions", () => {
	it("allows tenant permissions and names the first platform permission it refuses", () => {
		expect((): void => {
			assertTenantPermissions([READ_REWARD, UPDATE_REWARD]);
		}).not.toThrow();
		expect((): void => {
			assertTenantPermissions([READ_REWARD, PLATFORM_SETTINGS]);
		}).toThrow("system_settings.update is not a tenant permission");
		expect((): void => {
			assertTenantPermissions([PLATFORM_SETTINGS]);
		}).toThrow(DelegationRefusedError);
	});
});

describe("assertOwnerChange", () => {
	it("lets only an Owner make someone an Owner", () => {
		expect((): void => {
			assertOwnerChange({ actorIsOwner: false, from: MANAGER, to: OWNER, ownersLeft: 1 });
		}).toThrow("Only an Owner can make someone an Owner");
		expect((): void => {
			assertOwnerChange({ actorIsOwner: true, from: MANAGER, to: OWNER, ownersLeft: 1 });
		}).not.toThrow();
	});

	it("never moves the last Owner off the Owner role, but lets one of several go", () => {
		expect((): void => {
			assertOwnerChange({ actorIsOwner: true, from: OWNER, to: MANAGER, ownersLeft: 1 });
		}).toThrow(OwnerRequiredError);
		expect((): void => {
			assertOwnerChange({ actorIsOwner: true, from: OWNER, to: MANAGER, ownersLeft: 2 });
		}).not.toThrow();
	});

	it("leaves changes that touch no Owner alone", () => {
		expect((): void => {
			assertOwnerChange({ actorIsOwner: false, from: MANAGER, to: CUSTOM, ownersLeft: 0 });
		}).not.toThrow();
		expect((): void => {
			assertOwnerChange({ actorIsOwner: false, from: OWNER, to: OWNER, ownersLeft: 1 });
		}).not.toThrow();
	});
});

describe("assertDelegable", () => {
	const granter = { rolePermissions: [READ_REWARD], stores: StoreScope.of(["store-1"]) };

	it("allows what the granter's role gives, within the granter's stores", () => {
		expect((): void => {
			assertDelegable(granter, READ_REWARD, StoreScope.of(["store-1"]));
		}).not.toThrow();
		expect((): void => {
			assertDelegable(granter, READ_REWARD, StoreScope.of([]));
		}).not.toThrow();
	});

	it("refuses a permission the granter's role does not give (grants are not delegable)", () => {
		expect((): void => {
			assertDelegable(granter, UPDATE_REWARD, StoreScope.of(["store-1"]));
		}).toThrow("You can only give a permission your own role gives you");
	});

	it("refuses a store outside the granter's stores, and the whole tenant from a store-limited granter", () => {
		expect((): void => {
			assertDelegable(granter, READ_REWARD, StoreScope.of(["store-2"]));
		}).toThrow("You can only give a permission within your own stores");
		expect((): void => {
			assertDelegable(granter, READ_REWARD, StoreScope.all());
		}).toThrow(DelegationRefusedError);
		expect((): void => {
			assertDelegable({ ...granter, stores: StoreScope.all() }, READ_REWARD, StoreScope.all());
		}).not.toThrow();
	});
});

describe("guardrail errors", () => {
	it("carry their codes, and a role in use carries what reassign must quote", () => {
		const inUse = new RoleInUseError(2, "v1");

		expect(inUse).toMatchObject({ code: "CONFLICT", details: { holderCount: 2, holdersVersion: "v1" } });
		expect(inUse.message).toContain("2 member(s)");
		expect(new StaleHoldersError().code).toBe("CONFLICT");
		expect(new OwnerRoleProtectedError().code).toBe("TENANT_OWNER_PROTECTED");
		expect(new OwnerRequiredError("x").code).toBe("TENANT_OWNER_REQUIRED");
		expect(new DelegationRefusedError("x").code).toBe("TENANT_SCOPE_ESCALATION");
	});
});
