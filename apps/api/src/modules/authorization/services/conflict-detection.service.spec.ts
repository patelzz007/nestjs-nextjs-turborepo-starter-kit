import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequestContextService } from "../../../common/context/request-context";
import { ConflictError } from "../../../common/errors/app-error";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { RoleAssignmentRepository } from "../repositories/role-assignment.repository";
import { RoleRepository } from "../repositories/role.repository";
import { ConflictDetectionService } from "./conflict-detection.service";
import { createTestPrisma } from "../../../../test/support/test-service-graph";

/** id → { name, parentId, live/active } — the mocked repositories honour their method contracts over this table. */
const state = vi.hoisted(() => ({
	roles: new Map<string, { readonly name: string; readonly parentId: string | null; readonly isEffective: boolean }>(),
	assigned: new Map<string, string[]>(),
	overrides: new Array<{ readonly permissionId: string; readonly effect: "ALLOW" | "DENY" }>(),
}));

vi.mock("../repositories/role.repository", () => ({
	RoleRepository: class {
		public readonly findEffectiveParentLinks = (roleIds: readonly string[]): Promise<{ id: string; parentId: string | null }[]> =>
			Promise.resolve(
				roleIds.flatMap((id) => {
					const row = state.roles.get(id);
					return row?.isEffective === true ? [{ id, parentId: row.parentId }] : [];
				}),
			);
		public readonly findEffectiveNames = (roleIds: readonly string[]): Promise<Map<string, string>> =>
			Promise.resolve(
				new Map(
					roleIds.flatMap((id): [string, string][] => {
						const row = state.roles.get(id);
						return row?.isEffective === true ? [[id, row.name]] : [];
					}),
				),
			);
	},
}));

vi.mock("../repositories/role-assignment.repository", () => ({
	RoleAssignmentRepository: class {
		public readonly findAssignedRoleIds = (userId: string): Promise<string[]> => Promise.resolve(state.assigned.get(userId) ?? []);
		public readonly findDirectOverrides = (): Promise<{ permissionId: string; effect: "ALLOW" | "DENY" }[]> => Promise.resolve([...state.overrides]);
	},
}));

function service(tenantTx: TenantTransactionService = new TenantTransactionService(createTestPrisma(), new RequestContextService())): ConflictDetectionService {
	const prisma = createTestPrisma();
	return new ConflictDetectionService(new RoleRepository(prisma), new RoleAssignmentRepository(), tenantTx);
}

describe("ConflictDetectionService", () => {
	const db = createTestPrisma();

	beforeEach(() => {
		state.roles.clear();
		state.roles.set("r-store-manager", { name: "Store Manager", parentId: null, isEffective: true });
		state.roles.set("r-store-staff", { name: "Store Staff", parentId: null, isEffective: true });
		state.roles.set("r-shift-lead", { name: "Shift Lead", parentId: "r-store-staff", isEffective: true });
		state.roles.set("r-editor", { name: "Editor", parentId: null, isEffective: true });
		state.assigned.clear();
		state.overrides.splice(0, state.overrides.length);
	});

	it("detects a separation-of-duty violation between directly held roles", async () => {
		await expect(service().findConflicts(["r-store-manager", "r-store-staff"], db)).resolves.toEqual([
			expect.objectContaining({ roleA: "Store Manager", roleB: "Store Staff" }),
		]);
		await expect(service().assertNoConflicts(["r-store-manager", "r-store-staff"], db)).rejects.toBeInstanceOf(ConflictError);
	});

	it("detects a violation reached through role inheritance", async () => {
		await expect(service().assertNoConflicts(["r-store-manager", "r-shift-lead"], db)).rejects.toBeInstanceOf(ConflictError);
	});

	it("ignores roles that are deleted or inactive (they confer nothing)", async () => {
		state.roles.set("r-store-staff", { name: "Store Staff", parentId: null, isEffective: false });

		await expect(service().assertNoConflicts(["r-store-manager", "r-store-staff"], db)).resolves.toBeUndefined();
	});

	it("allows conflict-free sets", async () => {
		await expect(service().assertNoConflicts(["r-store-manager", "r-editor"], db)).resolves.toBeUndefined();
	});

	it("post-write check validates every affected user's current role set", async () => {
		state.assigned.set("user-ok", ["r-editor"]);
		state.assigned.set("user-bad", ["r-store-manager", "r-shift-lead"]);

		await expect(service().assertUsersHaveNoConflicts(["user-ok"], db)).resolves.toBeUndefined();
		await expect(service().assertUsersHaveNoConflicts(["user-ok", "user-bad"], db)).rejects.toBeInstanceOf(ConflictError);
	});

	it("validates a proposed assignment against the user's current roles under the inspect system operation", async () => {
		const tenantTx = new TenantTransactionService(createTestPrisma(), new RequestContextService());
		const withSystemOperation = vi.spyOn(tenantTx, "withSystemOperation").mockImplementation(async (_context, handler) => handler(db));
		state.assigned.set("user-1", ["r-store-staff"]);

		await expect(service(tenantTx).validateProposedAssignment("admin-1", "user-1", ["r-store-manager"])).rejects.toBeInstanceOf(ConflictError);
		await expect(service(tenantTx).validateProposedAssignment("admin-1", "user-1", ["r-editor"])).resolves.toBeUndefined();
		expect(withSystemOperation).toHaveBeenCalledWith(expect.objectContaining({ operation: "authorization.rbac.inspect", actorUserId: "admin-1" }), expect.any(Function));
	});

	it("rejects an ALLOW sync listing a permission under a live DENY override", async () => {
		state.overrides.push({ permissionId: "perm-denied", effect: "DENY" }, { permissionId: "perm-allowed", effect: "ALLOW" });

		await expect(service().assertNoAllowDenyConflict("user-1", ["perm-denied"], db)).rejects.toBeInstanceOf(ConflictError);
		await expect(service().assertNoAllowDenyConflict("user-1", ["perm-allowed", "perm-new"], db)).resolves.toBeUndefined();
	});
});
