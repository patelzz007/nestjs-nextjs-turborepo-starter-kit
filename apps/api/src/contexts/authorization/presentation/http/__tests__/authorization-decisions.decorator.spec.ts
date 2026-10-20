import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { PLATFORM_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { AuthorizationDecisionsController } from "../authorization-decisions.controller";
import { handlerOf } from "../../../../../../test/support/route-metadata";

function handler(name: string): ReturnType<typeof handlerOf> {
	return handlerOf(AuthorizationDecisionsController.prototype, name);
}

describe("authorization decision routes", () => {
	const reflector = new Reflector();

	it("explains under auth.principal.lookup and leaves the caller's own capability check unnamed", () => {
		expect(reflector.get(PLATFORM_OPERATION_KEY, handler("explain"))).toBe("auth.principal.lookup");
		expect(reflector.get(PLATFORM_OPERATION_KEY, handler("decide"))).toBeUndefined();
	});
});
