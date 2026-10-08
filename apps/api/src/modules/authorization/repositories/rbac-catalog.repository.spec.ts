import { afterEach, describe, expect, it, vi } from "vitest";
import { LIST_SLOT_INDEX } from "@workspace/shared";

import { createTestPrisma } from "../../../../test/support/test-service-graph";
import { PermissionRepository } from "./permission.repository";
import { RoleRepository } from "./role.repository";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("RoleRepository", () => {
	it("never creates a system role from caller input", async () => {
		const db = createTestPrisma();
		const create = vi.spyOn(db.role, "create").mockResolvedValue({
			id: "r-1",
			name: "Editor",
			description: null,
			isActive: true,
			isSystem: false,
			parentId: null,
			isDeleted: false,
			deletedAt: null,
			createdAt: BigInt(1),
			updatedAt: BigInt(1),
		});

		await new RoleRepository(db).create({ name: "Editor" }, db);

		expect(create.mock.lastCall?.[LIST_SLOT_INDEX.first]?.data).toMatchObject({ name: "Editor", isSystem: false });
	});

	it("reads parent links across deleted and inactive roles, but the effective hierarchy only through live, active ones", async () => {
		const db = createTestPrisma();
		const findMany = vi.spyOn(db.role, "findMany").mockResolvedValue([]);
		const repository = new RoleRepository(db);

		await repository.findParentLinks(["r-1"], db);
		await repository.findEffectiveParentLinks(["r-1"], db);

		expect(findMany.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]?.where).toEqual({ id: { in: ["r-1"] } });
		expect(findMany.mock.calls[LIST_SLOT_INDEX.second]?.[LIST_SLOT_INDEX.first]?.where).toEqual({ id: { in: ["r-1"] }, isDeleted: false, isActive: true });
	});
});

describe("PermissionRepository", () => {
	it("never creates a system permission from caller input", async () => {
		const db = createTestPrisma();
		const create = vi.spyOn(db.permission, "create").mockResolvedValue({
			id: "p-1",
			action: "READ",
			resource: "USER",
			description: null,
			scope: "GLOBAL",
			group: null,
			isSystem: false,
			conditions: null,
			isDeleted: false,
			deletedAt: null,
			createdAt: BigInt(1),
			updatedAt: BigInt(1),
		});

		await new PermissionRepository(db).create({ action: "READ", resource: "USER" }, db);

		expect(create.mock.lastCall?.[LIST_SLOT_INDEX.first]?.data).toMatchObject({ action: "READ", resource: "USER", isSystem: false });
	});
});
