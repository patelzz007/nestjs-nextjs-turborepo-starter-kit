import type { PermissionAuditLog } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RequestContextService } from "../../../common/context/request-context";
import { createTestPrisma } from "../../../../test/support/test-service-graph";
import { AuthorizationAuditService } from "./authorization-audit.service";

const EPOCH = BigInt(1_790_812_800_000);

function row(): PermissionAuditLog {
	return {
		id: "log-1",
		actorKind: "USER",
		actorId: "admin-1",
		targetUserId: "user-2",
		targetRoleId: "role-1",
		permissionId: null,
		action: "ROLE_ASSIGNED",
		detail: null,
		correlationId: "corr-1",
		impersonatorId: "root-1",
		isDeleted: false,
		deletedAt: null,
		createdAt: EPOCH,
		updatedAt: EPOCH,
	};
}

describe("AuthorizationAuditService", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("writes on the caller's client with the real actor, the request correlation id and the impersonator", async () => {
		const db = createTestPrisma();
		const create = vi.spyOn(db.permissionAuditLog, "create").mockResolvedValue(row());
		const requestContext = new RequestContextService();

		await requestContext.run({ correlationId: "corr-1", ip: "203.0.113.7", userAgent: "vitest" }, async () => {
			requestContext.bindPrincipal({ userId: "admin-1", impersonatorId: "root-1" });
			await new AuthorizationAuditService(requestContext).record(
				{ action: "ROLE_ASSIGNED", actor: { kind: "USER", userId: "admin-1" }, targetUserId: "user-2", targetRoleId: "role-1" },
				db,
			);
		});

		expect(create).toHaveBeenCalledWith({
			data: {
				actorKind: "USER",
				actorId: "admin-1",
				targetUserId: "user-2",
				targetRoleId: "role-1",
				permissionId: null,
				action: "ROLE_ASSIGNED",
				detail: null,
				correlationId: "corr-1",
				impersonatorId: "root-1",
			},
		});
	});

	it("records a scheduled job by its allowlisted operation, never a placeholder actor", async () => {
		const db = createTestPrisma();
		const create = vi.spyOn(db.permissionAuditLog, "create").mockResolvedValue(row());

		await new AuthorizationAuditService(new RequestContextService()).record(
			{ action: "PERMISSION_EXPIRED", actor: { kind: "SYSTEM_OPERATION", operation: "maintenance.permission_expiry" }, targetUserId: "user-2", permissionId: "perm-1" },
			db,
		);

		expect(create.mock.lastCall?.[0]?.data).toMatchObject({
			actorKind: "SYSTEM_OPERATION",
			actorId: "maintenance.permission_expiry",
			correlationId: null,
			impersonatorId: null,
		});
	});

	it("propagates a failed insert instead of swallowing it (the surrounding mutation must roll back)", async () => {
		const db = createTestPrisma();
		vi.spyOn(db.permissionAuditLog, "create").mockRejectedValue(new Error("insert failed"));

		await expect(
			new AuthorizationAuditService(new RequestContextService()).record({ action: "ROLE_REMOVED", actor: { kind: "USER", userId: "admin-1" } }, db),
		).rejects.toThrow("insert failed");
	});
});
