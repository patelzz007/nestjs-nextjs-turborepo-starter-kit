import type { Passkey as PasskeyView } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Passkey } from "../../domain/aggregates/passkey.aggregate";
import type { WebAuthnChallenge } from "../../domain/aggregates/web-authn-challenge.aggregate";
import { PasskeyChangeDuringImpersonationError } from "../../domain/errors/identity.errors";
import type { CredentialCryptoPort } from "../ports/credential-crypto.port";
import type { ChallengeCheck, PasskeyCredentialRef, StoredPasskeyKey } from "../ports/web-authn.port";

/** The settings-page view of a passkey (never its public key or counter). */
export function toPasskeyView(passkey: Passkey): PasskeyView {
	const { id, name, deviceType, backedUp, transports, createdAt, lastUsedAt } = passkey.snapshot;
	return { id, name, deviceType, backedUp, transports: [...transports], createdAt, lastUsedAt };
}

export function credentialRefOf(passkey: Passkey): PasskeyCredentialRef {
	const { credentialId, transports } = passkey.snapshot;
	return { credentialId, transports };
}

export function storedKeyOf(passkey: Passkey): StoredPasskeyKey {
	const { credentialId, transports, publicKey, counter } = passkey.snapshot;
	return { credentialId, transports, publicKey, counter };
}

/** Checks the challenge a browser signed against the stored digest (only the digest is ever stored). */
export function challengeCheckOf(challenge: WebAuthnChallenge, crypto: CredentialCryptoPort): ChallengeCheck {
	return (signed: string): boolean => challenge.matches(crypto.hashTokenDigest(signed));
}

/** An impersonating administrator may never add, rename or remove the user's sign-in credentials (ADR 080). */
export function assertPasskeyChangeAllowed(actor: ActorContext): void {
	if (actor.kind === "user" && actor.impersonatorUserId !== null) {
		throw new PasskeyChangeDuringImpersonationError();
	}
}
