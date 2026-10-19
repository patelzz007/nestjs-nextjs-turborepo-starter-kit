import type { EpochMs } from "@workspace/shared";

import type { ImpersonationSession } from "../aggregates/impersonation-session.aggregate";

/** Impersonation sessions and their immutable START/STOP audit rows, bound to one unit-of-work transaction. */
export interface ImpersonationSessionRepository {
	findById(id: string): Promise<ImpersonationSession | null>;

	/** Whether the administrator has a session that has not ended and not expired at `now`. Read under their row lock (D36). */
	hasLiveSessionFor(impersonatorId: string, now: EpochMs): Promise<boolean>;

	/** Inserts the session and its START audit row. */
	add(session: ImpersonationSession): Promise<void>;

	/** Ends the session (compare-and-set on `ended_at IS NULL`) and writes its STOP audit row. Zero rows throws `ImpersonationSessionInvalidError`. */
	saveEnded(session: ImpersonationSession): Promise<void>;
}
