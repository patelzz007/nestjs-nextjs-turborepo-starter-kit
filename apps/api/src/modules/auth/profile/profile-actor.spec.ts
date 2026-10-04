import { describe, expect, it } from "vitest";

import { toProfileActor } from "./profile-actor";

const USER_ID = "7d3e9a10-2b4c-4d6e-8f01-23456789abcd";

describe("toProfileActor", () => {
	it("maps an ordinary session to the user acting as themselves", () => {
		expect(toProfileActor({ sub: USER_ID })).toEqual({ kind: "self", userId: USER_ID });
		expect(toProfileActor({ sub: USER_ID, isImpersonating: false })).toEqual({ kind: "self", userId: USER_ID });
	});

	it("maps an impersonation token to an impersonated actor on the impersonated user's profile", () => {
		expect(toProfileActor({ sub: USER_ID, isImpersonating: true })).toEqual({ kind: "impersonated", userId: USER_ID });
	});
});
