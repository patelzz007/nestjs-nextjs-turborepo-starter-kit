import type { EpochMs } from "@workspace/shared";

/** One account whose access changed, and the stamp of that change (epoch ms, database clock). */
export interface AuthorizationChange {
	readonly userId: string;
	readonly changedAt: EpochMs;
}

/**
 * The durable record of access changes: `User.authorizationChangedAt`, stamped in the same transaction as
 * every token-version bump, deactivation or deletion. Read by every instance's {@link AuthorizationChangeSweep}.
 */
export interface AuthorizationChangeFeedPort {
	/**
	 * The accounts whose access changed within the last `windowMs` (measured on the database clock, the
	 * clock that stamped them), oldest first, at most `limit` per page. `after` is the last change of the
	 * previous page; `null` starts the window.
	 */
	changedWithin(windowMs: number, after: AuthorizationChange | null, limit: number): Promise<readonly AuthorizationChange[]>;
}
