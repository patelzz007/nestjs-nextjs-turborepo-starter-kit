// ============================================
// passkeys/device-passkeys.ts - the phone's half of a passkey ceremony (ADR 080)
// ============================================
// The API builds the options and verifies the answer; the phone asks its credential manager (Android's
// Credential Manager, iOS's AuthenticationServices) through react-native-passkey, a native module (a development
// or store build: Expo Go does not have it). What the module answers is parsed with the shared contract's schemas
// before it is sent, so an unexpected answer fails here with a message, not at the API.
//
// A phone offers a site's passkeys to an app only when the site says so (`/.well-known/assetlinks.json` and
// `apple-app-site-association` on the RP ID's host, served by the web app). Against an API on `localhost` or a
// LAN address there is no such site, so the module answers that it is badly configured; the message says so.

import {
	PasskeyAuthenticationResponseSchema,
	PasskeyRegistrationResponseSchema,
	type PasskeyAuthenticationOptions,
	type PasskeyAuthenticationResponse,
	type PasskeyRegistrationOptions,
	type PasskeyRegistrationResponse,
} from "@workspace/shared";
import { Passkey, type PasskeyCreateRequest, type PasskeyGetRequest } from "react-native-passkey";
import { z } from "zod";

import { errorMessageOf } from "../../../lib/error-messages";

/** How react-native-passkey rejects: a plain object naming the error (never an `Error`). */
const PasskeyModuleErrorSchema = z.object({ error: z.string(), message: z.string() });

export const PASSKEY_DEVICE_MESSAGES = {
	cancelled: "The passkey prompt was closed before it finished. Try again when you're ready.",
	noPasskey: "This phone has no passkey for this account. Sign in with your password, then add one in Security.",
	alreadyRegistered: "This phone already holds a passkey for your account.",
	notSupported: "This phone can't use passkeys (it needs Android 9 or iOS 16, and a screen lock).",
	notSetUp: "Passkeys aren't set up for this server yet: it needs its own web address, linked to this app.",
	timedOut: "The passkey prompt timed out. Try again.",
	failed: "Your phone couldn't complete the passkey. Try again, or use another sign-in method.",
	noRelyingParty: "The server didn't say which site the passkey belongs to.",
} satisfies Readonly<Record<string, string>>;

/** The module's error names, as it reports them, and what each means to the person. */
const MODULE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
	UserCancelled: PASSKEY_DEVICE_MESSAGES.cancelled,
	Interrupted: PASSKEY_DEVICE_MESSAGES.cancelled,
	NoCredentials: PASSKEY_DEVICE_MESSAGES.noPasskey,
	CredentialAlreadyExists: PASSKEY_DEVICE_MESSAGES.alreadyRegistered,
	NotSupported: PASSKEY_DEVICE_MESSAGES.notSupported,
	NoCreateOption: PASSKEY_DEVICE_MESSAGES.notSupported,
	BadConfiguration: PASSKEY_DEVICE_MESSAGES.notSetUp,
	TimedOut: PASSKEY_DEVICE_MESSAGES.timedOut,
};

/**
 * The phone's half of a ceremony failed: its message is already the person's wording (the screens show it as it is).
 * `reason` is the module's own error name, for tests and logs.
 */
export class PasskeyDeviceError extends Error {
	public constructor(
		message: string,
		public readonly reason: string,
	) {
		super(message);
		this.name = "PasskeyDeviceError";
	}
}

/** The module's rejection (a plain `{ error, message }` object) as a `PasskeyDeviceError`; anything else as a generic one. */
function deviceErrorOf(rejection: Parameters<typeof PasskeyModuleErrorSchema.safeParse>[0]): PasskeyDeviceError {
	const parsed = PasskeyModuleErrorSchema.safeParse(rejection);
	if (!parsed.success) {
		return new PasskeyDeviceError(PASSKEY_DEVICE_MESSAGES.failed, "unknown");
	}
	return new PasskeyDeviceError(MODULE_ERROR_MESSAGES[parsed.data.error] ?? PASSKEY_DEVICE_MESSAGES.failed, parsed.data.error);
}

/** Runs one module call, turning its rejection into a `PasskeyDeviceError`. */
async function onDevice<TResult>(call: () => Promise<TResult>): Promise<TResult> {
	try {
		return await call();
	} catch (rejection) {
		throw deviceErrorOf(rejection);
	}
}

type CredentialDescriptor = NonNullable<PasskeyAuthenticationOptions["allowCredentials"]>[number];

/**
 * A credential named in the options, as the module takes it: its id and type. The transports are left out: they
 * are only a hint (WebAuthn lets the platform try every way it has), and the module types them as an enum it
 * does not export, so the contract's names could not be handed to it as they are.
 */
function descriptorOf(descriptor: CredentialDescriptor): { readonly id: string; readonly type: "public-key" } {
	return { id: descriptor.id, type: descriptor.type };
}

/** Whether this phone can run a passkey ceremony at all (a recent enough OS, in a build with the module). */
export function passkeysSupported(): boolean {
	return Passkey.isSupported();
}

/** The API's registration options as the module takes them (it needs the RP ID; every set field is copied). */
export function createRequestOf(options: PasskeyRegistrationOptions): PasskeyCreateRequest {
	const { rp, authenticatorSelection: selection } = options;
	if (rp.id === undefined) {
		throw new PasskeyDeviceError(PASSKEY_DEVICE_MESSAGES.noRelyingParty, "NoRelyingParty");
	}
	return {
		challenge: options.challenge,
		rp: { id: rp.id, name: rp.name },
		user: options.user,
		pubKeyCredParams: options.pubKeyCredParams,
		...(options.timeout === undefined ? {} : { timeout: options.timeout }),
		...(options.excludeCredentials === undefined
			? {}
			: {
					excludeCredentials: options.excludeCredentials.map(descriptorOf),
				}),
		...(selection === undefined
			? {}
			: {
					authenticatorSelection: {
						...(selection.authenticatorAttachment === undefined ? {} : { authenticatorAttachment: selection.authenticatorAttachment }),
						...(selection.requireResidentKey === undefined ? {} : { requireResidentKey: selection.requireResidentKey }),
						...(selection.residentKey === undefined ? {} : { residentKey: selection.residentKey }),
						...(selection.userVerification === undefined ? {} : { userVerification: selection.userVerification }),
					},
				}),
		...(options.attestation === undefined ? {} : { attestation: options.attestation }),
	};
}

/** The API's sign-in options as the module takes them (it needs the RP ID). */
export function getRequestOf(options: PasskeyAuthenticationOptions): PasskeyGetRequest {
	if (options.rpId === undefined) {
		throw new PasskeyDeviceError(PASSKEY_DEVICE_MESSAGES.noRelyingParty, "NoRelyingParty");
	}
	return {
		challenge: options.challenge,
		rpId: options.rpId,
		...(options.timeout === undefined ? {} : { timeout: options.timeout }),
		...(options.allowCredentials === undefined
			? {}
			: {
					allowCredentials: options.allowCredentials.map(descriptorOf),
				}),
		...(options.userVerification === undefined ? {} : { userVerification: options.userVerification }),
	};
}

/** Asks the phone to create a passkey with the API's options; the new credential, as the API expects it. */
export async function createPasskeyCredential(options: PasskeyRegistrationOptions): Promise<PasskeyRegistrationResponse> {
	const request = createRequestOf(options);
	const created = await onDevice(() => Passkey.create(request));
	// The module leaves out the extension results when there are none; the contract always carries the object.
	return PasskeyRegistrationResponseSchema.parse({ ...created, clientExtensionResults: created.clientExtensionResults ?? {} });
}

/** Asks the phone to sign the API's challenge with one of the site's passkeys; the assertion, as the API expects it. */
export async function getPasskeyAssertion(options: PasskeyAuthenticationOptions): Promise<PasskeyAuthenticationResponse> {
	const request = getRequestOf(options);
	const assertion = await onDevice(() => Passkey.get(request));
	return PasskeyAuthenticationResponseSchema.parse({ ...assertion, clientExtensionResults: assertion.clientExtensionResults ?? {} });
}

/** A failed passkey step's message: the phone's own words for its half, the API's catalog for the rest. */
export function passkeyErrorMessage(error: Error | null): string {
	return error instanceof PasskeyDeviceError ? error.message : errorMessageOf(error);
}
