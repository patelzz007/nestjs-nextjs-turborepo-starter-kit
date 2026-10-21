import { epochMs, type EpochMs, type SessionLocation, type SessionSignInMethod } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import { RefreshTokenExpiredError, RefreshTokenInvalidError, RefreshTokenRevokedError } from "../errors/identity.errors";
import { DeviceSessionsRevoked, type IdentityEvent } from "../events/identity.events";
import type { SessionDeviceDetails } from "../value-objects/session-device.value-object";
import { revokedBySystem, type SessionRevoker } from "../value-objects/session-revoker.value-object";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";

/**
 * Grace window after a refresh-token rotation during which presenting the
 * IMMEDIATE predecessor of the current token (the one whose hash is stored in
 * `previousTokenHash`) is treated as a benign concurrent refresh
 * (`REFRESH_TOKEN_SUPERSEDED`) instead of token theft.
 *
 * Any other non-current token of the same session — or the predecessor
 * presented after this window — is reuse, and revokes every session of the user.
 */
export const REFRESH_SUPERSEDED_GRACE_MS = 30_000;

/** Device sessions a user keeps at once; signing in again retires the oldest beyond it (`system:session-limit`). */
export const MAX_ACTIVE_SESSIONS_PER_USER = 5;

export interface DeviceSessionState {
	readonly id: string;
	readonly userId: string;
	/** Digest of the current refresh token (never the token). */
	readonly tokenHash: string;
	readonly previousTokenHash: string | null;
	readonly device: SessionDeviceDetails | null;
	readonly signInMethod: SessionSignInMethod | null;
	readonly ipAddress: string | null;
	readonly lastIpAddress: string | null;
	readonly location: SessionLocation | null;
	readonly createdAt: EpochMs;
	readonly lastActiveAt: EpochMs;
	readonly expiresAt: EpochMs;
	readonly isDeleted: boolean;
	/** Last write: the rotation grace window is measured from it. */
	readonly updatedAt: EpochMs;
}

/** How a presented refresh token compares with the session (the constant-time digest checks happen in the caller). */
export interface PresentedRefreshToken {
	/** The stored hash is a refresh-token digest (rows from before digests used bcrypt and cannot be verified safely). */
	readonly storedHashIsDigest: boolean;
	readonly matchesCurrent: boolean;
	readonly matchesPrevious: boolean;
}

/** What a presented refresh token means for its session. */
export type RefreshDecision = "rotate" | "superseded" | "reused";

/** What a rotation that lost its compare-and-set found when it re-read the session. */
export type LostRotationOutcome = "superseded" | "reused" | "missing";

/** The rotation a refresh writes. */
export interface SessionRotation {
	readonly tokenHash: string;
	readonly expiresAt: EpochMs;
	readonly lastIpAddress: string | null;
	readonly rotatedAt: EpochMs;
}

/** A live session as the sign-in sweep sees it. */
export interface LiveSessionSummary {
	readonly id: string;
	readonly createdAt: EpochMs;
	readonly expiresAt: EpochMs;
}

/** The sessions the sweep at sign-in retires, by reason (each reason is its own `deletedBy` marker). */
export interface SessionSweep {
	readonly expired: readonly string[];
	readonly excess: readonly string[];
}

/**
 * One signed-in device (a `RefreshToken` row): its refresh-token digest, device details and
 * lifecycle. Rotation is a compare-and-set on the stored digest; revocation is a soft delete that
 * records who revoked it (`deletedBy`).
 */
export class DeviceSession extends AggregateRoot<IdentityEvent> {
	private pendingRotation: SessionRotation | null = null;

	private constructor(
		private state: DeviceSessionState,
		public readonly isNew: boolean,
	) {
		super();
	}

	/** A new sign-in. The id is chosen by the caller: it is the refresh token's `jti` and the access token's `sid` (ADR 034). */
	public static issue(
		input: {
			readonly id: string;
			readonly userId: string;
			readonly tokenHash: string;
			readonly device: SessionDeviceDetails;
			readonly ipAddress: string | null;
			readonly location: SessionLocation | null;
			readonly signInMethod: SessionSignInMethod;
			readonly lifetimeMs: number;
		},
		now: EpochMs,
	): DeviceSession {
		return new DeviceSession(
			{
				id: input.id,
				userId: input.userId,
				tokenHash: input.tokenHash,
				previousTokenHash: null,
				device: input.device,
				signInMethod: input.signInMethod,
				ipAddress: input.ipAddress,
				lastIpAddress: input.ipAddress,
				location: input.location,
				createdAt: now,
				lastActiveAt: now,
				expiresAt: epochMs(now + input.lifetimeMs),
				isDeleted: false,
				updatedAt: now,
			},
			true,
		);
	}

	public static rehydrate(state: DeviceSessionState): DeviceSession {
		if (state.tokenHash.length === 0) {
			throw new CorruptAggregateStateError("device_session", null, `session ${state.id} has no token hash`);
		}
		return new DeviceSession(state, false);
	}

	public get id(): string {
		return this.state.id;
	}

	public get userId(): string {
		return this.state.userId;
	}

	public get tokenHash(): string {
		return this.state.tokenHash;
	}

	public get previousTokenHash(): string | null {
		return this.state.previousTokenHash;
	}

	/** Whether this is one of `userId`'s own sessions, not revoked and not expired at `now`. */
	public isLiveFor(userId: string, now: EpochMs): boolean {
		return this.state.userId === userId && !this.state.isDeleted && this.state.expiresAt >= now;
	}

	public get snapshot(): DeviceSessionState {
		return this.state;
	}

	/** The rotation {@link DeviceSession.rotate} recorded, for the repository's compare-and-set. */
	public get rotation(): SessionRotation | null {
		return this.pendingRotation;
	}

	/**
	 * What the presented refresh token means. Throws for a session that is expired, revoked or
	 * unverifiable; otherwise rotate (current token), superseded (the immediate predecessor inside
	 * the grace window) or reused (anything else: theft).
	 */
	public evaluateRefresh(presented: PresentedRefreshToken, now: EpochMs): RefreshDecision {
		if (this.state.expiresAt < now) {
			throw new RefreshTokenExpiredError();
		}
		if (this.state.isDeleted) {
			throw new RefreshTokenRevokedError();
		}
		if (!presented.storedHashIsDigest) {
			// A pre-digest (bcrypt) session cannot be verified safely, and it is no evidence of theft.
			throw new RefreshTokenInvalidError("This session must sign in again.");
		}
		if (presented.matchesCurrent) {
			return "rotate";
		}
		const isWithinGrace: boolean = this.state.updatedAt >= now - REFRESH_SUPERSEDED_GRACE_MS;
		return isWithinGrace && this.state.previousTokenHash !== null && presented.matchesPrevious ? "superseded" : "reused";
	}

	/** Rotates the refresh token in place: the id (`sid`) and every device detail carry forward. */
	public rotate(rotation: SessionRotation): void {
		if (this.state.isDeleted) {
			throw new RefreshTokenRevokedError();
		}
		this.pendingRotation = rotation;
		this.state = {
			...this.state,
			previousTokenHash: this.state.tokenHash,
			tokenHash: rotation.tokenHash,
			expiresAt: rotation.expiresAt,
			lastActiveAt: rotation.rotatedAt,
			lastIpAddress: rotation.lastIpAddress ?? this.state.lastIpAddress,
			updatedAt: rotation.rotatedAt,
		};
	}

	/**
	 * A rotation that lost its compare-and-set re-reads the session (`current`; `null` when gone):
	 * - gone or revoked, or the same digest (it expired) → `missing`;
	 * - the expected digest is now the immediate predecessor, inside the grace window → `superseded`;
	 * - anything else → `reused`.
	 */
	public static classifyLostRotation(current: DeviceSessionState | null, expectedTokenHash: string, now: EpochMs): LostRotationOutcome {
		if (current === null || current.isDeleted || current.tokenHash === expectedTokenHash) {
			return "missing";
		}
		const isImmediatePredecessor: boolean = current.previousTokenHash === expectedTokenHash;
		const isWithinGrace: boolean = current.updatedAt >= now - REFRESH_SUPERSEDED_GRACE_MS;
		return isImmediatePredecessor && isWithinGrace ? "superseded" : "reused";
	}

	/**
	 * The sweep at sign-in (after the user row is locked, so concurrent sign-ins run it one at a
	 * time, D15): every live session past its expiry, then every live session beyond the newest
	 * {@link MAX_ACTIVE_SESSIONS_PER_USER} (newest = latest `createdAt`, ties by id).
	 */
	public static sweepAtSignIn(live: readonly LiveSessionSummary[], now: EpochMs): SessionSweep {
		const expired: string[] = live.filter((session: LiveSessionSummary): boolean => session.expiresAt < now).map((session: LiveSessionSummary): string => session.id);
		const remaining: LiveSessionSummary[] = live
			.filter((session: LiveSessionSummary): boolean => session.expiresAt >= now)
			.sort((left: LiveSessionSummary, right: LiveSessionSummary): number => right.createdAt - left.createdAt || left.id.localeCompare(right.id));
		const excess: string[] = remaining.slice(MAX_ACTIVE_SESSIONS_PER_USER).map((session: LiveSessionSummary): string => session.id);
		return { expired, excess };
	}

	/** The event a non-empty sweep records: the retired sessions' `sid` is rejected on every instance after commit. */
	public static sweepEvent(userId: string, sweep: SessionSweep, now: EpochMs): DeviceSessionsRevoked | null {
		return sweep.expired.length + sweep.excess.length === 0 ? null : new DeviceSessionsRevoked([userId], "session_limit", now);
	}

	/** The marker a sweep records for each reason. */
	public static sweepRevoker(reason: keyof SessionSweep): SessionRevoker {
		return reason === "expired" ? revokedBySystem("system:expired-cleanup") : revokedBySystem("system:session-limit");
	}
}
