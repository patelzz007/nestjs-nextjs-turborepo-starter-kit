import type { EpochMs } from "@workspace/shared";

import type { Passkey } from "../aggregates/passkey.aggregate";
import type { WebAuthnChallenge } from "../aggregates/web-authn-challenge.aggregate";

/** Passkeys, bound to one unit-of-work transaction. Every read returns live (not removed) passkeys only. */
export interface PasskeyRepository {
	/** The account's passkeys, newest first. */
	listLive(userId: string): Promise<readonly Passkey[]>;

	countLive(userId: string): Promise<number>;

	findLiveById(id: string): Promise<Passkey | null>;

	/** The passkey a sign-in assertion names (any account: the sign-in does not know the account yet). */
	findLiveByCredentialId(credentialId: string): Promise<Passkey | null>;

	/** Stores a new passkey; a credential id that was ever registered throws `PasskeyAlreadyRegisteredError`. */
	add(passkey: Passkey): Promise<void>;

	/**
	 * Applies the pending changes, each conditionally on a live row: a use requires the counter it read
	 * (`PasskeyVerificationFailedError` otherwise — a concurrent use won), a rename or removal requires the
	 * row to be live (`PasskeyNotFoundError` otherwise).
	 */
	save(passkey: Passkey): Promise<void>;
}

/** WebAuthn ceremony challenges, bound to one unit-of-work transaction. */
export interface WebAuthnChallengeRepository {
	add(challenge: WebAuthnChallenge): Promise<void>;

	/** A live challenge by id, or `null`. */
	findById(id: string): Promise<WebAuthnChallenge | null>;

	/** Writes a consumed challenge: compare-and-set on `consumedAt IS NULL`. Zero rows throws `PasskeyChallengeInvalidError`. */
	saveConsumed(challenge: WebAuthnChallenge): Promise<void>;

	/** Soft-deletes every challenge that expired more than `retentionMs` before `now`; returns how many. */
	retireExpired(now: EpochMs, retentionMs: number): Promise<number>;
}
