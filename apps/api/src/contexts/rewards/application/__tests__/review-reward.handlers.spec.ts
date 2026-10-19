import { epochMs, type EpochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import { InMemoryUnitOfWork } from "../../../../platform/application/__tests__/fakes/in-memory-unit-of-work";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { AuthenticationError, ConflictError } from "../../../../platform/application/errors/app-error";
import { RewardNotFoundError, RewardNotPendingReviewError, RewardRejectionReasonBlankError } from "../../domain/errors/reward.errors";
import { AUTO_PUBLISH_WINDOW_MS } from "../../domain/value-objects/reward-status.value-object";
import { NOW, ORGANIZATION_ID, REVIEWER_ID, REWARD_ID, referrerRow, rewardState } from "../../domain/__tests__/reward-state.fixture";
import { ApproveRewardCommand } from "../commands/approve-reward/approve-reward.command";
import { ApproveRewardHandler } from "../commands/approve-reward/approve-reward.handler";
import { AutoPublishDueRewardsCommand } from "../commands/auto-publish-due-rewards/auto-publish-due-rewards.command";
import { AUTO_PUBLISH_PAGE_SIZE, AutoPublishDueRewardsHandler } from "../commands/auto-publish-due-rewards/auto-publish-due-rewards.handler";
import { RejectRewardCommand } from "../commands/reject-reward/reject-reward.command";
import { RejectRewardHandler } from "../commands/reject-reward/reject-reward.handler";
import { RecordRewardReviewAuditHandler } from "../event-handlers/in-transaction/record-reward-review-audit.in-transaction-handler";
import type { DueForAutoPublish, RewardReadPort } from "../ports/reward-read.port";
import type { RewardsScope } from "../rewards-scope";
import { fakeRewardsScope } from "./fakes/rewards-scope.fakes";
import { apiKeyActor, jobActor, userActor } from "./reward-test-actors";

/** A read port answering only the auto-publish selection; every other read is unused here. */
class DueRewardsReads implements Pick<RewardReadPort, "listDueForAutoPublish"> {
	public readonly asked: { readonly actor: ActorContext; readonly now: EpochMs }[] = [];
	/** Every page's size and cursor, in order. */
	public readonly pages: { readonly limit: number; readonly after: DueForAutoPublish | null }[] = [];

	/** `due` in keyset order, all due at `NOW`. */
	public constructor(private readonly due: readonly string[]) {}

	public listDueForAutoPublish(actor: ActorContext, now: EpochMs, limit: number, after: DueForAutoPublish | null): Promise<readonly DueForAutoPublish[]> {
		this.asked.push({ actor, now });
		this.pages.push({ limit, after });
		const start = after === null ? 0 : this.due.indexOf(after.rewardId) + 1;
		return Promise.resolve(this.due.slice(start, start + limit).map((rewardId): DueForAutoPublish => ({ rewardId, autoPublishAt: NOW })));
	}
}

function setup(): { readonly scope: ReturnType<typeof fakeRewardsScope>; readonly uow: InMemoryUnitOfWork<RewardsScope>; readonly clock: FixedClock } {
	const scope = fakeRewardsScope();
	return { scope, uow: new InMemoryUnitOfWork<RewardsScope>(scope), clock: new FixedClock(NOW) };
}

describe("ApproveRewardHandler (D01)", () => {
	it("publishes as the reviewer inside the route's RLS-bypass operation and collects RewardApproved", async () => {
		const { scope, uow, clock } = setup();
		scope.rewards.seed(rewardState("PENDING_REVIEW", { referrer: referrerRow("PENDING_REVIEW") }));
		const actor = userActor(REVIEWER_ID);

		const response = await new ApproveRewardHandler(uow, clock).execute(new ApproveRewardCommand(actor, { rewardId: REWARD_ID }));

		expect(response.status).toBe("PUBLISHED");
		expect(uow.committed).toEqual([{ actor, operation: "route.rls_bypass" }]);
		expect(scope.rewards.rows.get(REWARD_ID)?.reviewedByUserId).toBe(REVIEWER_ID);
		expect(scope.rewards.rows.get(REWARD_ID)?.referrer?.status).toBe("PUBLISHED");
		expect(scope.events.recordedNames()).toEqual(["rewards.RewardApproved"]);
	});

	it("refuses a reward that is no longer pending (the loser of approve vs reject) and rolls back", async () => {
		const { scope, uow, clock } = setup();
		scope.rewards.seed(rewardState("DRAFT"));
		await expect(new ApproveRewardHandler(uow, clock).execute(new ApproveRewardCommand(userActor(REVIEWER_ID), { rewardId: REWARD_ID }))).rejects.toThrow(
			RewardNotPendingReviewError,
		);
		expect(uow.rolledBack).toHaveLength(1);
		expect(scope.events.recorded()).toEqual([]);
	});

	it("propagates a lost compare-and-set without saving", async () => {
		const { scope, uow, clock } = setup();
		scope.rewards.seed(rewardState("PENDING_REVIEW")).forceConflictOnNextSave();
		await expect(new ApproveRewardHandler(uow, clock).execute(new ApproveRewardCommand(userActor(REVIEWER_ID), { rewardId: REWARD_ID }))).rejects.toThrow(ConflictError);
		expect(scope.rewards.rows.get(REWARD_ID)?.status).toBe("PENDING_REVIEW");
	});

	it("answers 404 for a missing reward and refuses a machine caller before opening a transaction", async () => {
		const { uow, clock } = setup();
		await expect(new ApproveRewardHandler(uow, clock).execute(new ApproveRewardCommand(userActor(REVIEWER_ID), { rewardId: REWARD_ID }))).rejects.toThrow(RewardNotFoundError);
		await expect(new ApproveRewardHandler(uow, clock).execute(new ApproveRewardCommand(apiKeyActor(ORGANIZATION_ID), { rewardId: REWARD_ID }))).rejects.toThrow(
			AuthenticationError,
		);
		expect(uow.committed).toEqual([]);
	});
});

describe("RejectRewardHandler (D01, Q74)", () => {
	it("returns the reward to draft with the reviewer's reason", async () => {
		const { scope, uow, clock } = setup();
		scope.rewards.seed(rewardState("PENDING_REVIEW"));
		const response = await new RejectRewardHandler(uow, clock).execute(new RejectRewardCommand(userActor(REVIEWER_ID), { rewardId: REWARD_ID, reason: "Fix the terms" }));
		expect(response.status).toBe("DRAFT");
		expect(scope.rewards.rows.get(REWARD_ID)?.rejectionReason).toBe("Fix the terms");
		const [event] = scope.events.recorded();
		expect(event).toMatchObject({ reason: "Fix the terms", reviewerUserId: REVIEWER_ID });
	});

	it("refuses a blank reason with its own error and saves nothing", async () => {
		const { scope, uow, clock } = setup();
		scope.rewards.seed(rewardState("PENDING_REVIEW"));
		await expect(new RejectRewardHandler(uow, clock).execute(new RejectRewardCommand(userActor(REVIEWER_ID), { rewardId: REWARD_ID, reason: "   " }))).rejects.toThrow(
			RewardRejectionReasonBlankError,
		);
		expect(scope.rewards.saved).toEqual([]);
	});
});

describe("AutoPublishDueRewardsHandler (D10)", () => {
	it("publishes each due reward in its own unit of work, as the job's own system actor", async () => {
		const { scope, uow, clock } = setup();
		scope.rewards.seed(rewardState("PENDING_REVIEW", { autoPublishAt: epochMs(NOW - 1) }));
		const reads = new DueRewardsReads([REWARD_ID]);
		const actor = jobActor();

		const result = await new AutoPublishDueRewardsHandler(uow, reads, clock).execute(new AutoPublishDueRewardsCommand(actor));

		expect(result).toEqual({ published: 1, skipped: 0 });
		expect(reads.asked).toEqual([{ actor, now: NOW }]);
		expect(uow.committed).toEqual([{ actor, operation: null }]);
		expect(scope.events.recordedNames()).toEqual(["rewards.RewardAutoPublished"]);
	});

	it("skips a reward rejected and resubmitted after it was selected: its new window has not elapsed", async () => {
		const { scope, uow, clock } = setup();
		scope.rewards.seed(rewardState("PENDING_REVIEW", { autoPublishAt: epochMs(NOW + AUTO_PUBLISH_WINDOW_MS) }));
		const result = await new AutoPublishDueRewardsHandler(uow, new DueRewardsReads([REWARD_ID]), clock).execute(new AutoPublishDueRewardsCommand(jobActor()));
		expect(result).toEqual({ published: 0, skipped: 1 });
		expect(scope.rewards.rows.get(REWARD_ID)?.status).toBe("PENDING_REVIEW");
		expect(scope.events.recorded()).toEqual([]);
	});

	it("pages through a backlog larger than one read, continuing strictly after the last reward of each page", async () => {
		const { scope, uow, clock } = setup();
		scope.rewards.seed(rewardState("PENDING_REVIEW", { autoPublishAt: NOW }));
		const backlog = [...Array.from({ length: AUTO_PUBLISH_PAGE_SIZE }, (_unused, index) => `gone-${String(index).padStart(3, "0")}`), REWARD_ID];
		const reads = new DueRewardsReads(backlog);

		await expect(new AutoPublishDueRewardsHandler(uow, reads, clock).execute(new AutoPublishDueRewardsCommand(jobActor()))).resolves.toEqual({
			published: 1,
			skipped: AUTO_PUBLISH_PAGE_SIZE,
		});
		expect(reads.pages).toEqual([
			{ limit: AUTO_PUBLISH_PAGE_SIZE, after: null },
			{ limit: AUTO_PUBLISH_PAGE_SIZE, after: { rewardId: `gone-${String(AUTO_PUBLISH_PAGE_SIZE - 1).padStart(3, "0")}`, autoPublishAt: NOW } },
		]);
		expect(scope.rewards.rows.get(REWARD_ID)?.status).toBe("PUBLISHED");
	});

	it("skips a reward a reviewer decided first, and one whose compare-and-set lost", async () => {
		const { scope, uow, clock } = setup();
		scope.rewards.seed(rewardState("DRAFT"));
		const decided = await new AutoPublishDueRewardsHandler(uow, new DueRewardsReads([REWARD_ID, "missing-reward"]), clock).execute(
			new AutoPublishDueRewardsCommand(jobActor()),
		);
		expect(decided).toEqual({ published: 0, skipped: 2 });

		const raced = setup();
		raced.scope.rewards.seed(rewardState("PENDING_REVIEW", { autoPublishAt: NOW })).forceConflictOnNextSave();
		const result = await new AutoPublishDueRewardsHandler(raced.uow, new DueRewardsReads([REWARD_ID]), raced.clock).execute(new AutoPublishDueRewardsCommand(jobActor()));
		expect(result).toEqual({ published: 0, skipped: 1 });
		expect(raced.scope.events.recorded()).toEqual([]);
	});
});

describe("RecordRewardReviewAuditHandler", () => {
	it("writes one reward audit row per review decision, with the reviewer and the reason", async () => {
		const { scope, uow, clock } = setup();
		scope.rewards.seed(rewardState("PENDING_REVIEW"));
		await new RejectRewardHandler(uow, clock).execute(new RejectRewardCommand(userActor(REVIEWER_ID), { rewardId: REWARD_ID, reason: "Fix the terms" }));
		const handler = new RecordRewardReviewAuditHandler();
		const [rejected] = scope.events.recorded();
		expect(rejected !== undefined && handler.accepts(rejected)).toBe(true);
		if (rejected !== undefined && handler.accepts(rejected)) {
			await handler.handle(rejected, scope);
		}
		expect(scope.audit.entries).toEqual([
			{ organizationId: ORGANIZATION_ID, actorUserId: REVIEWER_ID, action: "reward.rejected", metadata: { rewardId: REWARD_ID, reason: "Fix the terms" } },
		]);
	});

	it("records auto-publish without an actor and ignores other events", async () => {
		const { scope, uow, clock } = setup();
		scope.rewards.seed(rewardState("PENDING_REVIEW", { autoPublishAt: NOW, referrer: null }));
		await new AutoPublishDueRewardsHandler(uow, new DueRewardsReads([REWARD_ID]), clock).execute(new AutoPublishDueRewardsCommand(jobActor()));
		const handler = new RecordRewardReviewAuditHandler();
		for (const event of scope.events.recorded()) {
			if (handler.accepts(event)) {
				await handler.handle(event, scope);
			}
		}
		expect(scope.audit.entries).toEqual([{ organizationId: ORGANIZATION_ID, actorUserId: null, action: "reward.auto_published", metadata: { rewardId: REWARD_ID } }]);
	});
});
