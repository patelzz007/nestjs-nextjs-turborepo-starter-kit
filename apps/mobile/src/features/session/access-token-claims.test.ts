import { testAccessToken } from "../../../test/jwt";
import { readSessionScope } from "./access-token-claims";

describe("readSessionScope", () => {
	it("reads a full session", () => {
		expect(readSessionScope(testAccessToken({ sessionScope: "full" }))).toEqual({ scope: "full" });
	});

	it("treats a token without the claim as full (tokens minted before the claim)", () => {
		const header = btoa(JSON.stringify({ alg: "HS256" }));
		const payload = btoa(JSON.stringify({ sub: "user-1" })).replace(/=+$/, "");
		expect(readSessionScope(`${header}.${payload}.sig`)).toEqual({ scope: "full" });
	});

	it("reads a session restricted to 2FA enrollment", () => {
		expect(readSessionScope(testAccessToken({ sessionScope: "restricted", isEmailVerified: true }))).toEqual({ scope: "restricted", enrollmentReason: "mfa_enrollment" });
	});

	it("puts email verification first while the email is unverified", () => {
		expect(readSessionScope(testAccessToken({ sessionScope: "restricted", isEmailVerified: false }))).toEqual({ scope: "restricted", enrollmentReason: "email_verification" });
	});

	it.each([
		["not a JWT", "abc"],
		["a payload that is not base64", "a.***.c"],
		["a payload that is not JSON", `a.${btoa("not json")}.c`],
		["claims of the wrong type", `a.${btoa(JSON.stringify({ sessionScope: "everything" }))}.c`],
	])("reads %s as unusable (null)", (_what, token) => {
		expect(readSessionScope(token)).toBeNull();
	});
});
