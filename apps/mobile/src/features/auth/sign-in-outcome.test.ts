import { LoginClientResponseSchema, type DataValue, type LoginClientResponse } from "@workspace/shared";

import { mobileLoginJson, userJson } from "../../../test/fixtures";
import { FULL_ACCESS_TOKEN, REFRESH_TOKEN, testAccessToken } from "../../../test/jwt";
import { classifySignInResponse } from "./sign-in-outcome";

function parsed(json: DataValue): LoginClientResponse {
	return LoginClientResponseSchema.parse(json);
}

describe("classifySignInResponse", () => {
	it("finishes with the body tokens of a mobile login", () => {
		expect(classifySignInResponse(parsed(mobileLoginJson()))).toEqual({ kind: "session", tokens: { accessToken: FULL_ACCESS_TOKEN, refreshToken: REFRESH_TOKEN } });
	});

	it("finishes a restricted (forced enrollment) session with its tokens", () => {
		const restricted = testAccessToken({ sessionScope: "restricted" });
		const response = parsed({
			requiresEnrollment: true,
			enrollmentReason: "mfa_enrollment",
			message: "Enroll",
			tokenTransport: "body",
			accessToken: restricted,
			refreshToken: REFRESH_TOKEN,
		});
		expect(classifySignInResponse(response)).toEqual({ kind: "session", tokens: { accessToken: restricted, refreshToken: REFRESH_TOKEN } });
	});

	it("asks for the second factor", () => {
		expect(classifySignInResponse(parsed({ requiresTwoFactor: true, tempToken: "challenge", message: "2FA" }))).toEqual({ kind: "twoFactor", tempToken: "challenge" });
	});

	it("asks for the emailed new-device code", () => {
		expect(classifySignInResponse(parsed({ requiresVerification: true, verificationId: "v-1", message: "Check email" }))).toEqual({
			kind: "verifyDevice",
			verificationId: "v-1",
		});
	});

	it("refuses a browser answer (no tokens in the body)", () => {
		expect(classifySignInResponse(parsed({ user: userJson() }))).toEqual({ kind: "unexpected" });
		expect(classifySignInResponse(parsed({ requiresEnrollment: true, enrollmentReason: "mfa_enrollment", message: "Enroll" }))).toEqual({ kind: "unexpected" });
	});
});
