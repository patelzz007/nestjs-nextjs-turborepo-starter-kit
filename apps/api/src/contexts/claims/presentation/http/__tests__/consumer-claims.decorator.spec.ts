import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { PLATFORM_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { ConsumerClaimsController } from "../consumer-claims.controller";
import { handlerOf } from "../../../../../../test/support/route-metadata";

function handler(name: string): ReturnType<typeof handlerOf> {
	return handlerOf(ConsumerClaimsController.prototype, name);
}

describe("consumer claim routes", () => {
	const reflector = new Reflector();

	it("requests a claim code under claims.otp.request", () => {
		expect(reflector.get(PLATFORM_OPERATION_KEY, handler("requestOtp"))).toBe("claims.otp.request");
	});

	it("claims a reward under claims.reward.claim", () => {
		expect(reflector.get(PLATFORM_OPERATION_KEY, handler("createClaim"))).toBe("claims.reward.claim");
	});
});
