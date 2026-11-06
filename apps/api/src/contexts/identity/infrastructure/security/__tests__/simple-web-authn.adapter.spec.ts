// The WebAuthn relying party over @simplewebauthn/server (ADR 080), driven by a software authenticator: a P-256
// key that answers ceremonies exactly as a platform authenticator does (attestation "none", user presence and
// user verification), so registration and sign-in are verified for real, not mocked. Every way an answer can be
// wrong (another site, another origin, no user verification, a replayed challenge, a forged signature) is refused
// with a reason, never an exception.

import { createHash, generateKeyPairSync, sign, type KeyObject } from "node:crypto";

import { ANDROID_LOGIN_CREDENTIALS_RELATION, type PasskeyAuthenticationResponse, type PasskeyRegistrationResponse } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { createTestApiConfig } from "../../../../../../e2e/support/test-api-env";
import { TypedConfigService } from "../../../../../config/typed-config.service";
import type { PasskeysConfig } from "../../../../../config/api-config.schema";
import { SimpleWebAuthnAdapter } from "../simple-web-authn.adapter";

const RP_ID = "example.com";
const ORIGIN = "https://example.com";

const PASSKEYS: PasskeysConfig = {
	rpId: RP_ID,
	rpName: "Starter",
	origins: [ORIGIN, "https://admin.example.com"],
	androidApp: { packageName: "com.example.starter", certFingerprints: ["14:6D:E9"] },
	appleAppIds: ["ABCDE12345.com.example.starter"],
};

function adapter(passkeys: PasskeysConfig = PASSKEYS): SimpleWebAuthnAdapter {
	return new SimpleWebAuthnAdapter(new TypedConfigService({ ...createTestApiConfig(), passkeys }));
}

// ── A minimal CBOR encoder: the authenticator data's public key and the attestation object need only these ──

type CborValue =
	| { readonly kind: "int"; readonly value: number }
	| { readonly kind: "text"; readonly value: string }
	| { readonly kind: "bytes"; readonly value: Uint8Array }
	| { readonly kind: "map"; readonly entries: readonly (readonly [CborValue, CborValue])[] };

const int = (value: number): CborValue => ({ kind: "int", value });
const text = (value: string): CborValue => ({ kind: "text", value });
const bytes = (value: Uint8Array): CborValue => ({ kind: "bytes", value });
const map = (...entries: (readonly [CborValue, CborValue])[]): CborValue => ({ kind: "map", entries });

const CBOR_UNSIGNED = 0;
const CBOR_NEGATIVE = 1;
const CBOR_BYTES = 2;
const CBOR_TEXT = 3;
const CBOR_MAP = 5;
const ONE_BYTE_LENGTH = 24;
const TWO_BYTE_LENGTH = 25;
const ONE_BYTE_MAX = 0xff;
const MAJOR_TYPE_SHIFT = 5;

function cborHead(major: number, length: number): Buffer {
	if (length < ONE_BYTE_LENGTH) {
		return Buffer.from([(major << MAJOR_TYPE_SHIFT) | length]);
	}
	if (length <= ONE_BYTE_MAX) {
		return Buffer.from([(major << MAJOR_TYPE_SHIFT) | ONE_BYTE_LENGTH, length]);
	}
	const head = Buffer.alloc(3);
	head.writeUInt8((major << MAJOR_TYPE_SHIFT) | TWO_BYTE_LENGTH, 0);
	head.writeUInt16BE(length, 1);
	return head;
}

function cbor(item: CborValue): Buffer {
	switch (item.kind) {
		case "int":
			return item.value >= 0 ? cborHead(CBOR_UNSIGNED, item.value) : cborHead(CBOR_NEGATIVE, -1 - item.value);
		case "text": {
			const encoded = Buffer.from(item.value, "utf8");
			return Buffer.concat([cborHead(CBOR_TEXT, encoded.length), encoded]);
		}
		case "bytes":
			return Buffer.concat([cborHead(CBOR_BYTES, item.value.length), item.value]);
		case "map":
			return Buffer.concat([cborHead(CBOR_MAP, item.entries.length), ...item.entries.flatMap(([key, value]) => [cbor(key), cbor(value)])]);
	}
}

// ── The software authenticator ──

const FLAG_USER_PRESENT = 0x01;
const FLAG_USER_VERIFIED = 0x04;
const FLAG_BACKUP_ELIGIBLE = 0x08;
const FLAG_BACKED_UP = 0x10;
const FLAG_ATTESTED_CREDENTIAL = 0x40;
const COSE_KEY_TYPE_EC2 = 2;
const COSE_ALG_ES256 = -7;
const COSE_CURVE_P256 = 1;
const AAGUID_LENGTH = 16;

interface Authenticator {
	readonly credentialId: Buffer;
	readonly privateKey: KeyObject;
	readonly coseKey: Buffer;
}

function newAuthenticator(): Authenticator {
	const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
	const { x, y } = publicKey.export({ format: "jwk" });
	const coseKey = cbor(
		map(
			[int(1), int(COSE_KEY_TYPE_EC2)],
			[int(3), int(COSE_ALG_ES256)],
			[int(-1), int(COSE_CURVE_P256)],
			[int(-2), bytes(Buffer.from(x ?? "", "base64url"))],
			[int(-3), bytes(Buffer.from(y ?? "", "base64url"))],
		),
	);
	return { credentialId: Buffer.from("software-credential-1"), privateKey, coseKey };
}

function authenticatorData(rpId: string, flags: number, counter: number, attested?: Authenticator): Buffer {
	const counterBytes = Buffer.alloc(4);
	counterBytes.writeUInt32BE(counter, 0);
	const head = Buffer.concat([createHash("sha256").update(rpId).digest(), Buffer.from([flags]), counterBytes]);
	if (attested === undefined) {
		return head;
	}
	const idLength = Buffer.alloc(2);
	idLength.writeUInt16BE(attested.credentialId.length, 0);
	return Buffer.concat([head, Buffer.alloc(AAGUID_LENGTH), idLength, attested.credentialId, attested.coseKey]);
}

function clientData(type: "webauthn.create" | "webauthn.get", challenge: string, origin: string): Buffer {
	return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
}

interface CeremonyOptions {
	readonly rpId?: string;
	readonly origin?: string;
	readonly flags?: number;
}

const VERIFIED_FLAGS = FLAG_USER_PRESENT | FLAG_USER_VERIFIED | FLAG_BACKUP_ELIGIBLE | FLAG_BACKED_UP;

function register(authenticator: Authenticator, challenge: string, options: CeremonyOptions = {}): PasskeyRegistrationResponse {
	const data = authenticatorData(options.rpId ?? RP_ID, (options.flags ?? VERIFIED_FLAGS) | FLAG_ATTESTED_CREDENTIAL, 0, authenticator);
	const attestationObject = cbor(map([text("fmt"), text("none")], [text("attStmt"), map()], [text("authData"), bytes(data)]));
	const id = authenticator.credentialId.toString("base64url");
	return {
		id,
		rawId: id,
		response: {
			clientDataJSON: clientData("webauthn.create", challenge, options.origin ?? ORIGIN).toString("base64url"),
			attestationObject: attestationObject.toString("base64url"),
			transports: ["internal", "hybrid"],
		},
		clientExtensionResults: {},
		type: "public-key",
	};
}

function assert(authenticator: Authenticator, challenge: string, counter: number, options: CeremonyOptions = {}): PasskeyAuthenticationResponse {
	const data = authenticatorData(options.rpId ?? RP_ID, options.flags ?? VERIFIED_FLAGS, counter);
	const client = clientData("webauthn.get", challenge, options.origin ?? ORIGIN);
	const signature = sign("sha256", Buffer.concat([data, createHash("sha256").update(client).digest()]), authenticator.privateKey);
	const id = authenticator.credentialId.toString("base64url");
	return {
		id,
		rawId: id,
		response: { clientDataJSON: client.toString("base64url"), authenticatorData: data.toString("base64url"), signature: signature.toString("base64url") },
		clientExtensionResults: {},
		type: "public-key",
	};
}

const ACCOUNT = { userId: "019b76da-a810-7000-8000-0000000000a1", userName: "member@example.com", displayName: "Member" };

/** Registers the authenticator through the adapter: options, the ceremony, the verified credential. */
async function registered(relyingParty: SimpleWebAuthnAdapter, authenticator: Authenticator): Promise<{ readonly publicKey: string; readonly credentialId: string }> {
	const { challenge } = await relyingParty.registrationOptions(ACCOUNT, []);
	const verification = await relyingParty.verifyRegistration(register(authenticator, challenge), (sent: string): boolean => sent === challenge);
	if (!verification.verified) {
		throw new Error(`the software authenticator's registration did not verify: ${verification.reason}`);
	}
	return verification.value;
}

describe("SimpleWebAuthnAdapter options", () => {
	it("asks for a discoverable passkey with user verification, for this site and account, excluding the ones it has", async () => {
		const options = await adapter().registrationOptions(ACCOUNT, [{ credentialId: "ZXhpc3Rpbmc", transports: ["usb"] }]);

		expect(options.rp).toStrictEqual({ id: RP_ID, name: "Starter" });
		expect(options.user).toStrictEqual({ id: adapter().userHandleOf(ACCOUNT.userId), name: ACCOUNT.userName, displayName: ACCOUNT.displayName });
		expect(options.authenticatorSelection).toMatchObject({ residentKey: "required", userVerification: "required" });
		expect(options.attestation).toBe("none");
		expect(options.excludeCredentials).toStrictEqual([{ id: "ZXhpc3Rpbmc", type: "public-key", transports: ["usb"] }]);
	});

	it("gives every ceremony its own challenge", async () => {
		const [first, second] = await Promise.all([adapter().authenticationOptions([]), adapter().authenticationOptions([])]);

		expect(first.challenge).not.toBe(second.challenge);
		expect(first).toMatchObject({ rpId: RP_ID, userVerification: "required" });
	});

	it("names each account's user handle by its id, base64url", () => {
		expect(adapter().userHandleOf("user-1")).toBe(Buffer.from("user-1").toString("base64url"));
	});
});

describe("SimpleWebAuthnAdapter registration", () => {
	it("verifies a new passkey and keeps what the ceremony proved", async () => {
		const relyingParty = adapter();
		const authenticator = newAuthenticator();
		const { challenge } = await relyingParty.registrationOptions(ACCOUNT, []);

		const verification = await relyingParty.verifyRegistration(register(authenticator, challenge), (sent: string): boolean => sent === challenge);

		expect(verification).toMatchObject({
			verified: true,
			value: { credentialId: authenticator.credentialId.toString("base64url"), counter: 0, transports: ["internal", "hybrid"], deviceType: "MULTI_DEVICE", backedUp: true },
		});
	});

	it("refuses an answer to another challenge, from another origin or site, or without user verification", async () => {
		const relyingParty = adapter();
		const authenticator = newAuthenticator();
		const { challenge } = await relyingParty.registrationOptions(ACCOUNT, []);
		const expected = (sent: string): boolean => sent === challenge;

		const answers = [
			await relyingParty.verifyRegistration(register(authenticator, "b3RoZXI"), expected),
			await relyingParty.verifyRegistration(register(authenticator, challenge, { origin: "https://evil.example" }), expected),
			await relyingParty.verifyRegistration(register(authenticator, challenge, { rpId: "evil.example" }), expected),
			await relyingParty.verifyRegistration(register(authenticator, challenge, { flags: FLAG_USER_PRESENT }), expected),
		];

		for (const answer of answers) {
			expect(answer.verified).toBe(false);
			// The refusal names its reason (logged, never sent to the client).
			expect(answer.verified ? "" : answer.reason).not.toBe("");
		}
	});
});

describe("SimpleWebAuthnAdapter sign-in", () => {
	it("verifies an assertion signed by the registered key and reports its counter", async () => {
		const relyingParty = adapter();
		const authenticator = newAuthenticator();
		const key = await registered(relyingParty, authenticator);
		const { challenge } = await relyingParty.authenticationOptions([]);

		const verification = await relyingParty.verifyAuthentication(
			assert(authenticator, challenge, 1),
			{ ...key, counter: 0, transports: ["internal"] },
			(sent: string): boolean => sent === challenge,
		);

		expect(verification).toStrictEqual({ verified: true, value: { newCounter: 1, backedUp: true } });
	});

	it("refuses a forged signature, a replayed challenge, another origin and an unverified user", async () => {
		const relyingParty = adapter();
		const authenticator = newAuthenticator();
		const key = { ...(await registered(relyingParty, authenticator)), counter: 0, transports: [] };
		const { challenge } = await relyingParty.authenticationOptions([]);
		const expected = (sent: string): boolean => sent === challenge;
		const impostor = { ...newAuthenticator(), credentialId: authenticator.credentialId };

		const answers = [
			await relyingParty.verifyAuthentication(assert(impostor, challenge, 1), key, expected),
			await relyingParty.verifyAuthentication(assert(authenticator, "b2xk", 1), key, expected),
			await relyingParty.verifyAuthentication(assert(authenticator, challenge, 1, { origin: "https://evil.example" }), key, expected),
			await relyingParty.verifyAuthentication(assert(authenticator, challenge, 1, { flags: FLAG_USER_PRESENT }), key, expected),
		];

		for (const answer of answers) {
			expect(answer.verified).toBe(false);
			// The refusal names its reason (logged, never sent to the client).
			expect(answer.verified ? "" : answer.reason).not.toBe("");
		}
	});
});

describe("SimpleWebAuthnAdapter app associations", () => {
	it("lets the configured Android and iOS apps use this site's passkeys", () => {
		expect(adapter().appAssociations()).toStrictEqual({
			assetLinks: [
				{
					relation: [ANDROID_LOGIN_CREDENTIALS_RELATION],
					target: { namespace: "android_app", package_name: "com.example.starter", sha256_cert_fingerprints: ["14:6D:E9"] },
				},
			],
			appleAppSiteAssociation: { webcredentials: { apps: ["ABCDE12345.com.example.starter"] } },
		});
	});

	it("associates no app when none is configured", () => {
		expect(adapter({ ...PASSKEYS, androidApp: null, appleAppIds: [] }).appAssociations()).toStrictEqual({
			assetLinks: [],
			appleAppSiteAssociation: { webcredentials: { apps: [] } },
		});
	});
});
