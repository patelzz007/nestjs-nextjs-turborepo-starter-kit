import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { PLATFORM_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RewardsAdminAnalyticsController } from "../admin-analytics.controller";

describe("platform analytics routes", () => {
	it("reads under reporting.platform_analytics.read and does not bypass every table", () => {
		const reflector = new Reflector();
		expect(reflector.get(PLATFORM_OPERATION_KEY, RewardsAdminAnalyticsController)).toBe("reporting.platform_analytics.read");
	});
});
