import { epochMs, type EpochMs } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";
import { PasskeyChallengeInvalidError } from "../errors/identity.errors";
import type { IdentityEvent } from "../events/identity.events";

/** Milliseconds per minute. */
const MS_PER_MINUTE = 60_000;

/** Minutes a WebAuthn ceremony may take between the options and the browser's response. */
const CHALLENGE_TTL_MINUTES = 5;

/** How long a WebAuthn challenge stays usable (also the ceremony `timeout` the browser is given). */
export const WEB_AUTHN_CHALLENGE_TTL_MS = CHALLENGE_TTL_MINUTES * MS_PER_MINUTE;

/** Minutes an expired challenge is kept before the cleanup soft-deletes it (room for a late, refused response). */
const CHALLENGE_RETENTION_MINUTES = 60;

/** How long after its expiry a challenge is retired. */
export const WEB_AUTHN_CHALLENGE_RETENTION_MS = CHALLENGE_RETENTION_MINUTES * MS_PER_MINUTE;

/** What a ceremony is for (mirrors the Prisma enum `WebAuthnChallengePurpose`). */
export type WebAuthnChallengePurpose = "REGISTRATION" | "SECOND_FACTOR" | "PASSWORDLESS";

export interface WebAuthnChallengeState {
	readonly id: string;
	/** `null` only for a passwordless sign-in: the passkey names the account. */
	readonly userId: string | null;
	readonly purpose: WebAuthnChallengePurpose;
	/** SHA-256 (hex) of the challenge the browser signs. */
	readonly challengeHash: string;
	/** The password sign-in a SECOND_FACTOR challenge belongs to. */
	readonly loginChallengeId: string | null;
	readonly expiresAt: EpochMs;
	readonly consumedAt: EpochMs | null;
}

/** What the step completing a ceremony expects of its challenge. */
export type WebAuthnChallengeExpectation =
	| { readonly purpose: "REGISTRATION"; readonly userId: string }
	| { readonly purpose: "SECOND_FACTOR"; readonly userId: string; readonly loginChallengeId: string }
	| { readonly purpose: "PASSWORDLESS" };

/**
 * The single-use challenge of one WebAuthn ceremony (ADR 080). It is consumed by the step that verifies
 * the browser's response — whether or not the response verifies, so a challenge is never tried twice —
 * and the repository writes that with a compare-and-set on `consumedAt IS NULL`: two concurrent
 * completions cannot both use it. Every mismatch (purpose, account, login, expiry, reuse) is the same
 * {@link PasskeyChallengeInvalidError}.
 */
export class WebAuthnChallenge extends AggregateRoot<IdentityEvent> {
	private consumedNow = false;

	private constructor(private state: WebAuthnChallengeState) {
		super();
	}

	public static forRegistration(input: { readonly id: string; readonly userId: string; readonly challengeHash: string }, now: EpochMs): WebAuthnChallenge {
		return WebAuthnChallenge.issue({ ...input, purpose: "REGISTRATION", loginChallengeId: null }, now);
	}

	public static forSecondFactor(
		input: { readonly id: string; readonly userId: string; readonly loginChallengeId: string; readonly challengeHash: string },
		now: EpochMs,
	): WebAuthnChallenge {
		return WebAuthnChallenge.issue({ ...input, purpose: "SECOND_FACTOR" }, now);
	}

	public static forPasswordless(input: { readonly id: string; readonly challengeHash: string }, now: EpochMs): WebAuthnChallenge {
		return WebAuthnChallenge.issue({ ...input, userId: null, purpose: "PASSWORDLESS", loginChallengeId: null }, now);
	}

	public static rehydrate(state: WebAuthnChallengeState): WebAuthnChallenge {
		const needsUser: boolean = state.purpose !== "PASSWORDLESS";
		const needsLogin: boolean = state.purpose === "SECOND_FACTOR";
		if (needsUser !== (state.userId !== null) || needsLogin !== (state.loginChallengeId !== null) || state.challengeHash.length === 0) {
			throw new CorruptAggregateStateError("web_authn_challenge", state.id, `a ${state.purpose} challenge has the wrong account or login reference`);
		}
		return new WebAuthnChallenge(state);
	}

	private static issue(input: Omit<WebAuthnChallengeState, "expiresAt" | "consumedAt">, now: EpochMs): WebAuthnChallenge {
		return new WebAuthnChallenge({ ...input, expiresAt: epochMs(now + WEB_AUTHN_CHALLENGE_TTL_MS), consumedAt: null });
	}

	public get id(): string {
		return this.state.id;
	}

	public get snapshot(): WebAuthnChallengeState {
		return this.state;
	}

	/** Whether {@link WebAuthnChallenge.consumeFor} ran in this unit of work (the repository writes it conditionally). */
	public get wasConsumed(): boolean {
		return this.consumedNow;
	}

	/** Whether `challengeDigest` (SHA-256 hex of what the browser signed) is this challenge. */
	public matches(challengeDigest: string): boolean {
		return challengeDigest === this.state.challengeHash;
	}

	/** Spends the challenge for the step described by `expected`, or refuses it. */
	public consumeFor(expected: WebAuthnChallengeExpectation, now: EpochMs): void {
		if (this.state.consumedAt !== null || this.state.expiresAt < now || !this.isFor(expected)) {
			throw new PasskeyChallengeInvalidError();
		}
		this.state = { ...this.state, consumedAt: now };
		this.consumedNow = true;
	}

	private isFor(expected: WebAuthnChallengeExpectation): boolean {
		switch (expected.purpose) {
			case "REGISTRATION":
				return this.state.purpose === "REGISTRATION" && this.state.userId === expected.userId;
			case "SECOND_FACTOR":
				return this.state.purpose === "SECOND_FACTOR" && this.state.userId === expected.userId && this.state.loginChallengeId === expected.loginChallengeId;
			case "PASSWORDLESS":
				return this.state.purpose === "PASSWORDLESS";
		}
	}
}
