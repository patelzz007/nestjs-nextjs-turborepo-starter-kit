import { describe, expect, it } from "vitest";

import { systemActor } from "../../../../platform/application/actor-context";
import { MigrateLegacyRewardNoticesCommand } from "../commands/migrate-legacy-reward-notices/migrate-legacy-reward-notices.command";
import { MigrateLegacyRewardNoticesHandler } from "../commands/migrate-legacy-reward-notices/migrate-legacy-reward-notices.handler";
import type { LegacyRewardNotice } from "../ports/claims-transactional.ports";
import {
	LEGACY_REWARD_NOTICE_BATCH_SIZE,
	LEGACY_REWARD_NOTICE_MIGRATION_OPERATION,
	LEGACY_REWARD_NOTICE_RETIRED_BY,
	legacyNoticeLink,
	legacyNoticeSurface,
	toLegacyInboxNotice,
} from "../services/legacy-reward-notice-migration";
import { InMemoryClaimsStore, NOW } from "./fakes/claims.fakes";

const ACTOR = systemActor(LEGACY_REWARD_NOTICE_MIGRATION_OPERATION, "cron", null, "Move the earlier reward inbox", null);

function legacy(id: string, overrides: Partial<LegacyRewardNotice> = {}): LegacyRewardNotice {
	return {
		id,
		userId: "user-1",
		type: "referrer_reward_credited",
		title: "You earned a referrer reward!",
		body: "Claim it",
		metadata: {},
		readAt: null,
		createdAt: NOW - 1_000,
		...overrides,
	};
}

describe("legacy notice mapping", () => {
	it("keeps a stored link, else links the reward, else nowhere", () => {
		expect(legacyNoticeLink(legacy("a", { metadata: { href: "/dashboard/referrals", rewardId: "r-1" } }))).toBe("/dashboard/referrals");
		expect(legacyNoticeLink(legacy("b", { metadata: { rewardId: "r-1" } }))).toBe("/dashboard/rewards/r-1");
		expect(legacyNoticeLink(legacy("m", { type: "reward_approved", metadata: { rewardId: "r-1" } }))).toBeNull();
		expect(legacyNoticeLink(legacy("c"))).toBeNull();
	});

	it("puts reward-review notices in the merchant inbox and every other in the customer's", () => {
		expect(legacyNoticeSurface(legacy("a", { type: "reward_approved" }))).toBe("MERCHANT");
		expect(legacyNoticeSurface(legacy("b", { type: "reward_rejected" }))).toBe("MERCHANT");
		expect(legacyNoticeSurface(legacy("c", { type: "reward_auto_published" }))).toBe("MERCHANT");
		expect(legacyNoticeSurface(legacy("d", { type: "signup_referral_redeemed" }))).toBe("CUSTOMER");
	});

	it("carries the words, read state and time over unchanged", () => {
		expect(toLegacyInboxNotice(legacy("a", { readAt: NOW - 10 }))).toEqual({
			legacyId: "a",
			userId: "user-1",
			surface: "CUSTOMER",
			title: "You earned a referrer reward!",
			body: "Claim it",
			link: null,
			readAt: NOW - 10,
			createdAt: NOW - 1_000,
		});
	});
});

describe("MigrateLegacyRewardNoticesHandler", () => {
	it("moves every live row in batches, retiring each in the same transaction, and skips retired rows", async () => {
		const store = new InMemoryClaimsStore();
		for (let index = 0; index <= LEGACY_REWARD_NOTICE_BATCH_SIZE; index += 1) {
			store.legacyNotices.add(legacy(`notice-${String(index).padStart(4, "0")}`, { createdAt: NOW - 10_000 + index }));
		}
		await store.legacyNotices.retire(["notice-0000"], NOW - 1, "someone-earlier");

		const handler = new MigrateLegacyRewardNoticesHandler(store.uow, store.clock);
		await expect(handler.execute(new MigrateLegacyRewardNoticesCommand(ACTOR))).resolves.toEqual({ moved: LEGACY_REWARD_NOTICE_BATCH_SIZE });

		expect(store.legacyInbox.imported).toHaveLength(LEGACY_REWARD_NOTICE_BATCH_SIZE);
		expect(store.legacyInbox.imported.some((notice) => notice.legacyId === "notice-0000")).toBe(false);
		expect([...store.legacyNotices.rows.values()].filter((row) => row.deletedBy === LEGACY_REWARD_NOTICE_RETIRED_BY)).toHaveLength(LEGACY_REWARD_NOTICE_BATCH_SIZE);
		expect(store.uow.committed.every((commit) => commit.operation === LEGACY_REWARD_NOTICE_MIGRATION_OPERATION)).toBe(true);
	});

	it("is a no-op once the table is empty, and a re-run never copies a row twice", async () => {
		const store = new InMemoryClaimsStore();
		store.legacyNotices.add(legacy("only"));
		const handler = new MigrateLegacyRewardNoticesHandler(store.uow, store.clock);

		await expect(handler.execute(new MigrateLegacyRewardNoticesCommand(ACTOR))).resolves.toEqual({ moved: 1 });
		await expect(handler.execute(new MigrateLegacyRewardNoticesCommand(ACTOR))).resolves.toEqual({ moved: 0 });
		expect(store.legacyInbox.imported.map((notice) => notice.legacyId)).toEqual(["only"]);
	});
});
