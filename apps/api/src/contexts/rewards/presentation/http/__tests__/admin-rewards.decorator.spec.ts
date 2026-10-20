import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { PLATFORM_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RewardsAdminRewardsController } from "../admin-rewards.controller";

describe("admin reward review routes", () => {
	it("runs under rewards.admin_review and does not bypass every table", () => {
		const reflector = new Reflector();
		expect(reflector.get(PLATFORM_OPERATION_KEY, RewardsAdminRewardsController)).toBe("rewards.admin_review");
	});
});
