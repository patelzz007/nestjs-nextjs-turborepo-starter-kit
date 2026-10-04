import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import { ResourceNotFoundError } from "../../../../platform/persistence/persistence.errors";
import { AuthorizationService } from "../../services/authorization.service";
import { ConflictDetectionService } from "../../services/conflict-detection.service";
import { PrivilegeEscalationService } from "../../services/privilege-escalation.service";
import { PermissionsController } from "../permissions.controller";
import { RolesController } from "../roles.controller";
import { RoleAssignmentPreviewService } from "../services/role-assignment-preview.service";

const MISSING_ID = "9c4f5d85-2d61-4a6b-8d88-3a4b5c6d7e8f";

/** Both RBAC detail endpoints answer a typed 404 — never `200` with a `null` body — for an unknown id. */
describe("RBAC admin detail endpoints", () => {
	async function controllers(): Promise<{ readonly roles: RolesController; readonly permissions: PermissionsController }> {
		const authorization = {
			roles: { findById: vi.fn(() => Promise.resolve(null)) },
			permissions: { findById: vi.fn(() => Promise.resolve(null)) },
		};
		const moduleRef = await Test.createTestingModule({
			controllers: [RolesController, PermissionsController],
			providers: [
				{ provide: AuthorizationService, useValue: authorization },
				{ provide: ConflictDetectionService, useValue: {} },
				{ provide: PrivilegeEscalationService, useValue: {} },
				{ provide: RoleAssignmentPreviewService, useValue: {} },
			],
		}).compile();
		return { roles: moduleRef.get(RolesController), permissions: moduleRef.get(PermissionsController) };
	}

	it("GET /admin/roles/:id throws a 404 ResourceNotFoundError for an unknown role", async () => {
		const { roles } = await controllers();

		await expect(roles.detail(MISSING_ID)).rejects.toBeInstanceOf(ResourceNotFoundError);
		await expect(roles.detail(MISSING_ID)).rejects.toMatchObject({ code: "NOT_FOUND", httpStatus: 404, details: { resourceId: MISSING_ID } });
	});

	it("GET /admin/permissions/:id throws a 404 ResourceNotFoundError for an unknown permission", async () => {
		const { permissions } = await controllers();

		await expect(permissions.detail(MISSING_ID)).rejects.toBeInstanceOf(ResourceNotFoundError);
		await expect(permissions.detail(MISSING_ID)).rejects.toMatchObject({ code: "NOT_FOUND", httpStatus: 404, details: { resourceId: MISSING_ID } });
	});
});
