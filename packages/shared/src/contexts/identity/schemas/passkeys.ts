import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";
import { PlainMessageResponseSchema } from "../../../schemas/api/message";
import { UuidParamSchema } from "../../../schemas/domain/platform/param-schemas";

// ── Passkeys (WebAuthn, ADR 080) ────────────────────────────────────────────
//
// The JSON shapes of the two WebAuthn ceremonies as `@simplewebauthn/browser` and `@simplewebauthn/server`
// exchange them (W3C WebAuthn Level 3, `PublicKeyCredential*JSON`), plus the API's own requests around them.
// The credential objects a browser sends are NOT `.strict()`: the WebAuthn specification keeps adding fields
// (new client extension outputs, response members), so unknown keys are stripped rather than refused; every
// field this API reads is declared, bounded and validated here.

/** base64url without padding: how WebAuthn's JSON encoding carries binary values. */
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

/** A credential id is at most 1023 bytes (WebAuthn L3 §5.4.3): 1364 base64url characters. */
export const PASSKEY_CREDENTIAL_ID_MAX_LENGTH = 1364;

/** A ceremony challenge: 32 random bytes are 43 base64url characters; anything above 128 is not ours. */
const CHALLENGE_MAX_LENGTH = 128;

/** The WebAuthn user handle (the account id's bytes): at most 64 bytes, 86 base64url characters. */
const USER_HANDLE_MAX_LENGTH = 86;

/**
 * Upper bound of one binary field of a ceremony response (client data, authenticator data, signature,
 * attestation object). Attestation is "none" (ADR 080), so no certificate chain is ever sent; 16 KiB
 * leaves room for large post-quantum keys while bounding the request.
 */
const CEREMONY_FIELD_MAX_LENGTH = 16_384;

/** The longest name a person can give a passkey. */
export const PASSKEY_NAME_MAX_LENGTH = 64;

/** How many live passkeys one account may hold (bounds the list, the options and the sign-in lookups). */
export const MAX_PASSKEYS_PER_ACCOUNT = 20;

/** Upper bound of the transports one credential reports (seven are defined today). */
const MAX_TRANSPORTS = 16;

/** Upper bound of one transport name a browser reports (unknown ones are dropped, never stored). */
const TRANSPORT_NAME_MAX_LENGTH = 32;

/** Upper bound of the algorithms an options document offers. */
const MAX_PUBLIC_KEY_ALGORITHMS = 8;

/** Upper bound of the human-readable RP / user names an options document carries. */
const DISPLAY_NAME_MAX_LENGTH = 256;

/** A DNS name: at most 253 characters (the RP ID). */
const RP_ID_MAX_LENGTH = 253;

function base64UrlSchema(maxLength: number): z.ZodString {
	return z.string().min(1).max(maxLength).regex(BASE64URL_PATTERN, "must be base64url without padding");
}

/** A WebAuthn credential id (base64url). */
export const PasskeyCredentialIdSchema = base64UrlSchema(PASSKEY_CREDENTIAL_ID_MAX_LENGTH);

/** How a browser can reach an authenticator (`AuthenticatorTransportFuture`). */
export const PasskeyTransportSchema = z.enum(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"]);

export type PasskeyTransport = z.output<typeof PasskeyTransportSchema>;

/**
 * Transports as a browser reports them: bounded strings, of which only the known transports are kept.
 * A transport named by a newer browser is dropped instead of failing the whole registration.
 */
export const ReportedPasskeyTransportsSchema = z
	.array(z.string().min(1).max(TRANSPORT_NAME_MAX_LENGTH))
	.max(MAX_TRANSPORTS)
	.transform((reported: readonly string[]): PasskeyTransport[] =>
		reported.flatMap((name: string): PasskeyTransport[] => {
			const known = PasskeyTransportSchema.safeParse(name);
			return known.success ? [known.data] : [];
		}),
	);

/** Whether a passkey lives on one device or syncs between a person's devices (WebAuthn backup eligibility). */
export const PasskeyDeviceTypeSchema = z.enum(["SINGLE_DEVICE", "MULTI_DEVICE"]);

export type PasskeyDeviceType = z.output<typeof PasskeyDeviceTypeSchema>;

/** The name a person gives a passkey ("Work laptop"), trimmed. */
export const PasskeyNameSchema = z
	.string()
	.trim()
	.min(1, "Give the passkey a name")
	.max(PASSKEY_NAME_MAX_LENGTH, `At most ${String(PASSKEY_NAME_MAX_LENGTH)} characters`);

const UserVerificationRequirementSchema = z.enum(["required", "preferred", "discouraged"]);
const AuthenticatorAttachmentSchema = z.enum(["platform", "cross-platform"]);
const PublicKeyCredentialHintSchema = z.enum(["hybrid", "security-key", "client-device"]);

/** One credential named in `excludeCredentials` / `allowCredentials`. */
export const PasskeyCredentialDescriptorSchema = z.object({
	id: PasskeyCredentialIdSchema,
	type: z.literal("public-key"),
	transports: z.array(PasskeyTransportSchema).max(MAX_TRANSPORTS).optional(),
});

/** The client extensions this API asks for: only `credProps` (whether the credential is discoverable). */
const ClientExtensionInputsSchema = z.object({
	credProps: z.boolean().optional(),
});

/** `PublicKeyCredentialCreationOptionsJSON`: what `navigator.credentials.create()` is called with. */
export const PasskeyRegistrationOptionsSchema = z.object({
	rp: z.object({ id: z.string().min(1).max(RP_ID_MAX_LENGTH).optional(), name: z.string().min(1).max(DISPLAY_NAME_MAX_LENGTH) }),
	user: z.object({ id: base64UrlSchema(USER_HANDLE_MAX_LENGTH), name: z.string().min(1).max(DISPLAY_NAME_MAX_LENGTH), displayName: z.string().max(DISPLAY_NAME_MAX_LENGTH) }),
	challenge: base64UrlSchema(CHALLENGE_MAX_LENGTH),
	pubKeyCredParams: z
		.array(z.object({ type: z.literal("public-key"), alg: z.number().int() }))
		.min(1)
		.max(MAX_PUBLIC_KEY_ALGORITHMS),
	timeout: z.number().int().positive().optional(),
	excludeCredentials: z.array(PasskeyCredentialDescriptorSchema).max(MAX_PASSKEYS_PER_ACCOUNT).optional(),
	authenticatorSelection: z
		.object({
			authenticatorAttachment: AuthenticatorAttachmentSchema.optional(),
			requireResidentKey: z.boolean().optional(),
			residentKey: z.enum(["discouraged", "preferred", "required"]).optional(),
			userVerification: UserVerificationRequirementSchema.optional(),
		})
		.optional(),
	hints: z.array(PublicKeyCredentialHintSchema).optional(),
	attestation: z.enum(["none", "indirect", "direct", "enterprise"]).optional(),
	extensions: ClientExtensionInputsSchema.optional(),
});

export type PasskeyRegistrationOptions = z.output<typeof PasskeyRegistrationOptionsSchema>;

/** `PublicKeyCredentialRequestOptionsJSON`: what `navigator.credentials.get()` is called with. */
export const PasskeyAuthenticationOptionsSchema = z.object({
	challenge: base64UrlSchema(CHALLENGE_MAX_LENGTH),
	timeout: z.number().int().positive().optional(),
	rpId: z.string().min(1).max(RP_ID_MAX_LENGTH).optional(),
	allowCredentials: z.array(PasskeyCredentialDescriptorSchema).max(MAX_PASSKEYS_PER_ACCOUNT).optional(),
	userVerification: UserVerificationRequirementSchema.optional(),
	hints: z.array(PublicKeyCredentialHintSchema).optional(),
	extensions: ClientExtensionInputsSchema.optional(),
});

export type PasskeyAuthenticationOptions = z.output<typeof PasskeyAuthenticationOptionsSchema>;

/** The client extension outputs this API reads (others are stripped). */
const ClientExtensionResultsSchema = z.object({
	credProps: z.object({ rk: z.boolean().optional() }).optional(),
});

/** `RegistrationResponseJSON`: the new credential `navigator.credentials.create()` returned. */
export const PasskeyRegistrationResponseSchema = z.object({
	id: PasskeyCredentialIdSchema,
	rawId: PasskeyCredentialIdSchema,
	response: z.object({
		clientDataJSON: base64UrlSchema(CEREMONY_FIELD_MAX_LENGTH),
		attestationObject: base64UrlSchema(CEREMONY_FIELD_MAX_LENGTH),
		authenticatorData: base64UrlSchema(CEREMONY_FIELD_MAX_LENGTH).optional(),
		transports: ReportedPasskeyTransportsSchema.optional(),
		publicKeyAlgorithm: z.number().int().optional(),
		publicKey: base64UrlSchema(CEREMONY_FIELD_MAX_LENGTH).optional(),
	}),
	authenticatorAttachment: AuthenticatorAttachmentSchema.optional(),
	clientExtensionResults: ClientExtensionResultsSchema,
	type: z.literal("public-key"),
});

export type PasskeyRegistrationResponse = z.output<typeof PasskeyRegistrationResponseSchema>;

/** `AuthenticationResponseJSON`: the assertion `navigator.credentials.get()` returned. */
export const PasskeyAuthenticationResponseSchema = z.object({
	id: PasskeyCredentialIdSchema,
	rawId: PasskeyCredentialIdSchema,
	response: z.object({
		clientDataJSON: base64UrlSchema(CEREMONY_FIELD_MAX_LENGTH),
		authenticatorData: base64UrlSchema(CEREMONY_FIELD_MAX_LENGTH),
		signature: base64UrlSchema(CEREMONY_FIELD_MAX_LENGTH),
		userHandle: base64UrlSchema(USER_HANDLE_MAX_LENGTH).optional(),
	}),
	authenticatorAttachment: AuthenticatorAttachmentSchema.optional(),
	clientExtensionResults: ClientExtensionResultsSchema,
	type: z.literal("public-key"),
});

export type PasskeyAuthenticationResponse = z.output<typeof PasskeyAuthenticationResponseSchema>;

// ── Managing the signed-in account's passkeys ───────────────────────────────

/** One of the signed-in account's passkeys, as the settings page lists it (never the public key). */
export const PasskeySchema = z.object({
	id: z.uuid(),
	name: PasskeyNameSchema,
	deviceType: PasskeyDeviceTypeSchema,
	/** A synced passkey that the provider reports as backed up (it survives losing this device). */
	backedUp: z.boolean(),
	transports: z.array(PasskeyTransportSchema).max(MAX_TRANSPORTS),
	createdAt: EpochMsSchema,
	lastUsedAt: EpochMsSchema.nullable(),
});

export type Passkey = z.output<typeof PasskeySchema>;

/** `GET /auth/passkeys`: the account's live passkeys, newest first. */
export const PasskeyListSchema = z.object({
	passkeys: z.array(PasskeySchema).max(MAX_PASSKEYS_PER_ACCOUNT),
});

export type PasskeyList = z.output<typeof PasskeyListSchema>;

/** `POST /auth/passkeys/registration/options`: adding a sign-in credential needs the password again (ADR 080). */
export const StartPasskeyRegistrationSchema = z
	.object({
		password: z.string().min(1, "Password is required"),
	})
	.strict();

export type StartPasskeyRegistrationInput = z.output<typeof StartPasskeyRegistrationSchema>;

/** A ceremony's options and the id of the single-use challenge they carry (sent back with the response). */
export const PasskeyRegistrationOptionsResponseSchema = z.object({
	challengeId: z.uuid(),
	options: PasskeyRegistrationOptionsSchema,
});

export type PasskeyRegistrationOptionsResponse = z.output<typeof PasskeyRegistrationOptionsResponseSchema>;

/** `POST /auth/passkeys/registration`: the new credential, the challenge it answers and its name. */
export const CompletePasskeyRegistrationSchema = z
	.object({
		challengeId: z.uuid(),
		name: PasskeyNameSchema,
		response: PasskeyRegistrationResponseSchema,
	})
	.strict();

export type CompletePasskeyRegistrationInput = z.output<typeof CompletePasskeyRegistrationSchema>;

/** The `:passkeyId` path parameter. */
export const PasskeyPathSchema = z.object({ passkeyId: UuidParamSchema }).strict();

export type PasskeyPath = z.output<typeof PasskeyPathSchema>;

/** `PATCH /auth/passkeys/:passkeyId` body. */
export const RenamePasskeyBodySchema = z.object({ name: PasskeyNameSchema }).strict();

export type RenamePasskeyBody = z.output<typeof RenamePasskeyBodySchema>;

/** `PATCH /auth/passkeys/:passkeyId`, path and body. */
export const RenamePasskeySchema = z.object({ passkeyId: UuidParamSchema, name: PasskeyNameSchema }).strict();

export type RenamePasskeyInput = z.output<typeof RenamePasskeySchema>;

export const PasskeyMessageResponseSchema = PlainMessageResponseSchema;

export type PasskeyMessageResponse = z.output<typeof PasskeyMessageResponseSchema>;

// ── Signing in with a passkey ───────────────────────────────────────────────

/** Sign-in options and the id of the single-use challenge they carry. */
export const PasskeyAuthenticationOptionsResponseSchema = z.object({
	challengeId: z.uuid(),
	options: PasskeyAuthenticationOptionsSchema,
});

export type PasskeyAuthenticationOptionsResponse = z.output<typeof PasskeyAuthenticationOptionsResponseSchema>;

/** `POST /auth/login/2fa/passkey/options`: the second step of a password sign-in (the `tempToken` it answered). */
export const PasskeySecondFactorOptionsSchema = z
	.object({
		tempToken: z.string().min(1),
	})
	.strict();

export type PasskeySecondFactorOptionsInput = z.output<typeof PasskeySecondFactorOptionsSchema>;

/** `POST /auth/login/2fa/passkey`: complete a password sign-in with a passkey instead of a TOTP code. */
export const LoginPasskeySecondFactorSchema = z
	.object({
		tempToken: z.string().min(1),
		challengeId: z.uuid(),
		response: PasskeyAuthenticationResponseSchema,
	})
	.strict();

export type LoginPasskeySecondFactorInput = z.output<typeof LoginPasskeySecondFactorSchema>;

/** `POST /auth/login/passkey/options`: a passwordless sign-in names no account (discoverable credentials). */
export const PasswordlessPasskeyOptionsSchema = z.object({}).strict();

export type PasswordlessPasskeyOptionsInput = z.output<typeof PasswordlessPasskeyOptionsSchema>;

/** `POST /auth/login/passkey`: a passwordless sign-in; the passkey names the account. */
export const LoginPasswordlessPasskeySchema = z
	.object({
		challengeId: z.uuid(),
		response: PasskeyAuthenticationResponseSchema,
	})
	.strict();

export type LoginPasswordlessPasskeyInput = z.output<typeof LoginPasswordlessPasskeySchema>;

// ── Native app association (Android Digital Asset Links, Apple app-site-association) ─

/** `GET /.well-known/assetlinks.json`: lets the configured Android app use this site's passkeys. */
export const AndroidAssetLinksSchema = z.array(
	z.object({
		relation: z.array(z.string().min(1)).min(1),
		target: z.object({
			namespace: z.literal("android_app"),
			package_name: z.string().min(1),
			sha256_cert_fingerprints: z.array(z.string().min(1)).min(1),
		}),
	}),
);

export type AndroidAssetLinks = z.output<typeof AndroidAssetLinksSchema>;

/** `GET /.well-known/apple-app-site-association`: lets the configured iOS apps use this site's passkeys. */
export const AppleAppSiteAssociationSchema = z.object({
	webcredentials: z.object({ apps: z.array(z.string().min(1)) }),
});

export type AppleAppSiteAssociation = z.output<typeof AppleAppSiteAssociationSchema>;

/** The Digital Asset Links relation that lets an Android app use a site's passkeys (and saved sign-ins). */
export const ANDROID_LOGIN_CREDENTIALS_RELATION = "delegate_permission/common.get_login_creds";

/**
 * `GET /auth/passkeys/app-associations`: both files a native app's passkeys depend on, which the web app serves
 * at its `/.well-known/` paths (the RP ID's host). Empty lists when no app is configured: the files then
 * associate nothing.
 */
export const PasskeyAppAssociationsSchema = z.object({
	assetLinks: AndroidAssetLinksSchema,
	appleAppSiteAssociation: AppleAppSiteAssociationSchema,
});

export type PasskeyAppAssociations = z.output<typeof PasskeyAppAssociationsSchema>;
