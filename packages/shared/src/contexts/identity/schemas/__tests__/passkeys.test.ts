import { describe, expect, it } from "vitest";

import {
	CompletePasskeyRegistrationSchema,
	PASSKEY_NAME_MAX_LENGTH,
	PasskeyAppAssociationsSchema,
	PasskeyAuthenticationResponseSchema,
	PasskeyNameSchema,
	PasskeyRegistrationResponseSchema,
	ReportedPasskeyTransportsSchema,
	StartPasskeyRegistrationSchema,
} from "../passkeys";

const REGISTRATION = {
	id: "Y3JlZA",
	rawId: "Y3JlZA",
	response: { clientDataJSON: "Y2xpZW50", attestationObject: "YXR0", transports: ["internal", "hybrid"] },
	clientExtensionResults: { credProps: { rk: true } },
	type: "public-key",
};

const ASSERTION = {
	id: "Y3JlZA",
	rawId: "Y3JlZA",
	response: { clientDataJSON: "Y2xpZW50", authenticatorData: "YXV0aA", signature: "c2ln", userHandle: "dXNlcg" },
	clientExtensionResults: {},
	type: "public-key",
};

describe("passkey names", () => {
	it("trims a name and needs one, at most the limit long", () => {
		expect(PasskeyNameSchema.parse("  Work laptop  ")).toBe("Work laptop");
		expect(PasskeyNameSchema.safeParse("   ").success).toBe(false);
		expect(PasskeyNameSchema.safeParse("x".repeat(PASSKEY_NAME_MAX_LENGTH)).success).toBe(true);
		expect(PasskeyNameSchema.safeParse("x".repeat(PASSKEY_NAME_MAX_LENGTH + 1)).success).toBe(false);
	});
});

describe("the browser's answers", () => {
	it("accepts a registration and strips what the API does not read (newer WebAuthn fields)", () => {
		const parsed = PasskeyRegistrationResponseSchema.parse({ ...REGISTRATION, futureField: 1, response: { ...REGISTRATION.response, futureMember: "x" } });

		expect(parsed).toStrictEqual(REGISTRATION);
	});

	it("keeps only the transports it knows", () => {
		expect(ReportedPasskeyTransportsSchema.parse(["internal", "teleport", "usb"])).toStrictEqual(["internal", "usb"]);
	});

	it("refuses anything that is not base64url, or an empty field", () => {
		expect(PasskeyRegistrationResponseSchema.safeParse({ ...REGISTRATION, id: "not base64url!" }).success).toBe(false);
		expect(PasskeyRegistrationResponseSchema.safeParse({ ...REGISTRATION, response: { ...REGISTRATION.response, attestationObject: "" } }).success).toBe(false);
		expect(PasskeyAuthenticationResponseSchema.safeParse({ ...ASSERTION, response: { ...ASSERTION.response, signature: "c2ln==" } }).success).toBe(false);
	});

	it("refuses an assertion without its signature", () => {
		const withoutSignature = Object.fromEntries(Object.entries(ASSERTION.response).filter(([field]) => field !== "signature"));

		expect(PasskeyAuthenticationResponseSchema.safeParse({ ...ASSERTION, response: withoutSignature }).success).toBe(false);
		expect(PasskeyAuthenticationResponseSchema.parse(ASSERTION)).toStrictEqual(ASSERTION);
	});
});

describe("the API's own requests", () => {
	it("needs the password again to start adding a passkey, and nothing else", () => {
		expect(StartPasskeyRegistrationSchema.safeParse({ password: "Secret@123" }).success).toBe(true);
		expect(StartPasskeyRegistrationSchema.safeParse({ password: "" }).success).toBe(false);
		expect(StartPasskeyRegistrationSchema.safeParse({ password: "Secret@123", userId: "someone-else" }).success).toBe(false);
	});

	it("finishes adding one with the challenge it answers, a name and the credential", () => {
		const input = { challengeId: "019b76da-a810-7000-8000-00000000c0de", name: "Pixel 9", response: REGISTRATION };

		expect(CompletePasskeyRegistrationSchema.parse(input)).toStrictEqual(input);
		expect(CompletePasskeyRegistrationSchema.safeParse({ ...input, challengeId: "challenge-1" }).success).toBe(false);
	});
});

describe("the app associations", () => {
	it("hold Android asset-link statements and Apple webcredentials app ids", () => {
		const associations = {
			assetLinks: [
				{
					relation: ["delegate_permission/common.get_login_creds"],
					target: { namespace: "android_app", package_name: "com.example.starter", sha256_cert_fingerprints: ["AA:BB"] },
				},
			],
			appleAppSiteAssociation: { webcredentials: { apps: ["ABCDE12345.com.example.starter"] } },
		};

		expect(PasskeyAppAssociationsSchema.parse(associations)).toStrictEqual(associations);
		expect(PasskeyAppAssociationsSchema.safeParse({ ...associations, assetLinks: [{ ...associations.assetLinks.at(0), target: { namespace: "web" } }] }).success).toBe(false);
	});
});
