import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { REQUIRED_PERMISSION_KEY } from "../authorization/constants/authorization.constants";
import { AdminAccessGuard } from "../auth/guards/admin-access.guard";
import { AuditTrailController } from "./audit-trail.controller";

const reflector = new Reflector();

describe("AuditTrailController authorization", () => {
	it("is served under the versioned admin prefix and needs admin-panel access", () => {
		expect(reflector.get<string>(PATH_METADATA, AuditTrailController)).toBe(`${API_VERSION_PREFIX}/admin/audit-trail`);
		expect(reflector.get<object[]>(GUARDS_METADATA, AuditTrailController)).toEqual([AdminAccessGuard]);
	});

	it("needs LIST AUDIT_LOG", () => {
		const descriptor: TypedPropertyDescriptor<AuditTrailController["list"]> | undefined = Object.getOwnPropertyDescriptor(AuditTrailController.prototype, "list");
		const handler: AuditTrailController["list"] | undefined = descriptor?.value;
		if (handler === undefined) {
			throw new Error("AuditTrailController.list is not a method");
		}

		expect(reflector.get<object>(REQUIRED_PERMISSION_KEY, handler)).toEqual({ action: "LIST", resource: "AUDIT_LOG" });
	});
});
