import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LIST_SLOT_INDEX } from "@workspace/shared";

import { RequestContextService } from "../../../common/context/request-context";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { AuthorizationAuditService } from "../audit/authorization-audit.service";
import { AuthorizationEventEmitter } from "../events/authorization.events";
import { RoleAssignmentRepository } from "../repositories/role-assignment.repository";
import { RbacMutationRunner, type RbacSystemMutationOutcome } from "../services/rbac-mutation.runner";
import { createTestSessionRevocation } from "../services/__tests__/rbac-test-graph";
import { createTestPrisma } from "../../../../test/support/test-service-graph";
import { PERMISSION_EXPIRY_OPERATION, PermissionExpiryCleanup } from "./permission-expiry.cleanup";

const NOW = 1_790_812_800_000;

const mocks = vi.hoisted(() => ({
	findExpiredOverrides: vi.fn(),
	expireOverrides: vi.fn(),
	runs: new Array<{
		readonly operation: string;
		readonly outcome: { readonly result: number; readonly audits: readonly object[]; readonly affectedUserIds: readonly string[] };
	}>(),
}));

vi.mock("../repositories/role-assignment.repository", () => ({
	RoleAssignmentRepository: class {
		public readonly findExpiredOverrides = mocks.findExpiredOverrides;
		public readonly expireOverrides = mocks.expireOverrides;
	},
}));

/** Runs the job's work on a sentinel client and records the outcome (the runner's own transaction contract has its own spec). */
vi.mock("../services/rbac-mutation.runner", () => ({
	RbacMutationRunner: class {
		public async runAsSystemOperation<T>(operation: string, _reason: string, work: (tx: object) => Promise<RbacSystemMutationOutcome<T>>): Promise<T> {
			const outcome = await work({});
			mocks.runs.push({ operation, outcome: { result: Number(outcome.result), audits: outcome.audits, affectedUserIds: outcome.affectedUserIds } });
			return outcome.result;
		}
	},
}));

function job(): PermissionExpiryCleanup {
	const prisma = createTestPrisma();
	const requestContext = new RequestContextService();
	return new PermissionExpiryCleanup(
		new RoleAssignmentRepository(),
		new RbacMutationRunner(
			new TenantTransactionService(prisma, requestContext),
			new AuthorizationAuditService(requestContext),
			createTestSessionRevocation(prisma),
			new AuthorizationEventEmitter(),
		),
	);
}

describe("PermissionExpiryCleanup", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		mocks.runs.length = 0;
		mocks.expireOverrides.mockImplementation((ids: readonly string[]) => Promise.resolve(ids.length));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("expires exactly the overrides it found, in one RBAC transaction under the expiry operation, auditing each with the operation as actor", async () => {
		mocks.findExpiredOverrides.mockResolvedValue([
			{ id: "up-1", userId: "user-1", permissionId: "perm-a", effect: "ALLOW" },
			{ id: "up-2", userId: "user-1", permissionId: "perm-b", effect: "DENY" },
			{ id: "up-3", userId: "user-2", permissionId: "perm-a", effect: "ALLOW" },
		]);

		await job().handleExpiryCleanup();

		expect(mocks.findExpiredOverrides).toHaveBeenCalledWith(NOW, expect.anything());
		expect(mocks.expireOverrides).toHaveBeenCalledWith(["up-1", "up-2", "up-3"], NOW, expect.anything());
		expect(mocks.runs).toHaveLength(1);
		expect(mocks.runs[LIST_SLOT_INDEX.first]?.operation).toBe(PERMISSION_EXPIRY_OPERATION);
		expect(mocks.runs[LIST_SLOT_INDEX.first]?.outcome).toEqual({
			result: 3,
			audits: [
				{ action: "PERMISSION_EXPIRED", targetUserId: "user-1", permissionId: "perm-a", detail: JSON.stringify({ effect: "ALLOW", expiredAt: NOW }) },
				{ action: "PERMISSION_EXPIRED", targetUserId: "user-1", permissionId: "perm-b", detail: JSON.stringify({ effect: "DENY", expiredAt: NOW }) },
				{ action: "PERMISSION_EXPIRED", targetUserId: "user-2", permissionId: "perm-a", detail: JSON.stringify({ effect: "ALLOW", expiredAt: NOW }) },
			],
			affectedUserIds: ["user-1", "user-1", "user-2"],
		});
	});

	it("produces no audit row and no affected users when nothing expired", async () => {
		mocks.findExpiredOverrides.mockResolvedValue([]);

		await job().handleExpiryCleanup();

		expect(mocks.runs[LIST_SLOT_INDEX.first]?.outcome).toEqual({ result: 0, audits: [], affectedUserIds: [] });
	});

	it("propagates a failure instead of logging and continuing", async () => {
		mocks.findExpiredOverrides.mockRejectedValue(new Error("lock timeout"));

		await expect(job().handleExpiryCleanup()).rejects.toThrow("lock timeout");
	});
});
