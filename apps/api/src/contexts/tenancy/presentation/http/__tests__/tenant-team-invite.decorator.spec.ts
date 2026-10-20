import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { PUBLIC_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { TenantTeamInviteController } from "../tenant-team-invite.controller";
import { handlerOf } from "../../../../../../test/support/route-metadata";

function handler(name: string): ReturnType<typeof handlerOf> {
	return handlerOf(TenantTeamInviteController.prototype, name);
}

describe("team invite routes", () => {
	const reflector = new Reflector();

	it("registers and signs in under tenant.invitation.register_and_accept", () => {
		expect(reflector.get(PUBLIC_OPERATION_KEY, handler("registerAndAcceptTeamInvite"))).toBe("tenant.invitation.register_and_accept");
	});

	it("previews a token under tenant.invitation.resolve_token", () => {
		expect(reflector.get(PUBLIC_OPERATION_KEY, handler("validateTeamInvite"))).toBe("tenant.invitation.resolve_token");
	});
});
