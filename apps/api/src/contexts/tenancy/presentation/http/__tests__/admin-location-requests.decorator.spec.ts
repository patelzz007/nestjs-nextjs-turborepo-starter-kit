import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { PLATFORM_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RewardsAdminInvitesController, RewardsAdminLocationRequestsController, RewardsAdminMerchantsController } from "../merchant-admin.controller";
import { TenantAdminController } from "../tenant-admin.controller";
import { handlerOf } from "../../../../../../test/support/route-metadata";

describe("admin merchant routes", () => {
	const reflector = new Reflector();

	it("runs the location-request list under tenant.location.admin_list and does not also bypass", () => {
		expect(reflector.get(PLATFORM_OPERATION_KEY, RewardsAdminLocationRequestsController)).toBe("tenant.location.admin_list");
	});

	it("names the merchant read and the invite write, and does not bypass the class", () => {
		expect(reflector.get(PLATFORM_OPERATION_KEY, handlerOf(RewardsAdminMerchantsController.prototype, "listMerchants"))).toBe("tenant.merchant.admin_read");
		expect(reflector.get(PLATFORM_OPERATION_KEY, handlerOf(RewardsAdminMerchantsController.prototype, "updateKyb"))).toBe("tenant.kyb.admin_decide");
		expect(reflector.get(PLATFORM_OPERATION_KEY, handlerOf(RewardsAdminInvitesController.prototype, "createInvite"))).toBe("tenant.provision.admin_merchant_invite");
		expect(reflector.get(PLATFORM_OPERATION_KEY, handlerOf(TenantAdminController.prototype, "createInvite"))).toBe("tenant.provision.platform_invite");
	});
});
