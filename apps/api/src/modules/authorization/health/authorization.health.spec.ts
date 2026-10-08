import type { Role } from "@prisma/client";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { PrismaService } from "../../../prisma/prisma.service";
import { SYSTEM_ROLE_CATALOG } from "../reference-data/system-role-catalog";

import { AuthorizationHealthIndicator } from "./authorization.health";

describe("AuthorizationHealthIndicator", () => {
	let prisma: PrismaService;

	beforeEach(() => {
		prisma = new PrismaService(createTestTypedConfig());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	/** A live system role row as the database returns it. */
	function systemRole(name: string): Role {
		const createdAt = 1_790_000_000_000n;
		return { id: `role-${name}`, name, description: null, isActive: true, isSystem: true, parentId: null, isDeleted: false, deletedAt: null, createdAt, updatedAt: createdAt };
	}

	function rolesInDatabase(names: readonly string[]): void {
		vi.spyOn(prisma.role, "findMany").mockResolvedValue(names.map(systemRole));
	}

	it("is healthy when every catalog system role exists", async () => {
		rolesInDatabase(SYSTEM_ROLE_CATALOG.map((role) => role.name));
		const indicator = new AuthorizationHealthIndicator(prisma);

		await expect(indicator.isHealthy()).resolves.toBe(true);
		await expect(indicator.getReport()).resolves.toEqual({ systemRolesExpected: SYSTEM_ROLE_CATALOG.length, systemRolesMissing: null });
	});

	it("is unhealthy and names the missing roles when reference data was never loaded", async () => {
		rolesInDatabase(["SuperAdmin"]);
		const indicator = new AuthorizationHealthIndicator(prisma);
		const missing: string = SYSTEM_ROLE_CATALOG.map((role) => role.name)
			.filter((name) => name !== "SuperAdmin")
			.join(", ");

		await expect(indicator.isHealthy()).resolves.toBe(false);
		await expect(indicator.getReport()).resolves.toEqual({ systemRolesExpected: SYSTEM_ROLE_CATALOG.length, systemRolesMissing: missing });
	});

	it("only counts live system roles", async () => {
		const findMany = vi.spyOn(prisma.role, "findMany").mockResolvedValue([]);
		await new AuthorizationHealthIndicator(prisma).isHealthy();

		const where = findMany.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]?.where;
		expect(where?.isSystem).toBe(true);
		expect(where?.isDeleted).toBe(false);
	});

	it("lets a database error propagate (the health service reports the probe as down)", async () => {
		vi.spyOn(prisma.role, "findMany").mockRejectedValue(new Error("connection refused"));

		await expect(new AuthorizationHealthIndicator(prisma).isHealthy()).rejects.toThrow("connection refused");
	});
});
