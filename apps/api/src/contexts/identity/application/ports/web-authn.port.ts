import type {
	PasskeyAppAssociations,
	PasskeyAuthenticationOptions,
	PasskeyAuthenticationResponse,
	PasskeyRegistrationOptions,
	PasskeyRegistrationResponse,
	PasskeyTransport,
} from "@workspace/shared";

import type { PasskeyAssertion, VerifiedPasskeyCredential } from "../../domain/aggregates/passkey.aggregate";

/** A credential named in a ceremony's `excludeCredentials` / `allowCredentials`. */
export interface PasskeyCredentialRef {
	readonly credentialId: string;
	readonly transports: readonly PasskeyTransport[];
}

/** The account a passkey is created for, as the authenticator shows it in its account picker. */
export interface PasskeyAccountRef {
	readonly userId: string;
	/** The sign-in name (the email address). */
	readonly userName: string;
	readonly displayName: string;
}

/** The stored key an assertion is verified against. */
export interface StoredPasskeyKey extends PasskeyCredentialRef {
	/** The COSE public key, base64url. */
	readonly publicKey: string;
	readonly counter: number;
}

/** Whether `challenge` (base64url, as the browser signed it) is the one the ceremony stored. */
export type ChallengeCheck = (challenge: string) => boolean;

/** A verification outcome: the verified value, or why it failed (for the log only — never sent to the client). */
export type CeremonyVerification<TVerified> = { readonly verified: true; readonly value: TVerified } | { readonly verified: false; readonly reason: string };

/**
 * The WebAuthn relying party (ADR 080): builds ceremony options and verifies the browser's responses for
 * this deployment's RP ID and allowed origins. Implemented over `@simplewebauthn/server`; the library's
 * types never leave the adapter. Every ceremony requires user verification and resident (discoverable)
 * keys, and asks for attestation "none".
 */
export interface WebAuthnPort {
	/** Options for `navigator.credentials.create()`; the challenge is fresh and random. */
	registrationOptions(account: PasskeyAccountRef, exclude: readonly PasskeyCredentialRef[]): Promise<PasskeyRegistrationOptions>;

	verifyRegistration(response: PasskeyRegistrationResponse, isExpectedChallenge: ChallengeCheck): Promise<CeremonyVerification<VerifiedPasskeyCredential>>;

	/** Options for `navigator.credentials.get()`; an empty `allow` asks for any discoverable passkey of this site. */
	authenticationOptions(allow: readonly PasskeyCredentialRef[]): Promise<PasskeyAuthenticationOptions>;

	verifyAuthentication(response: PasskeyAuthenticationResponse, key: StoredPasskeyKey, isExpectedChallenge: ChallengeCheck): Promise<CeremonyVerification<PasskeyAssertion>>;

	/** The user handle (WebAuthn `user.id`, base64url) the authenticator stores for an account. */
	userHandleOf(userId: string): string;

	/** The native apps allowed to use this relying party's passkeys, as the two `/.well-known/` files state them. */
	appAssociations(): PasskeyAppAssociations;
}
