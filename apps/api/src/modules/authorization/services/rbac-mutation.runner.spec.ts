import type { PermissionAuditLog } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { RequestContextService } from "../../../common/context/request-context";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { AuthorizationAuditService } from "../audit/authorization-audit.service";
import { AuthorizationEventEmitter } from "../events/authorization.events";
import { RbacMutationRunner } from "./rbac-mutation.runner";
import { UserSessionRevocationService } from "./user-session-revocation.service";
import { createTestSessionRevocation } from "./__tests__/rbac-test-graph";
import { createTestPrisma } from "../../../../test/support/test-service-graph";

const ACTOR = { id: "admin-1", isSuperAdmin: false };
const EPOCH = BigInt(1_790_812_800_000);

function auditRow(): PermissionAuditLog {
	return {
		id: "log-1",
		actorKind: "USER",
		actorId: ACTOR.id,
		targetUserId: "user-2",
		targetRoleId: "role-1",
		permissionId: null,
		action: "ROLE_ASSIGNED",
		detail: null,
		correlationId: "corr-1",
		impersonatorId: null,
		isDeleted: false,
		deletedAt: null,
		createdAt: EPOCH,
		updatedAt: EPOCH,
	};
}

const mocks = vi.hoisted(() => ({
	steps: new Array<string>(),
	executeRaw: vi.fn(),
	auditCreate: vi.fn<(args: { readonly data: Readonly<Record<string, string | null>> }) => Promise<PermissionAuditLog>>(),
}));

vi.mock("../../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly $executeRaw = mocks.executeRaw;
		public readonly permissionAuditLog = { create: mocks.auditCreate };
	},
}));

interface Harness {
	readonly runner: RbacMutationRunner;
	readonly withSystemOperation: MockInstance<TenantTransactionService["withSystemOperation"]>;
	readonly afterCommit: MockInstance<UserSessionRevocationService["afterRevocationCommitted"]>;
	readonly emit: MockInstance<AuthorizationEventEmitter["emitUsersMeInvalidate"]>;
}

/** Wires a runner whose transaction records `begin` / `commit` / `rollback` around the real handler. */
function harness(): Harness {
	const db = createTestPrisma();
	const requestContext = new RequestContextService();
	const tenantTx = new TenantTransactionService(db, requestContext);
	const withSystemOperation = vi.spyOn(tenantTx, "withSystemOperation").mockImplementation(async (_context, handler) => {
		mocks.steps.push("begin");
		try {
			const result = await handler(db);
			mocks.steps.push("commit");
			return result;
		} catch (error) {
			mocks.steps.push("rollback");
			throw error;
		}
	});
	const sessionRevocation = createTestSessionRevocation(db);
	vi.spyOn(sessionRevocation, "revokeWithinTransaction").mockImplementation(() => {
		mocks.steps.push("revoke");
		return Promise.resolve();
	});
	const afterCommit = vi.spyOn(sessionRevocation, "afterRevocationCommitted").mockImplementation(() => {
		mocks.steps.push("invalidate");
		return Promise.resolve();
	});
	const events = new AuthorizationEventEmitter();
	const emit = vi.spyOn(events, "emitUsersMeInvalidate");
	return { runner: new RbacMutationRunner(tenantTx, new AuthorizationAuditService(requestContext), sessionRevocation, events), withSystemOperation, afterCommit, emit };
}

describe("RbacMutationRunner", () => {
	beforeEach(() => {
		mocks.steps.length = 0;
		mocks.executeRaw.mockImplementation(() => {
			mocks.steps.push("lock");
			return Promise.resolve(1);
		});
		mocks.auditCreate.mockReset();
		mocks.auditCreate.mockImplementation(() => {
			mocks.steps.push("audit");
			return Promise.resolve(auditRow());
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("runs lock → write → revocation → audit in ONE allowlisted transaction, and invalidates only after commit", async () => {
		const { runner, withSystemOperation, afterCommit, emit } = harness();

		const result = await runner.run(ACTOR, "Assign role to user", async () => {
			mocks.steps.push("write");
			return Promise.resolve({
				kind: "changed",
				result: "ok",
				audit: { action: "ROLE_ASSIGNED", targetUserId: "user-2", targetRoleId: "role-1" },
				affectedUserIds: ["user-2", "user-2"],
			});
		});

		expect(result).toBe("ok");
		expect(mocks.steps).toEqual(["begin", "lock", "write", "revoke", "audit", "commit", "invalidate"]);
		expect(withSystemOperation).toHaveBeenCalledWith({ operation: "authorization.rbac.mutate", reason: "Assign role to user", actorUserId: "admin-1" }, expect.any(Function));
		expect(mocks.auditCreate.mock.lastCall?.[0].data).toMatchObject({
			action: "ROLE_ASSIGNED",
			actorKind: "USER",
			actorId: "admin-1",
			targetUserId: "user-2",
			targetRoleId: "role-1",
		});
		expect(afterCommit).toHaveBeenCalledWith(["user-2"], "rbac_mutation");
		expect(emit).toHaveBeenCalledWith(["user-2"]);
	});

	it("rolls the whole mutation back when the audit insert fails — no invalidation, no event", async () => {
		const { runner, afterCommit, emit } = harness();
		mocks.auditCreate.mockRejectedValue(new Error("permission_audit_logs insert failed"));

		await expect(
			runner.run(ACTOR, "Remove role", () =>
				Promise.resolve({ kind: "changed", result: undefined, audit: { action: "ROLE_REMOVED", targetUserId: "user-2" }, affectedUserIds: ["user-2"] }),
			),
		).rejects.toThrow("permission_audit_logs insert failed");

		expect(mocks.steps).toEqual(["begin", "lock", "revoke", "rollback"]);
		expect(afterCommit).not.toHaveBeenCalled();
		expect(emit).not.toHaveBeenCalled();
	});

	it("rolls back when the work itself throws (e.g. an escalation or invariant check)", async () => {
		const { runner, afterCommit } = harness();

		await expect(runner.run(ACTOR, "Sync roles", () => Promise.reject(new Error("forbidden")))).rejects.toThrow("forbidden");

		expect(mocks.steps).toEqual(["begin", "lock", "rollback"]);
		expect(mocks.auditCreate).not.toHaveBeenCalled();
		expect(afterCommit).not.toHaveBeenCalled();
	});

	it("writes no audit row and revokes nothing for an unchanged (idempotent) outcome", async () => {
		const { runner, afterCommit } = harness();

		await runner.run(ACTOR, "Attach default role", () => Promise.resolve({ kind: "unchanged", result: undefined }));

		expect(mocks.steps).toEqual(["begin", "lock", "commit"]);
		expect(mocks.auditCreate).not.toHaveBeenCalled();
		expect(afterCommit).not.toHaveBeenCalled();
	});

	it("audits catalog changes that affect nobody without any post-commit invalidation", async () => {
		const { runner, afterCommit } = harness();

		await runner.run(ACTOR, "Create role", () =>
			Promise.resolve({ kind: "changed", result: undefined, audit: { action: "ROLE_CREATED", targetRoleId: "role-9" }, affectedUserIds: [] }),
		);

		expect(mocks.steps).toEqual(["begin", "lock", "revoke", "audit", "commit"]);
		expect(afterCommit).not.toHaveBeenCalled();
	});
	it("runs a scheduled job under its own operation, records one audit row per change with the operation as actor, then invalidates", async () => {
		const { runner, withSystemOperation, afterCommit, emit } = harness();

		const result = await runner.runAsSystemOperation("maintenance.permission_expiry", "Expire grants", async () => {
			mocks.steps.push("write");
			return Promise.resolve({
				result: 2,
				audits: [
					{ action: "PERMISSION_EXPIRED", targetUserId: "user-1", permissionId: "perm-1" },
					{ action: "PERMISSION_EXPIRED", targetUserId: "user-2", permissionId: "perm-1" },
				],
				affectedUserIds: ["user-1", "user-2"],
			});
		});

		expect(result).toBe(2);
		expect(mocks.steps).toEqual(["begin", "lock", "write", "revoke", "audit", "audit", "commit", "invalidate"]);
		expect(withSystemOperation).toHaveBeenCalledWith({ operation: "maintenance.permission_expiry", reason: "Expire grants", actorUserId: null }, expect.any(Function));
		expect(mocks.auditCreate.mock.calls.map((call) => call[0].data)).toEqual([
			expect.objectContaining({ actorKind: "SYSTEM_OPERATION", actorId: "maintenance.permission_expiry", targetUserId: "user-1" }),
			expect.objectContaining({ actorKind: "SYSTEM_OPERATION", actorId: "maintenance.permission_expiry", targetUserId: "user-2" }),
		]);
		expect(afterCommit).toHaveBeenCalledWith(["user-1", "user-2"], "rbac_mutation");
		expect(emit).toHaveBeenCalledWith(["user-1", "user-2"]);
	});

	it("a scheduled job that changed nothing writes no audit row and revokes nothing", async () => {
		const { runner, afterCommit } = harness();

		await runner.runAsSystemOperation("maintenance.permission_expiry", "Expire grants", () => Promise.resolve({ result: 0, audits: [], affectedUserIds: [] }));

		expect(mocks.steps).toEqual(["begin", "lock", "commit"]);
		expect(afterCommit).not.toHaveBeenCalled();
	});
});
