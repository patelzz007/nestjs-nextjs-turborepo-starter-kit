import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { PLATFORM_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { MfaRecoveryController } from "../mfa-recovery.controller";
import { handlerOf } from "../../../../../../test/support/route-metadata";

function handler(name: string): ReturnType<typeof handlerOf> {
	return handlerOf(MfaRecoveryController.prototype, name);
}

describe("MFA recovery admin routes", () => {
	const reflector = new Reflector();

	it("lists under auth.mfa_recovery.list and reviews under auth.mfa_recovery.review", () => {
		expect(reflector.get(PLATFORM_OPERATION_KEY, handler("listRecoveryRequests"))).toBe("auth.mfa_recovery.list");
		expect(reflector.get(PLATFORM_OPERATION_KEY, handler("reviewRecovery"))).toBe("auth.mfa_recovery.review");
		expect(reflector.get(PLATFORM_OPERATION_KEY, handler("initiateRecovery"))).toBeUndefined();
		expect(reflector.get(PLATFORM_OPERATION_KEY, handler("getRecoveryStatus"))).toBeUndefined();
	});
});
