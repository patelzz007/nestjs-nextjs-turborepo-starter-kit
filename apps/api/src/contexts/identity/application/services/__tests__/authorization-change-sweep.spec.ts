import { epochMs, type EpochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { AuthorizationCacheInvalidationPort, UserInvalidationTrigger } from "../../../../authorization/public-api";
import type { AuthorizationChange, AuthorizationChangeFeedPort } from "../../ports/authorization-change-feed.port";
import type { UserSessionCachePort } from "../../ports/user-session-cache.port";
import { AUTHORIZATION_CHANGE_SWEEP_PAGE_SIZE, AUTHORIZATION_CHANGE_SWEEP_WINDOW_MS, AuthorizationChangeSweep } from "../authorization-change-sweep";

/** TEST-ONLY feed: the stamps currently inside the window, served oldest first in keyset pages like the SQL. */
class InMemoryAuthorizationChangeFeed implements AuthorizationChangeFeedPort {
	public stamps: AuthorizationChange[] = [];
	public readonly windows: number[] = [];

	public changedWithin(windowMs: number, after: AuthorizationChange | null, limit: number): Promise<readonly AuthorizationChange[]> {
		this.windows.push(windowMs);
		const ordered = [...this.stamps].sort((a, b): number => a.changedAt - b.changedAt || a.userId.localeCompare(b.userId));
		const start =
			after === null
				? 0
				: ordered.findIndex((change): boolean => change.changedAt > after.changedAt || (change.changedAt === after.changedAt && change.userId > after.userId));
		return Promise.resolve(start === -1 ? [] : ordered.slice(start, start + limit));
	}
}

/** TEST-ONLY session cache: records whose `/auth/me` and `/auth/permissions` entries were dropped. */
class RecordingSessionCache implements Pick<UserSessionCachePort, "invalidateUsers"> {
	public readonly invalidated: string[][] = [];

	public invalidateUsers(userIds: readonly string[]): Promise<void> {
		this.invalidated.push([...userIds]);
		return Promise.resolve();
	}
}

/** TEST-ONLY authorization cache: records this instance's local invalidations. */
class RecordingAuthorizationCache implements Pick<AuthorizationCacheInvalidationPort, "invalidateUsersOnThisInstance"> {
	public readonly invalidated: { readonly userIds: string[]; readonly trigger: UserInvalidationTrigger }[] = [];

	public invalidateUsersOnThisInstance(userIds: readonly string[], trigger: UserInvalidationTrigger): void {
		this.invalidated.push({ userIds: [...userIds], trigger });
	}
}

const T0: EpochMs = epochMs(1_786_300_000_000);

function change(userId: string, offsetMs: number): AuthorizationChange {
	return { userId, changedAt: epochMs(T0 + offsetMs) };
}

function setup(): { sweep: AuthorizationChangeSweep; feed: InMemoryAuthorizationChangeFeed; sessions: RecordingSessionCache; authorization: RecordingAuthorizationCache } {
	const feed = new InMemoryAuthorizationChangeFeed();
	const sessions = new RecordingSessionCache();
	const authorization = new RecordingAuthorizationCache();
	return { sweep: new AuthorizationChangeSweep(feed, sessions, authorization), feed, sessions, authorization };
}

describe("AuthorizationChangeSweep", () => {
	it("drops this instance's cached authorization and session payloads for every stamped account in the window", async () => {
		const { sweep, feed, sessions, authorization } = setup();
		feed.stamps = [change("user-1", 0), change("user-2", 5)];

		await expect(sweep.sweepOnce()).resolves.toEqual({ inWindow: 2, invalidated: 2 });

		expect(authorization.invalidated).toEqual([{ userIds: ["user-1", "user-2"], trigger: "authorization_change_sweep" }]);
		expect(sessions.invalidated).toEqual([["user-1", "user-2"]]);
		expect(feed.windows).toEqual([AUTHORIZATION_CHANGE_SWEEP_WINDOW_MS]);
	});

	it("applies a stamp once: the next sweep over the same window drops nothing", async () => {
		const { sweep, feed, sessions, authorization } = setup();
		feed.stamps = [change("user-1", 0)];
		await sweep.sweepOnce();

		await expect(sweep.sweepOnce()).resolves.toEqual({ inWindow: 1, invalidated: 0 });

		expect(authorization.invalidated).toHaveLength(1);
		expect(sessions.invalidated).toHaveLength(1);
	});

	it("applies a newer stamp on an account it already swept (a second revocation)", async () => {
		const { sweep, feed, authorization } = setup();
		feed.stamps = [change("user-1", 0), change("user-2", 1)];
		await sweep.sweepOnce();
		feed.stamps = [change("user-1", 30), change("user-2", 1)];

		await expect(sweep.sweepOnce()).resolves.toEqual({ inWindow: 2, invalidated: 1 });

		expect(authorization.invalidated.at(-1)?.userIds).toEqual(["user-1"]);
	});

	it("reads a bulk change page by page, so every account in the window is dropped", async () => {
		const { sweep, feed, authorization } = setup();
		const bulk = AUTHORIZATION_CHANGE_SWEEP_PAGE_SIZE * 2 + 1;
		feed.stamps = Array.from({ length: bulk }, (_, index): AuthorizationChange => change(`user-${String(index).padStart(4, "0")}`, index));

		await expect(sweep.sweepOnce()).resolves.toEqual({ inWindow: bulk, invalidated: bulk });

		expect(new Set(authorization.invalidated.flatMap((call) => call.userIds)).size).toBe(bulk);
		expect(feed.windows).toHaveLength(3);
	});

	it("stays quiet when nothing changed", async () => {
		const { sweep, sessions, authorization } = setup();

		await expect(sweep.sweepOnce()).resolves.toEqual({ inWindow: 0, invalidated: 0 });

		expect(authorization.invalidated).toEqual([]);
		expect(sessions.invalidated).toEqual([]);
	});

	it("forgets stamps that left the window, so its memory never outgrows the window", async () => {
		const { sweep, feed, authorization } = setup();
		feed.stamps = [change("user-1", 0)];
		await sweep.sweepOnce();
		feed.stamps = [];
		await sweep.sweepOnce();
		// The same stamp re-appearing (it cannot, but a clock step could) is treated as unseen: dropping a cache entry again is always safe.
		feed.stamps = [change("user-1", 0)];

		await expect(sweep.sweepOnce()).resolves.toEqual({ inWindow: 1, invalidated: 1 });
		expect(authorization.invalidated).toHaveLength(2);
	});
});
