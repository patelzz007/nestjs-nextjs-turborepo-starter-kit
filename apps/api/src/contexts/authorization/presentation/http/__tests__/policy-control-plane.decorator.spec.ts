import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { PLATFORM_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { PolicyControlPlaneController } from "../policy-control-plane.controller";
import { handlerOf } from "../../../../../../test/support/route-metadata";

function handler(name: string): ReturnType<typeof handlerOf> {
	return handlerOf(PolicyControlPlaneController.prototype, name);
}

describe("policy control-plane routes", () => {
	const reflector = new Reflector();

	it("names the operation each route already runs inside its transaction", () => {
		const operations: Readonly<Record<string, string>> = {
			createDraft: "policy.draft.create",
			simulate: "policy.draft.simulate",
			publish: "policy.publish",
		};
		for (const [name, operation] of Object.entries(operations)) {
			expect(reflector.get(PLATFORM_OPERATION_KEY, handler(name))).toBe(operation);
		}
	});
});
