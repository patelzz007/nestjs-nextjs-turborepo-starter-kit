import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { PLATFORM_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { EmailPreviewController } from "../email-preview.controller";
import { handlerOf } from "../../../../../../test/support/route-metadata";

function handler(name: string): ReturnType<typeof handlerOf> {
	return handlerOf(EmailPreviewController.prototype, name);
}

describe("email preview routes", () => {
	const reflector = new Reflector();

	it("sends a sample under email.log.write and leaves the renders unnamed", () => {
		expect(reflector.get(PLATFORM_OPERATION_KEY, handler("sendTest"))).toBe("email.log.write");
		expect(reflector.get(PLATFORM_OPERATION_KEY, handler("list"))).toBeUndefined();
		expect(reflector.get(PLATFORM_OPERATION_KEY, handler("detail"))).toBeUndefined();
	});
});
