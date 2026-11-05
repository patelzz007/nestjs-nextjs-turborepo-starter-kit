// ============================================
// passkeys/browser-passkeys.ts - the browser's half of a passkey ceremony (ADR 080)
// ============================================
// The API builds the options and verifies the answer; the browser (`navigator.credentials`, through
// @simplewebauthn/browser) asks the person's authenticator. What the browser answers is parsed with the
// shared contract's schemas before it is sent, so a browser that answers something unexpected fails here,
// with a message, rather than at the API. The library's types stay in this file.
//
// The options come from the API as JSON, which never holds an `undefined` value, but the schemas' optional
// fields are typed `T | undefined`; the library's types (exact optional properties) want an absent key
// instead. The two `…Json` functions below copy every field across, an optional one only when it is set.

import {
	browserSupportsWebAuthn,
	startAuthentication,
	startRegistration,
	WebAuthnError,
	type PublicKeyCredentialCreationOptionsJSON,
	type PublicKeyCredentialDescriptorJSON,
	type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import {
	PasskeyAuthenticationResponseSchema,
	PasskeyRegistrationResponseSchema,
	type PasskeyAuthenticationOptions,
	type PasskeyAuthenticationResponse,
	type PasskeyRegistrationOptions,
	type PasskeyRegistrationResponse,
} from "@workspace/shared";

type CredentialDescriptor = NonNullable<PasskeyAuthenticationOptions["allowCredentials"]>[number];

function descriptorJson(descriptor: CredentialDescriptor): PublicKeyCredentialDescriptorJSON {
	return { id: descriptor.id, type: descriptor.type, ...(descriptor.transports === undefined ? {} : { transports: descriptor.transports }) };
}

/** The extensions this API asks for (only `credProps`), as the library takes them. */
function extensionsJson(extensions: PasskeyRegistrationOptions["extensions"]): Pick<PublicKeyCredentialCreationOptionsJSON, "extensions"> {
	if (extensions === undefined) {
		return {};
	}
	return { extensions: extensions.credProps === undefined ? {} : { credProps: extensions.credProps } };
}

/** The API's registration options as `navigator.credentials.create()`'s JSON. */
export function creationOptionsJson(options: PasskeyRegistrationOptions): PublicKeyCredentialCreationOptionsJSON {
	const { rp, authenticatorSelection: selection } = options;
	return {
		rp: { name: rp.name, ...(rp.id === undefined ? {} : { id: rp.id }) },
		user: options.user,
		challenge: options.challenge,
		pubKeyCredParams: options.pubKeyCredParams,
		...(options.timeout === undefined ? {} : { timeout: options.timeout }),
		...(options.excludeCredentials === undefined ? {} : { excludeCredentials: options.excludeCredentials.map(descriptorJson) }),
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
		...(options.hints === undefined ? {} : { hints: options.hints }),
		...(options.attestation === undefined ? {} : { attestation: options.attestation }),
		...extensionsJson(options.extensions),
	};
}

/** The API's sign-in options as `navigator.credentials.get()`'s JSON. */
export function requestOptionsJson(options: PasskeyAuthenticationOptions): PublicKeyCredentialRequestOptionsJSON {
	return {
		challenge: options.challenge,
		...(options.timeout === undefined ? {} : { timeout: options.timeout }),
		...(options.rpId === undefined ? {} : { rpId: options.rpId }),
		...(options.allowCredentials === undefined ? {} : { allowCredentials: options.allowCredentials.map(descriptorJson) }),
		...(options.userVerification === undefined ? {} : { userVerification: options.userVerification }),
		...(options.hints === undefined ? {} : { hints: options.hints }),
		...extensionsJson(options.extensions),
	};
}

/** Whether this browser can run a passkey ceremony at all (WebAuthn is present and the page is a secure context). */
export function passkeysSupported(): boolean {
	return browserSupportsWebAuthn();
}

/** Asks the authenticator to create a passkey with the API's options; the new credential, as the API expects it. */
export async function createPasskeyCredential(options: PasskeyRegistrationOptions): Promise<PasskeyRegistrationResponse> {
	return PasskeyRegistrationResponseSchema.parse(await startRegistration({ optionsJSON: creationOptionsJson(options) }));
}

/** Asks the authenticator to sign the API's challenge with one of this site's passkeys; the assertion, as the API expects it. */
export async function getPasskeyAssertion(options: PasskeyAuthenticationOptions): Promise<PasskeyAuthenticationResponse> {
	return PasskeyAuthenticationResponseSchema.parse(await startAuthentication({ optionsJSON: requestOptionsJson(options) }));
}

/** What went wrong in the browser's half, in words a person can act on; `null` when the error came from elsewhere (the API). */
export function passkeyBrowserErrorMessage(error: Error): string | null {
	// The person closed the prompt, or it timed out: the browser reports both as NotAllowedError.
	if (error.name === "NotAllowedError" || (error instanceof WebAuthnError && error.code === "ERROR_CEREMONY_ABORTED")) {
		return PASSKEY_BROWSER_MESSAGES.cancelled;
	}
	if (error instanceof WebAuthnError) {
		switch (error.code) {
			case "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED":
				return PASSKEY_BROWSER_MESSAGES.alreadyRegistered;
			case "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT":
			case "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT":
			case "ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG":
				return PASSKEY_BROWSER_MESSAGES.unsupportedAuthenticator;
			case "ERROR_INVALID_DOMAIN":
			case "ERROR_INVALID_RP_ID":
				return PASSKEY_BROWSER_MESSAGES.wrongSite;
			default:
				return PASSKEY_BROWSER_MESSAGES.failed;
		}
	}
	return null;
}

export const PASSKEY_BROWSER_MESSAGES = {
	cancelled: "The passkey prompt was closed before it finished. Try again when you're ready.",
	alreadyRegistered: "This device already holds a passkey for your account.",
	unsupportedAuthenticator: "This device can't create the kind of passkey this site needs (one that unlocks with your fingerprint, face or PIN).",
	wrongSite: "Passkeys aren't set up for this address. Open the site at its usual address and try again.",
	failed: "Your device couldn't complete the passkey. Try again, or use another sign-in method.",
	unsupportedBrowser: "This browser doesn't support passkeys.",
} satisfies Readonly<Record<string, string>>;
