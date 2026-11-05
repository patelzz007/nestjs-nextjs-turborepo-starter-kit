import type { PasskeyAuthenticationOptions, PasskeyRegistrationOptions } from "@workspace/shared";

import * as fakePasskey from "../../../../../test/react-native-passkey-fake";
import {
	createPasskeyCredential,
	createRequestOf,
	getPasskeyAssertion,
	getRequestOf,
	PASSKEY_DEVICE_MESSAGES,
	PasskeyDeviceError,
	passkeyErrorMessage,
	passkeysSupported,
} from "../device-passkeys";

const REGISTRATION_OPTIONS: PasskeyRegistrationOptions = {
	rp: { id: "example.com", name: "Starter" },
	user: { id: "dXNlcg", name: "a@example.com", displayName: "A" },
	challenge: "Y2hhbGxlbmdl",
	pubKeyCredParams: [{ type: "public-key", alg: -7 }],
	timeout: 300_000,
	excludeCredentials: [{ id: "Y3JlZA", type: "public-key", transports: ["usb"] }],
	authenticatorSelection: { residentKey: "required", userVerification: "required", authenticatorAttachment: undefined },
	attestation: "none",
};
const SIGN_IN_OPTIONS: PasskeyAuthenticationOptions = {
	challenge: "Y2hhbGxlbmdl",
	rpId: "example.com",
	userVerification: "required",
	allowCredentials: [{ id: "Y3JlZA", type: "public-key" }],
};

describe("the phone's half of a passkey ceremony (ADR 080)", () => {
	it("hands the module every set option, the credentials by id and type only", () => {
		expect(createRequestOf(REGISTRATION_OPTIONS)).toStrictEqual({
			challenge: "Y2hhbGxlbmdl",
			rp: { id: "example.com", name: "Starter" },
			user: { id: "dXNlcg", name: "a@example.com", displayName: "A" },
			pubKeyCredParams: [{ type: "public-key", alg: -7 }],
			timeout: 300_000,
			excludeCredentials: [{ id: "Y3JlZA", type: "public-key" }],
			authenticatorSelection: { residentKey: "required", userVerification: "required" },
			attestation: "none",
		});
		expect(getRequestOf(SIGN_IN_OPTIONS)).toStrictEqual({
			challenge: "Y2hhbGxlbmdl",
			rpId: "example.com",
			userVerification: "required",
			allowCredentials: [{ id: "Y3JlZA", type: "public-key" }],
		});
	});

	it("refuses options that name no relying party (the module needs one)", () => {
		expect(() => createRequestOf({ ...REGISTRATION_OPTIONS, rp: { name: "Starter" } })).toThrow(PasskeyDeviceError);
		expect(() => getRequestOf({ challenge: "Y2hhbGxlbmdl" })).toThrow(PASSKEY_DEVICE_MESSAGES.noRelyingParty);
	});

	it("returns the module's new credential as the contract states it", async () => {
		fakePasskey.answerNextCreate({ id: "Y3JlZA", rawId: "Y3JlZA", type: "public-key", response: { clientDataJSON: "Y2xpZW50", attestationObject: "YXR0" } });

		await expect(createPasskeyCredential(REGISTRATION_OPTIONS)).resolves.toStrictEqual({
			id: "Y3JlZA",
			rawId: "Y3JlZA",
			type: "public-key",
			response: { clientDataJSON: "Y2xpZW50", attestationObject: "YXR0" },
			clientExtensionResults: {},
		});
	});

	it("turns the module's rejections into the person's words", async () => {
		const cases: readonly [string, string][] = [
			["UserCancelled", PASSKEY_DEVICE_MESSAGES.cancelled],
			["NoCredentials", PASSKEY_DEVICE_MESSAGES.noPasskey],
			["BadConfiguration", PASSKEY_DEVICE_MESSAGES.notSetUp],
			["NotSupported", PASSKEY_DEVICE_MESSAGES.notSupported],
			["Something new", PASSKEY_DEVICE_MESSAGES.failed],
		];
		for (const [error, message] of cases) {
			fakePasskey.rejectNext({ error, message: "native message" });
			await expect(getPasskeyAssertion(SIGN_IN_OPTIONS)).rejects.toMatchObject({ name: "PasskeyDeviceError", message, reason: error });
		}
	});

	it("shows the phone's words for its half and the API's for the rest", () => {
		expect(passkeyErrorMessage(new PasskeyDeviceError(PASSKEY_DEVICE_MESSAGES.cancelled, "UserCancelled"))).toBe(PASSKEY_DEVICE_MESSAGES.cancelled);
		expect(passkeyErrorMessage(new TypeError("Network request failed"))).toBe("We couldn't reach the server. Check your connection and try again.");
	});

	it("reports whether the phone can use passkeys", () => {
		expect(passkeysSupported()).toBe(false);
		fakePasskey.supportPasskeys();
		expect(passkeysSupported()).toBe(true);
	});
});
