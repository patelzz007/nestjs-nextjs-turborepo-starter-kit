import { describe, expect, it } from "vitest";

import { resolvePermissionHolders, type PermissionHolderGrants } from "../policies/permission-holders.policy";

const NONE: PermissionHolderGrants = { roleHolders: [], directAllow: [], directDeny: [], superAdmins: [], activeUsers: [] };

describe("resolvePermissionHolders", () => {
	it("lists role holders and direct allows once each, SuperAdmins first", () => {
		const holders = resolvePermissionHolders({
			...NONE,
			roleHolders: ["role-user", "both"],
			directAllow: ["direct-user", "both"],
			superAdmins: ["root"],
			activeUsers: ["root", "role-user", "both", "direct-user"],
		});

		expect(holders).toEqual(["root", "role-user", "both", "direct-user"]);
	});

	it("drops a holder with a direct DENY, but never a SuperAdmin", () => {
		const holders = resolvePermissionHolders({
			...NONE,
			roleHolders: ["denied", "kept"],
			directDeny: ["denied", "root"],
			superAdmins: ["root"],
			activeUsers: ["denied", "kept", "root"],
		});

		expect(holders).toEqual(["root", "kept"]);
	});

	it("drops inactive or deleted accounts, whatever they hold", () => {
		const holders = resolvePermissionHolders({ ...NONE, roleHolders: ["gone"], superAdmins: ["retired-root"], activeUsers: [] });

		expect(holders).toEqual([]);
	});
});
