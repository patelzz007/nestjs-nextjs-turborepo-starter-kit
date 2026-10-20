import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { PLATFORM_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { EmailLogController } from "../email-log.controller";
import { handlerOf } from "../../../../../../test/support/route-metadata";

function handler(name: string): ReturnType<typeof handlerOf> {
	return handlerOf(EmailLogController.prototype, name);
}

describe("email log routes", () => {
	const reflector = new Reflector();

	it("reads and streams the log under notifications.email_log.list", () => {
		for (const name of ["list", "stream"]) {
			expect(reflector.get(PLATFORM_OPERATION_KEY, handler(name))).toBe("notifications.email_log.list");
		}
	});
});
