import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { PLATFORM_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { PUBLIC_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { ImpersonationController } from "../impersonation.controller";
import { handlerOf } from "../../../../../../test/support/route-metadata";

function handler(name: string): ReturnType<typeof handlerOf> {
	return handlerOf(ImpersonationController.prototype, name);
}

describe("impersonation routes", () => {
	const reflector = new Reflector();

	it("starts under auth.impersonation.start and stops under auth.principal.lookup", () => {
		expect(reflector.get(PLATFORM_OPERATION_KEY, handler("impersonate"))).toBe("auth.impersonation.start");
		expect(reflector.get(PUBLIC_OPERATION_KEY, handler("stopImpersonation"))).toBe("auth.principal.lookup");
	});
});
