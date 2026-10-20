import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { PUBLIC_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { ConsumerRewardsController } from "../consumer-rewards.controller";
import { handlerOf } from "../../../../../../test/support/route-metadata";

function handler(name: string): ReturnType<typeof handlerOf> {
	return handlerOf(ConsumerRewardsController.prototype, name);
}

describe("public marketplace routes", () => {
	const reflector = new Reflector();

	it("reads published rewards under marketplace.published_rewards.read", () => {
		expect(reflector.get(PUBLIC_OPERATION_KEY, handler("listRewards"))).toBe("marketplace.published_rewards.read");
		expect(reflector.get(PUBLIC_OPERATION_KEY, handler("getReward"))).toBe("marketplace.published_rewards.read");
	});
});
