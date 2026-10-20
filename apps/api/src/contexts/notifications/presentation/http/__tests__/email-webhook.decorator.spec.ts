import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { PUBLIC_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { EmailWebhookController } from "../email-webhook.controller";
import { handlerOf } from "../../../../../../test/support/route-metadata";

function handler(name: string): ReturnType<typeof handlerOf> {
	return handlerOf(EmailWebhookController.prototype, name);
}

describe("email delivery webhook", () => {
	const reflector = new Reflector();

	it("records the event under email.log.write and does not bypass every table", () => {
		expect(reflector.get(PUBLIC_OPERATION_KEY, handler("receive"))).toBe("email.log.write");
	});
});
