import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { PLATFORM_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { PUBLIC_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { AuditController } from "../audit.controller";
import { CapabilitiesCatalogController } from "../capabilities-catalog.controller";
import { SupportAccessController } from "../support-access.controller";
import { PermissionsController } from "../permissions.controller";
import { RolesController } from "../roles.controller";
import { handlerOf } from "../../../../../../test/support/route-metadata";

describe("capability catalog route", () => {
	it("reads under authorization.capability_catalog.read and does not bypass every table", () => {
		const reflector = new Reflector();
		expect(reflector.get(PUBLIC_OPERATION_KEY, CapabilitiesCatalogController)).toBe("authorization.capability_catalog.read");
	});
});

describe("permission audit log route", () => {
	it("runs under authorization.audit_log.read", () => {
		expect(new Reflector().get(PLATFORM_OPERATION_KEY, handlerOf(AuditController.prototype, "list"))).toBe("authorization.audit_log.read");
	});
});

describe("RBAC admin routes", () => {
	const reflector = new Reflector();

	it("runs role and permission changes under authorization.rbac.mutate", () => {
		expect(reflector.get(PLATFORM_OPERATION_KEY, handlerOf(RolesController.prototype, "create"))).toBe("authorization.rbac.mutate");
		expect(reflector.get(PLATFORM_OPERATION_KEY, handlerOf(PermissionsController.prototype, "grantToUser"))).toBe("authorization.rbac.mutate");
	});

	it("reads the role and permission catalogs under authorization.rbac.catalog.read", () => {
		expect(reflector.get(PLATFORM_OPERATION_KEY, handlerOf(RolesController.prototype, "list"))).toBe("authorization.rbac.catalog.read");
		expect(reflector.get(PLATFORM_OPERATION_KEY, handlerOf(RolesController.prototype, "detail"))).toBe("authorization.rbac.catalog.read");
		expect(reflector.get(PLATFORM_OPERATION_KEY, handlerOf(PermissionsController.prototype, "list"))).toBe("authorization.rbac.catalog.read");
		expect(reflector.get(PLATFORM_OPERATION_KEY, handlerOf(PermissionsController.prototype, "detail"))).toBe("authorization.rbac.catalog.read");
		expect(reflector.get(PLATFORM_OPERATION_KEY, handlerOf(PermissionsController.prototype, "listGroups"))).toBe("authorization.rbac.catalog.read");
		expect(reflector.get(PLATFORM_OPERATION_KEY, handlerOf(PermissionsController.prototype, "checkPermission"))).toBe("auth.principal.lookup");
		expect(reflector.get(PLATFORM_OPERATION_KEY, handlerOf(RolesController.prototype, "preview"))).toBe("authorization.rbac.inspect");
	});

	it("names support-access request, approval, and revoke", () => {
		expect(reflector.get(PLATFORM_OPERATION_KEY, handlerOf(SupportAccessController.prototype, "requestGrant"))).toBe("support_access.grant");
		expect(reflector.get(PLATFORM_OPERATION_KEY, handlerOf(SupportAccessController.prototype, "approve"))).toBe("support_access.approve");
		expect(reflector.get(PLATFORM_OPERATION_KEY, handlerOf(SupportAccessController.prototype, "revoke"))).toBe("support_access.revoke");
	});
});
