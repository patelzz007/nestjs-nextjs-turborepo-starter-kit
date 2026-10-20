import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { PLATFORM_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { PUBLIC_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { AuthController } from "../auth.controller";
import { handlerOf } from "../../../../../../test/support/route-metadata";

function handler(name: string): ReturnType<typeof handlerOf> {
	return handlerOf(AuthController.prototype, name);
}

describe("public auth routes whose request connection is one operation", () => {
	const reflector = new Reflector();

	it("names the operation, and does not keep the route-wide bypass", () => {
		const operations: Readonly<Record<string, string>> = {
			signup: "auth.signup.register",
			resendVerification: "auth.email_verification.send",
			forgotPassword: "auth.password_reset.request",
			resetPassword: "auth.password_reset.complete",
			validateResetToken: "auth.password_reset.lookup",
			verifyEmail: "auth.email_verification.confirm",
		};

		for (const [name, operation] of Object.entries(operations)) {
			expect(reflector.get(PUBLIC_OPERATION_KEY, handler(name))).toBe(operation);
		}
	});

	it("reads and unlocks platform admin users under their own operations", () => {
		expect(reflector.get(PLATFORM_OPERATION_KEY, handler("getAdminUsersList"))).toBe("auth.admin_users.read");
		expect(reflector.get(PLATFORM_OPERATION_KEY, handler("getAdminUserDetail"))).toBe("auth.admin_users.read");
		expect(reflector.get(PLATFORM_OPERATION_KEY, handler("unlockUser"))).toBe("auth.admin_users.unlock");
	});

	it("issues a session under auth.principal.lookup", () => {
		expect(reflector.get(PUBLIC_OPERATION_KEY, handler("login"))).toBe("auth.principal.lookup");
		expect(reflector.get(PUBLIC_OPERATION_KEY, handler("verifyLogin"))).toBe("auth.principal.lookup");
	});
});
