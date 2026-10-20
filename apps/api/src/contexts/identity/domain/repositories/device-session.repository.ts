import type { EpochMs } from "@workspace/shared";

import type { DeviceSession, DeviceSessionState, LiveSessionSummary } from "../aggregates/device-session.aggregate";
import type { SessionRevoker } from "../value-objects/session-revoker.value-object";

/** What revoking one of a user's sessions found. */
export type OwnSessionRevocation = "revoked" | "already_revoked" | "not_found";

/** What saving a rotation found: this call rotated it, or it lost the compare-and-set to `outcome`. */
export type RotationWrite = { readonly kind: "rotated" } | { readonly kind: "lost"; readonly current: DeviceSessionState | null };

/** Device sessions, bound to one unit-of-work transaction. */
export interface DeviceSessionRepository {
	/** Any session with this id, live or revoked. */
	findById(id: string): Promise<DeviceSession | null>;

	add(session: DeviceSession): Promise<void>;

	/**
	 * Writes a rotation in place: compare-and-set on the digest the session was loaded with, while it
	 * is live and unexpired. A lost race returns the row as it is now, for classification.
	 */
	saveRotation(session: DeviceSession, expectedTokenHash: string, now: EpochMs): Promise<RotationWrite>;

	/** The user's live sessions (not revoked), for the sign-in sweep. */
	liveSessionsOf(userId: string): Promise<readonly LiveSessionSummary[]>;

	/** Soft-deletes these live sessions with `revoker` as `deletedBy` (already revoked ones keep their marker). */
	revokeSessions(sessionIds: readonly string[], revoker: SessionRevoker, now: EpochMs): Promise<void>;

	/** Soft-deletes every live session of the users. */
	revokeAllOf(userIds: readonly string[], revoker: SessionRevoker, now: EpochMs, keepSessionId: string | null): Promise<void>;

	/** Soft-deletes one of the user's sessions (compare-and-set on `is_deleted = false`). */
	revokeOwn(sessionId: string, userId: string, revoker: SessionRevoker, now: EpochMs): Promise<OwnSessionRevocation>;
}
