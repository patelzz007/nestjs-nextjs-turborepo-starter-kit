import { Inject, Injectable } from "@nestjs/common";
import type { EpochMs } from "@workspace/shared";

import { AUTHORIZATION_CACHE_INVALIDATION, type AuthorizationCacheInvalidationPort } from "../../../authorization/public-api";
import type { AuthorizationChange, AuthorizationChangeFeedPort } from "../ports/authorization-change-feed.port";
import { AUTHORIZATION_CHANGE_FEED, USER_SESSION_CACHE } from "../ports/identity.tokens";
import type { UserSessionCachePort } from "../ports/user-session-cache.port";

/** How often every instance sweeps: the longest an instance keeps authorization whose invalidation it missed. */
export const AUTHORIZATION_CHANGE_SWEEP_INTERVAL_MS = 15_000;

/**
 * How far back each sweep looks. Longer than the interval plus the longest a revoking transaction takes to
 * commit after its stamp (the stamp is taken mid-transaction), so a late commit still falls inside a sweep.
 */
export const AUTHORIZATION_CHANGE_SWEEP_WINDOW_MS = 120_000;

/** Stamps read per page; a bulk change (a role edit touching thousands of members) is read page by page. */
export const AUTHORIZATION_CHANGE_SWEEP_PAGE_SIZE = 500;

/** What one sweep found and dropped. */
export interface AuthorizationChangeSweepResult {
	/** Accounts with a stamp inside the window. */
	readonly inWindow: number;
	/** Of those, the ones whose current stamp this instance had not applied yet. */
	readonly invalidated: number;
}

/**
 * The durable backstop of cache invalidation. Access changes are invalidated after commit over Redis
 * (`authz:invalidate`) — fast, but at most once: a crash between commit and publish, or a Redis outage,
 * loses the message and an instance would keep the old authorization until its cache TTL.
 *
 * Every change also commits a stamp (`User.authorizationChangedAt`). Each instance reads the stamps of
 * the trailing window and drops what IT cached for any account whose stamp it has not applied yet, so a
 * lost message costs one sweep interval. Applied stamps are remembered for exactly the current window, so a
 * stamp is applied once per instance, and a newer stamp on the same account is applied again.
 */
@Injectable()
export class AuthorizationChangeSweep {
	private applied: ReadonlyMap<string, EpochMs> = new Map<string, EpochMs>();

	public constructor(
		@Inject(AUTHORIZATION_CHANGE_FEED) private readonly feed: AuthorizationChangeFeedPort,
		@Inject(USER_SESSION_CACHE) private readonly sessionCache: Pick<UserSessionCachePort, "invalidateUsers">,
		@Inject(AUTHORIZATION_CACHE_INVALIDATION) private readonly authorization: Pick<AuthorizationCacheInvalidationPort, "invalidateUsersOnThisInstance">,
	) {}

	public async sweepOnce(): Promise<AuthorizationChangeSweepResult> {
		const inWindow: ReadonlyMap<string, EpochMs> = await this.readWindow();
		const unapplied: string[] = [...inWindow].filter(([userId, changedAt]): boolean => this.applied.get(userId) !== changedAt).map(([userId]): string => userId);
		if (unapplied.length > 0) {
			this.authorization.invalidateUsersOnThisInstance(unapplied, "authorization_change_sweep");
			await this.sessionCache.invalidateUsers(unapplied);
		}
		this.applied = inWindow;
		return { inWindow: inWindow.size, invalidated: unapplied.length };
	}

	/** Every account's latest stamp inside the window, read page by page (oldest first, so a later page wins). */
	private async readWindow(): Promise<ReadonlyMap<string, EpochMs>> {
		const latest = new Map<string, EpochMs>();
		let after: AuthorizationChange | null = null;
		for (;;) {
			const page: readonly AuthorizationChange[] = await this.feed.changedWithin(AUTHORIZATION_CHANGE_SWEEP_WINDOW_MS, after, AUTHORIZATION_CHANGE_SWEEP_PAGE_SIZE);
			for (const change of page) {
				latest.set(change.userId, change.changedAt);
			}
			const last: AuthorizationChange | undefined = page.at(-1);
			if (last === undefined || page.length < AUTHORIZATION_CHANGE_SWEEP_PAGE_SIZE) {
				return latest;
			}
			after = last;
		}
	}
}
