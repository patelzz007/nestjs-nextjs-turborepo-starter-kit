import { describe, expect, it } from "vitest";

import { APP_GUARD_ORDER } from "../app-guard-order";

describe("APP_GUARD order", () => {
	it("rejects an outdated app, throttles per IP before authentication, checks mutation intent, then authenticates, throttles per principal, and authorizes", () => {
		expect(APP_GUARD_ORDER.map((guard) => guard.name)).toEqual([
			"MobileAppVersionGuard",
			"PreAuthThrottlerGuard",
			"MutationIntentGuard",
			"ApiKeyAuthGuard",
			"AuthGuard",
			"PrincipalThrottlerGuard",
			"RestrictedSessionGuard",
			"AuthorizationGuard",
		]);
	});
});
