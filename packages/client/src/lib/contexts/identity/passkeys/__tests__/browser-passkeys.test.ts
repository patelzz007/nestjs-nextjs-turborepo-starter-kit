import { WebAuthnError } from "@simplewebauthn/browser";
import type { PasskeyAuthenticationOptions, PasskeyRegistrationOptions } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { creationOptionsJson, PASSKEY_BROWSER_MESSAGES, passkeyBrowserErrorMessage, requestOptionsJson } from "../browser-passkeys";

function webAuthnError(code: WebAuthnError["code"]): WebAuthnError {
	return new WebAuthnError({ message: code, code, cause: new Error(code) });
}

describe("passkeyBrowserErrorMessage", () => {
	it("tells the person the prompt was closed, for a dismissed or timed-out prompt and an aborted ceremony", () => {
		expect(passkeyBrowserErrorMessage(Object.assign(new Error("not allowed"), { name: "NotAllowedError" }))).toBe(PASSKEY_BROWSER_MESSAGES.cancelled);
		expect(passkeyBrowserErrorMessage(webAuthnError("ERROR_CEREMONY_ABORTED"))).toBe(PASSKEY_BROWSER_MESSAGES.cancelled);
	});

	it("names what the device or the address got wrong", () => {
		expect(passkeyBrowserErrorMessage(webAuthnError("ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED"))).toBe(PASSKEY_BROWSER_MESSAGES.alreadyRegistered);
		expect(passkeyBrowserErrorMessage(webAuthnError("ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT"))).toBe(PASSKEY_BROWSER_MESSAGES.unsupportedAuthenticator);
		expect(passkeyBrowserErrorMessage(webAuthnError("ERROR_INVALID_RP_ID"))).toBe(PASSKEY_BROWSER_MESSAGES.wrongSite);
		expect(passkeyBrowserErrorMessage(webAuthnError("ERROR_AUTHENTICATOR_GENERAL_ERROR"))).toBe(PASSKEY_BROWSER_MESSAGES.failed);
	});

	it("leaves any other error (the API's) to the caller", () => {
		expect(passkeyBrowserErrorMessage(new Error("Invalid credentials"))).toBeNull();
	});
});

describe("the options as the browser takes them", () => {
	it("copies every set field of the registration options and leaves the unset ones out", () => {
		const options: PasskeyRegistrationOptions = {
			rp: { name: "Starter", id: undefined },
			user: { id: "dXNlcg", name: "a@example.com", displayName: "A" },
			challenge: "Y2hhbGxlbmdl",
			pubKeyCredParams: [{ type: "public-key", alg: -7 }],
			timeout: 300_000,
			excludeCredentials: [{ id: "Y3JlZA", type: "public-key", transports: undefined }],
			authenticatorSelection: { residentKey: "required", userVerification: "required", authenticatorAttachment: undefined },
			attestation: "none",
			extensions: { credProps: true },
		};

		const json = creationOptionsJson(options);

		expect(json).toStrictEqual({
			rp: { name: "Starter" },
			user: { id: "dXNlcg", name: "a@example.com", displayName: "A" },
			challenge: "Y2hhbGxlbmdl",
			pubKeyCredParams: [{ type: "public-key", alg: -7 }],
			timeout: 300_000,
			excludeCredentials: [{ id: "Y3JlZA", type: "public-key" }],
			authenticatorSelection: { residentKey: "required", userVerification: "required" },
			attestation: "none",
			extensions: { credProps: true },
		});
	});

	it("copies the sign-in options the same way", () => {
		const options: PasskeyAuthenticationOptions = {
			challenge: "Y2hhbGxlbmdl",
			rpId: "localhost",
			allowCredentials: [{ id: "Y3JlZA", type: "public-key", transports: ["internal", "hybrid"] }],
			userVerification: "required",
			timeout: undefined,
			extensions: undefined,
		};

		expect(requestOptionsJson(options)).toStrictEqual({
			challenge: "Y2hhbGxlbmdl",
			rpId: "localhost",
			allowCredentials: [{ id: "Y3JlZA", type: "public-key", transports: ["internal", "hybrid"] }],
			userVerification: "required",
		});
	});
});
