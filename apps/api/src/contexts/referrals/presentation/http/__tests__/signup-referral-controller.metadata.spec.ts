import { RequestMethod } from "@nestjs/common";
import { API_VERSION_PREFIX, SignupReferralDashboardSchema, SignupReferralRefereeItemSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { controllerOf, handlerOf, metadataOf, routeOf } from "../../../../../../test/support/route-metadata";
import { IS_PUBLIC_KEY } from "../../../../../platform/presentation/http/security/decorators/public.decorator";
import { SignupReferralController } from "../signup-referral.controller";

describe("SignupReferralController keeps its routes and decorators", () => {
	it("serves the signed-in referrer's dashboard and referees under /auth/signup-referrals, never publicly", () => {
		expect(controllerOf(SignupReferralController)).toEqual({ path: `${API_VERSION_PREFIX}/auth/signup-referrals`, interceptors: [] });
		const prototype = SignupReferralController.prototype;

		expect(routeOf(prototype, "dashboard")).toMatchObject({
			path: "/dashboard",
			method: RequestMethod.GET,
			guards: [],
			contract: { kind: "single", schema: SignupReferralDashboardSchema },
			successStatuses: ["200"],
		});
		expect(routeOf(prototype, "referees")).toMatchObject({
			path: "/referees",
			method: RequestMethod.GET,
			guards: [],
			contract: { kind: "paginated", schema: SignupReferralRefereeItemSchema },
			successStatuses: ["200"],
		});
		for (const name of ["dashboard", "referees"]) {
			expect(metadataOf(IS_PUBLIC_KEY, handlerOf(prototype, name))).toBeUndefined();
		}
	});
});
