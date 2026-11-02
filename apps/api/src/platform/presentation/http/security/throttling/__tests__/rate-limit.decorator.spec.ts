import { describe, expect, it } from "vitest";

import { RATE_LIMIT_POLICY } from "../rate-limit-policy";
import { alwaysOnThrottlersSkippedBy } from "../rate-limit.decorator";

describe("alwaysOnThrottlersSkippedBy", () => {
	it("keeps the per-user backstop on a credential (strict) policy and skips nothing", () => {
		for (const policy of [RATE_LIMIT_POLICY.credential, RATE_LIMIT_POLICY.login, RATE_LIMIT_POLICY.sessionIssue, RATE_LIMIT_POLICY.sessionRefresh]) {
			expect(alwaysOnThrottlersSkippedBy(policy)).toEqual([]);
		}
	});

	it("skips the per-IP credential throttler on a per-user (default) policy", () => {
		for (const policy of [RATE_LIMIT_POLICY.authenticatedMutation, RATE_LIMIT_POLICY.adminSecurityMutation]) {
			expect(alwaysOnThrottlersSkippedBy(policy)).toEqual(["strict"]);
		}
	});

	it("skips both always-on throttlers on an opt-in (webhook) policy", () => {
		expect(alwaysOnThrottlersSkippedBy(RATE_LIMIT_POLICY.webhook)).toEqual(["strict", "default"]);
	});
});
