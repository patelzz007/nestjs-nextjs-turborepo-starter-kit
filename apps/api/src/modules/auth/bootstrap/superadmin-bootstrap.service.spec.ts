import { AsyncLocalStorage } from "node:async_hooks";
import { LIST_SLOT_INDEX } from "@workspace/shared";

import { Prisma, type Role, type UserRole } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { RequestContextService } from "../../../common/context/request-context";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { AuthorizationAuditService } from "../../authorization/audit/authorization-audit.service";
import { RoleAssignmentRepository } from "../../authorization/repositories/role-assignment.repository";
import { RoleRepository } from "../../authorization/repositories/role.repository";
import { ConflictDetectionService } from "../../authorization/services/conflict-detection.service";
import { createTestPrisma } from "../../../../test/support/test-service-graph";
import type { OperatorIdentityProvider } from "../../../common/operator-identity";
import { SUPERADMIN_BOOTSTRAP_LOCK_KEY, SUPERADMIN_BOOTSTRAP_OPERATION, SUPERADMIN_BOOTSTRAP_REASON } from "./superadmin-bootstrap.constants";
import { BootstrapEmailTakenError, SuperAdminAlreadyExistsError, SuperAdminRoleMissingError } from "./superadmin-bootstrap.errors";
import { SuperAdminBootstrapRepository, type CreatedSuperAdmin } from "./superadmin-bootstrap.repository";
import { SuperAdminBootstrapService, type BootstrapRequest, type PasswordHasher } from "./superadmin-bootstrap.service";

const NOW = 1_790_812_800_000;
const PASSWORD = "Corr3ct-Horse-Battery!";
const REQUEST: BootstrapRequest = { identity: { email: "root@acme.test", fullName: "Root Admin" }, password: PASSWORD };
const OPERATOR = { osUser: "deploy", host: "api-1.internal" };
const ROLE_ID = "role-superadmin";

const mocks = vi.hoisted(() => ({
	executeRaw: vi.fn<(strings: TemplateStringsArray, ...values: string[]) => Promise<number>>(),
	auditCreate: vi.fn<(args: { readonly data: Readonly<Record<string, string | null>> }) => Promise<null>>(),
}));

vi.mock("../../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly $executeRaw = mocks.executeRaw;
		public readonly permissionAuditLog = { create: mocks.auditCreate };
	},
}));

function role(): Role {
	return {
		id: ROLE_ID,
		name: "SuperAdmin",
		description: null,
		isActive: true,
		isSystem: true,
		parentId: null,
		isDeleted: false,
		deletedAt: null,
		createdAt: BigInt(NOW),
		updatedAt: BigInt(NOW),
	};
}

function userRow(id: string, email: string, fullName: string): CreatedSuperAdmin {
	return { id, email, fullName };
}

function assignmentRow(userId: string): UserRole {
	return {
		id: "ur-1",
		userId,
		roleId: ROLE_ID,
		assignedAt: BigInt(NOW),
		assignedBy: SUPERADMIN_BOOTSTRAP_OPERATION,
		isDeleted: false,
		deletedAt: null,
		createdAt: BigInt(NOW),
		updatedAt: BigInt(NOW),
	};
}

/** The state two concurrent runs share: the users table, as far as the bootstrap can see. */
interface World {
	readonly superAdmins: string[];
	readonly steps: string[];
}

/** Everything one spec needs; `lockHolders` models `pg_advisory_xact_lock` (blocks until the holder's transaction ends). */
interface Harness {
	readonly service: SuperAdminBootstrapService;
	readonly world: World;
	readonly withSystemOperation: MockInstance<TenantTransactionService["withSystemOperation"]>;
	readonly createSuperAdmin: MockInstance<SuperAdminBootstrapRepository["createSuperAdmin"]>;
	readonly emailExists: MockInstance<SuperAdminBootstrapRepository["emailExists"]>;
	readonly findRole: MockInstance<RoleRepository["findByName"]>;
	readonly assignRole: MockInstance<RoleAssignmentRepository["assignRoleToUser"]>;
	readonly hash: MockInstance<PasswordHasher["hash"]>;
}

const transactionScope = new AsyncLocalStorage<{ release: () => void; readonly acquired: boolean[] }>();

/** One-slot queue: the next acquirer waits for the previous holder's release. */
let lockTail: Promise<void> = Promise.resolve();

function installAdvisoryLock(world: World): void {
	mocks.executeRaw.mockImplementation(async (strings: TemplateStringsArray, ...values: string[]): Promise<number> => {
		const scope = transactionScope.getStore();
		if (scope !== undefined && strings.join("?").includes("pg_advisory_xact_lock") && values[LIST_SLOT_INDEX.first] === SUPERADMIN_BOOTSTRAP_LOCK_KEY) {
			const previous: Promise<void> = lockTail;
			lockTail = new Promise<void>((resolve: () => void): void => {
				scope.release = resolve;
			});
			await previous;
			scope.acquired.push(true);
			world.steps.push("lock");
		}
		return 1;
	});
}

function harness(overrides: { readonly existingSuperAdmins?: readonly string[]; readonly roleExists?: boolean; readonly emailTaken?: boolean } = {}): Harness {
	const world: World = { superAdmins: [...(overrides.existingSuperAdmins ?? [])], steps: [] };
	lockTail = Promise.resolve();
	installAdvisoryLock(world);

	const db = createTestPrisma();
	const requestContext = new RequestContextService();
	const tenantTx = new TenantTransactionService(db, requestContext);
	const withSystemOperation = vi.spyOn(tenantTx, "withSystemOperation").mockImplementation(async (_context, handler) => {
		const scope = { release: (): void => undefined, acquired: new Array<boolean>() };
		return transactionScope.run(scope, async () => {
			try {
				return await handler(db);
			} finally {
				scope.release();
			}
		});
	});

	const repository = new SuperAdminBootstrapRepository();
	vi.spyOn(repository, "countActiveSuperAdmins").mockImplementation(async () => {
		const seen: number = world.superAdmins.length;
		// A real query yields to the event loop: without the advisory lock a concurrent run reads the same stale count.
		await Promise.resolve();
		await Promise.resolve();
		return seen;
	});
	const emailExists = vi.spyOn(repository, "emailExists").mockResolvedValue(overrides.emailTaken === true);
	const createSuperAdmin = vi.spyOn(repository, "createSuperAdmin").mockImplementation(async (record) => {
		await Promise.resolve();
		const id = `user-${String(world.superAdmins.length + 1)}`;
		world.superAdmins.push(id);
		world.steps.push("create");
		return userRow(id, record.email, record.fullName);
	});

	const roles = new RoleRepository(db);
	const findRole = vi.spyOn(roles, "findByName").mockResolvedValue(overrides.roleExists === false ? null : role());
	const assignments = new RoleAssignmentRepository();
	const assignRole = vi.spyOn(assignments, "assignRoleToUser").mockImplementation((userId) => Promise.resolve(assignmentRow(userId)));
	const conflicts = new ConflictDetectionService(roles, assignments, tenantTx);
	vi.spyOn(conflicts, "assertUsersHaveNoConflicts").mockResolvedValue(undefined);

	const hash = vi.fn<PasswordHasher["hash"]>().mockResolvedValue("bcrypt-hash-of-password");
	const hasher = { hash };
	const operator: OperatorIdentityProvider = { current: () => OPERATOR };

	const service = new SuperAdminBootstrapService(
		tenantTx,
		repository,
		roles,
		assignments,
		conflicts,
		new AuthorizationAuditService(requestContext),
		hasher,
		operator,
		() => NOW,
	);
	return { service, world, withSystemOperation, createSuperAdmin, emailExists, findRole, assignRole, hash };
}

describe("SuperAdminBootstrapService", () => {
	beforeEach(() => {
		mocks.auditCreate.mockReset();
		mocks.auditCreate.mockResolvedValue(null);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("creates a verified SuperAdmin whose MFA enrollment is due immediately, with a hashed password", async () => {
		const { service, createSuperAdmin, hash } = harness();

		const outcome = await service.bootstrap(REQUEST);

		expect(outcome).toEqual({ userId: "user-1", email: "root@acme.test", fullName: "Root Admin" });
		expect(hash).toHaveBeenCalledWith(PASSWORD);
		expect(createSuperAdmin.mock.lastCall?.[LIST_SLOT_INDEX.first]).toEqual({
			email: "root@acme.test",
			fullName: "Root Admin",
			passwordHash: "bcrypt-hash-of-password",
			emailVerifiedAt: NOW,
			mfaEnrollmentDeadline: NOW,
			referralCodeIssuedAt: NOW,
		});
		expect(JSON.stringify(outcome)).not.toContain(PASSWORD);
	});

	it("runs under the allowlisted bootstrap operation, takes the lock first, and checks before it creates", async () => {
		const { service, world, withSystemOperation } = harness();

		await service.bootstrap(REQUEST);

		expect(withSystemOperation).toHaveBeenCalledWith(
			{ operation: SUPERADMIN_BOOTSTRAP_OPERATION, reason: SUPERADMIN_BOOTSTRAP_REASON, actorUserId: null },
			expect.any(Function),
		);
		expect(world.steps).toEqual(["lock", "create"]);
		expect(mocks.executeRaw.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first].join("?")).toContain("pg_advisory_xact_lock");
	});

	it("assigns the SuperAdmin role and records both audit rows with the system operation as the actor and the operator in the detail", async () => {
		const { service, assignRole } = harness();

		await service.bootstrap(REQUEST);

		expect(assignRole).toHaveBeenCalledWith("user-1", ROLE_ID, SUPERADMIN_BOOTSTRAP_OPERATION, expect.anything());
		const rows = mocks.auditCreate.mock.calls.map((call) => call[LIST_SLOT_INDEX.first].data);
		expect(rows.map((row) => row.action)).toEqual(["SUPER_ADMIN_BOOTSTRAPPED", "ROLE_ASSIGNED_AT_PROVISIONING"]);
		for (const row of rows) {
			expect(row).toMatchObject({ actorKind: "SYSTEM_OPERATION", actorId: SUPERADMIN_BOOTSTRAP_OPERATION, targetUserId: "user-1", targetRoleId: ROLE_ID });
			expect(JSON.parse(row.detail ?? "{}")).toEqual({ email: "root@acme.test", ranBy: OPERATOR });
			expect(row.detail).not.toContain(PASSWORD);
		}
	});

	it("refuses when an active SuperAdmin already exists, and writes nothing", async () => {
		const { service, createSuperAdmin, assignRole } = harness({ existingSuperAdmins: ["user-existing"] });

		await expect(service.bootstrap(REQUEST)).rejects.toBeInstanceOf(SuperAdminAlreadyExistsError);

		expect(createSuperAdmin).not.toHaveBeenCalled();
		expect(assignRole).not.toHaveBeenCalled();
		expect(mocks.auditCreate).not.toHaveBeenCalled();
	});

	it("refuses an email that already belongs to an account (it never promotes one)", async () => {
		const { service, createSuperAdmin } = harness({ emailTaken: true });

		await expect(service.bootstrap(REQUEST)).rejects.toBeInstanceOf(BootstrapEmailTakenError);

		expect(createSuperAdmin).not.toHaveBeenCalled();
	});

	it("maps a concurrent signup's unique violation to the email-taken error", async () => {
		const { service, createSuperAdmin } = harness();
		createSuperAdmin.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" }));

		await expect(service.bootstrap(REQUEST)).rejects.toBeInstanceOf(BootstrapEmailTakenError);
	});

	it("tells the operator to load the reference data when the SuperAdmin role does not exist, creating nothing", async () => {
		const { service, createSuperAdmin } = harness({ roleExists: false });

		await expect(service.bootstrap(REQUEST)).rejects.toBeInstanceOf(SuperAdminRoleMissingError);

		expect(createSuperAdmin).not.toHaveBeenCalled();
		expect(mocks.auditCreate).not.toHaveBeenCalled();
	});

	it("hashes the password before the transaction opens, so the lock is never held across the slow hash", async () => {
		const { service, withSystemOperation, hash } = harness();

		await service.bootstrap(REQUEST);

		expect(hash.mock.invocationCallOrder[LIST_SLOT_INDEX.first]).toBeLessThan(withSystemOperation.mock.invocationCallOrder[LIST_SLOT_INDEX.first] ?? 0);
	});

	it("lets exactly one of two concurrent runs succeed: the loser waits on the lock, then sees the winner and refuses", async () => {
		const { service, world } = harness();

		const results = await Promise.allSettled([
			service.bootstrap(REQUEST),
			service.bootstrap({ ...REQUEST, identity: { email: "second@acme.test", fullName: "Second Admin" } }),
		]);

		expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
		const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
		expect(rejected).toHaveLength(1);
		expect(rejected[LIST_SLOT_INDEX.first]?.reason).toBeInstanceOf(SuperAdminAlreadyExistsError);
		expect(world.superAdmins).toHaveLength(1);
		expect(mocks.auditCreate).toHaveBeenCalledTimes(2);
	});
});
