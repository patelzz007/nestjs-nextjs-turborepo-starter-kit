import { describe, expect, it } from "vitest";

import { OwnProfileWritePolicy } from "./own-profile-write.policy";

const USER_ID = "7d3e9a10-2b4c-4d6e-8f01-23456789abcd";

describe("OwnProfileWritePolicy", () => {
	const policy = new OwnProfileWritePolicy();

	it("lets a user change their own profile", () => {
		expect(policy.canWrite({ kind: "self", userId: USER_ID })).toEqual({ allowed: true });
	});

	it("refuses a change made through an impersonation session", () => {
		expect(policy.canWrite({ kind: "impersonated", userId: USER_ID })).toEqual({ allowed: false, reason: "impersonated_session" });
	});
});
