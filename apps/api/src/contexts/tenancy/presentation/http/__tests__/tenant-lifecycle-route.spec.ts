import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { TENANT_LIFECYCLE_ROUTE_KEY } from "../tenant-lifecycle-route.decorator";
import { TenantController } from "../tenant.controller";
import { TenantKybController } from "../tenant-kyb.controller";
import { handlerOf } from "../../../../../../test/support/route-metadata";

describe("tenant lifecycle routes", () => {
	const reflector = new Reflector();

	it("LIFE-002: the status read and KYB resubmit are lifecycle routes, and creating a location is not", () => {
		expect(reflector.get(TENANT_LIFECYCLE_ROUTE_KEY, handlerOf(TenantController.prototype, "getContext"))).toBe(true);
		expect(reflector.get(TENANT_LIFECYCLE_ROUTE_KEY, handlerOf(TenantKybController.prototype, "submitKyb"))).toBe(true);
		expect(reflector.get(TENANT_LIFECYCLE_ROUTE_KEY, handlerOf(TenantController.prototype, "createLocation"))).toBeUndefined();
	});
});
