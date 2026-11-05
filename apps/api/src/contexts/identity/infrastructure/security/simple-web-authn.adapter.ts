import { Injectable, Logger } from "@nestjs/common";
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
	type AuthenticationExtensionsClientOutputs,
	type AuthenticationResponseJSON,
	type CredentialDeviceType,
	type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
	ANDROID_LOGIN_CREDENTIALS_RELATION,
	PasskeyAuthenticationOptionsSchema,
	PasskeyRegistrationOptionsSchema,
	PasskeyTransportSchema,
	type PasskeyAppAssociations,
	type PasskeyAuthenticationOptions,
	type PasskeyAuthenticationResponse,
	type PasskeyDeviceType,
	type PasskeyRegistrationOptions,
	type PasskeyRegistrationResponse,
	type PasskeyTransport,
} from "@workspace/shared";

import type { PasskeysConfig } from "../../../../config/api-config.schema";
import { TypedConfigService } from "../../../../config/typed-config.service";
import type { PasskeyAssertion, VerifiedPasskeyCredential } from "../../domain/aggregates/passkey.aggregate";
import { WEB_AUTHN_CHALLENGE_TTL_MS } from "../../domain/aggregates/web-authn-challenge.aggregate";
import type { CeremonyVerification, ChallengeCheck, PasskeyAccountRef, PasskeyCredentialRef, StoredPasskeyKey, WebAuthnPort } from "../../application/ports/web-authn.port";

/** The relying party one deployment is (`config.passkeys`). */
export interface WebAuthnRelyingParty {
	readonly rpId: string;
	readonly rpName: string;
	readonly origins: readonly string[];
}

/** Every passkey is discoverable (a passwordless sign-in names no account) and proves user verification. */
const AUTHENTICATOR_SELECTION = { residentKey: "required", userVerification: "required" } satisfies PasskeyRegistrationOptions["authenticatorSelection"];

/** The reason logged when the library throws something that is not an `Error`. */
const UNKNOWN_FAILURE = "verification failed";

const DEVICE_TYPE: Readonly<Record<CredentialDeviceType, PasskeyDeviceType>> = {
	singleDevice: "SINGLE_DEVICE",
	multiDevice: "MULTI_DEVICE",
};

/** Only the present optional fields: the library's JSON types forbid an explicit `undefined`. */
function extensionResultsOf(results: PasskeyRegistrationResponse["clientExtensionResults"]): AuthenticationExtensionsClientOutputs {
	const { credProps } = results;
	if (credProps === undefined) {
		return {};
	}
	return { credProps: credProps.rk === undefined ? {} : { rk: credProps.rk } };
}

function registrationJsonOf(credential: PasskeyRegistrationResponse): RegistrationResponseJSON {
	const { authenticatorData, transports, publicKeyAlgorithm, publicKey, ...required } = credential.response;
	return {
		id: credential.id,
		rawId: credential.rawId,
		type: credential.type,
		clientExtensionResults: extensionResultsOf(credential.clientExtensionResults),
		...(credential.authenticatorAttachment === undefined ? {} : { authenticatorAttachment: credential.authenticatorAttachment }),
		response: {
			...required,
			...(authenticatorData === undefined ? {} : { authenticatorData }),
			...(transports === undefined ? {} : { transports }),
			...(publicKeyAlgorithm === undefined ? {} : { publicKeyAlgorithm }),
			...(publicKey === undefined ? {} : { publicKey }),
		},
	};
}

function authenticationJsonOf(assertion: PasskeyAuthenticationResponse): AuthenticationResponseJSON {
	const { userHandle, ...required } = assertion.response;
	return {
		id: assertion.id,
		rawId: assertion.rawId,
		type: assertion.type,
		clientExtensionResults: extensionResultsOf(assertion.clientExtensionResults),
		...(assertion.authenticatorAttachment === undefined ? {} : { authenticatorAttachment: assertion.authenticatorAttachment }),
		response: { ...required, ...(userHandle === undefined ? {} : { userHandle }) },
	};
}

function descriptorsOf(credentials: readonly PasskeyCredentialRef[]): { id: string; transports: PasskeyTransport[] }[] {
	return credentials.map((credential: PasskeyCredentialRef) => ({ id: credential.credentialId, transports: [...credential.transports] }));
}

/** The library's transports of a verified credential, kept only when this API knows them. */
function knownTransports(reported: readonly string[]): PasskeyTransport[] {
	return reported.flatMap((name: string): PasskeyTransport[] => {
		const known = PasskeyTransportSchema.safeParse(name);
		return known.success ? [known.data] : [];
	});
}

/**
 * The WebAuthn relying party over `@simplewebauthn/server` (ADR 080). Options always ask for a
 * discoverable credential with user verification and attestation "none"; verification pins the RP ID
 * and the allowed origins and requires user verification. A failed verification (the library throws)
 * becomes `{ verified: false, reason }` — the reason is logged, never answered.
 */
@Injectable()
export class SimpleWebAuthnAdapter implements WebAuthnPort {
	private readonly logger: Logger = new Logger(SimpleWebAuthnAdapter.name);
	private readonly relyingParty: WebAuthnRelyingParty;
	private readonly nativeApps: Pick<PasskeysConfig, "androidApp" | "appleAppIds">;

	public constructor(config: TypedConfigService) {
		this.relyingParty = config.passkeys;
		this.nativeApps = config.passkeys;
	}

	public async registrationOptions(account: PasskeyAccountRef, exclude: readonly PasskeyCredentialRef[]): Promise<PasskeyRegistrationOptions> {
		const options = await generateRegistrationOptions({
			rpName: this.relyingParty.rpName,
			rpID: this.relyingParty.rpId,
			userName: account.userName,
			userDisplayName: account.displayName,
			userID: new Uint8Array(Buffer.from(account.userId, "utf8")),
			timeout: WEB_AUTHN_CHALLENGE_TTL_MS,
			attestationType: "none",
			excludeCredentials: descriptorsOf(exclude),
			authenticatorSelection: AUTHENTICATOR_SELECTION,
		});
		return PasskeyRegistrationOptionsSchema.parse(options);
	}

	public async verifyRegistration(response: PasskeyRegistrationResponse, isExpectedChallenge: ChallengeCheck): Promise<CeremonyVerification<VerifiedPasskeyCredential>> {
		try {
			const verification = await verifyRegistrationResponse({
				response: registrationJsonOf(response),
				expectedChallenge: isExpectedChallenge,
				expectedOrigin: [...this.relyingParty.origins],
				expectedRPID: this.relyingParty.rpId,
				requireUserVerification: true,
			});
			if (!verification.verified) {
				return { verified: false, reason: "registration response did not verify" };
			}
			const info = verification.registrationInfo;
			return {
				verified: true,
				value: {
					credentialId: info.credential.id,
					publicKey: Buffer.from(info.credential.publicKey).toString("base64url"),
					counter: info.credential.counter,
					transports: knownTransports(info.credential.transports ?? response.response.transports ?? []),
					deviceType: DEVICE_TYPE[info.credentialDeviceType],
					backedUp: info.credentialBackedUp,
					aaguid: info.aaguid,
				},
			};
		} catch (error: unknown) {
			return this.rejected("registration", error instanceof Error ? error.message : UNKNOWN_FAILURE);
		}
	}

	public async authenticationOptions(allow: readonly PasskeyCredentialRef[]): Promise<PasskeyAuthenticationOptions> {
		const options = await generateAuthenticationOptions({
			rpID: this.relyingParty.rpId,
			allowCredentials: descriptorsOf(allow),
			timeout: WEB_AUTHN_CHALLENGE_TTL_MS,
			userVerification: "required",
		});
		return PasskeyAuthenticationOptionsSchema.parse(options);
	}

	public async verifyAuthentication(
		response: PasskeyAuthenticationResponse,
		key: StoredPasskeyKey,
		isExpectedChallenge: ChallengeCheck,
	): Promise<CeremonyVerification<PasskeyAssertion>> {
		try {
			const verification = await verifyAuthenticationResponse({
				response: authenticationJsonOf(response),
				expectedChallenge: isExpectedChallenge,
				expectedOrigin: [...this.relyingParty.origins],
				expectedRPID: this.relyingParty.rpId,
				credential: {
					id: key.credentialId,
					publicKey: new Uint8Array(Buffer.from(key.publicKey, "base64url")),
					counter: key.counter,
					transports: [...key.transports],
				},
				requireUserVerification: true,
			});
			if (!verification.verified) {
				return { verified: false, reason: "authentication response did not verify" };
			}
			return { verified: true, value: { newCounter: verification.authenticationInfo.newCounter, backedUp: verification.authenticationInfo.credentialBackedUp } };
		} catch (error: unknown) {
			return this.rejected("authentication", error instanceof Error ? error.message : UNKNOWN_FAILURE);
		}
	}

	public userHandleOf(userId: string): string {
		return Buffer.from(userId, "utf8").toString("base64url");
	}

	public appAssociations(): PasskeyAppAssociations {
		const { androidApp, appleAppIds } = this.nativeApps;
		return {
			assetLinks:
				androidApp === null
					? []
					: [
							{
								relation: [ANDROID_LOGIN_CREDENTIALS_RELATION],
								target: { namespace: "android_app", package_name: androidApp.packageName, sha256_cert_fingerprints: [...androidApp.certFingerprints] },
							},
						],
			appleAppSiteAssociation: { webcredentials: { apps: [...appleAppIds] } },
		};
	}

	private rejected(ceremony: "registration" | "authentication", reason: string): { readonly verified: false; readonly reason: string } {
		this.logger.warn({ event: "passkey.ceremony.rejected", ceremony, reason });
		return { verified: false, reason };
	}
}
