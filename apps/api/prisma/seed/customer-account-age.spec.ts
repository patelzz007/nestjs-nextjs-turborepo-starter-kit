import { DAY_MS } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { accountTimeline } from "./customer-account-age";

const FIRST_ACTIVITY = Date.UTC(2025, 9, 20, 10);

describe("accountTimeline", () => {
	it("signs the account up days before its first activity and verifies it shortly after signing up", () => {
		for (const userId of ["alice", "bob", "user-01", "user-17"]) {
			const timeline = accountTimeline(42, userId, FIRST_ACTIVITY);
			expect(timeline.createdAt).toBeLessThan(FIRST_ACTIVITY - DAY_MS);
			expect(timeline.createdAt).toBeGreaterThan(FIRST_ACTIVITY - 23 * DAY_MS);
			expect(timeline.verifiedAt).toBeGreaterThan(timeline.createdAt);
			expect(timeline.verifiedAt).toBeLessThan(FIRST_ACTIVITY);
		}
	});

	it("is deterministic per seed and user, and varies between users", () => {
		expect(accountTimeline(42, "alice", FIRST_ACTIVITY)).toEqual(accountTimeline(42, "alice", FIRST_ACTIVITY));
		expect(accountTimeline(42, "alice", FIRST_ACTIVITY)).not.toEqual(accountTimeline(42, "bob", FIRST_ACTIVITY));
	});
});
