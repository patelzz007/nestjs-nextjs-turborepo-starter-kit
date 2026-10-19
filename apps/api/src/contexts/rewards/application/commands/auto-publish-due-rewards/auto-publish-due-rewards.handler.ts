import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { DueForAutoPublish, RewardReadPort } from "../../ports/reward-read.port";
import { REWARD_READS, REWARDS_UNIT_OF_WORK } from "../../ports/rewards.tokens";
import type { RewardsScope } from "../../rewards-scope";
import { AutoPublishDueRewardsCommand, type AutoPublishDueRewardsResult } from "./auto-publish-due-rewards.command";

/** Due rewards one read selects; a run pages through the whole backlog in pages of this size. */
export const AUTO_PUBLISH_PAGE_SIZE = 100;

/**
 * Publishes due rewards one transaction each, as the job's system actor (D10). A reward that a
 * reviewer decided (or a merchant resubmitted) after it was selected is re-checked inside its own
 * transaction: it is no longer due, or its compare-and-set matches nothing, and it is skipped.
 */
@CommandHandler(AutoPublishDueRewardsCommand)
export class AutoPublishDueRewardsHandler implements ICommandHandler<AutoPublishDueRewardsCommand, AutoPublishDueRewardsResult> {
	private readonly logger: Logger = new Logger(AutoPublishDueRewardsHandler.name);

	public constructor(
		@Inject(REWARDS_UNIT_OF_WORK) private readonly uow: UnitOfWork<RewardsScope>,
		@Inject(REWARD_READS) private readonly reads: Pick<RewardReadPort, "listDueForAutoPublish">,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: AutoPublishDueRewardsCommand): Promise<AutoPublishDueRewardsResult> {
		const { actor } = command;
		const now = this.clock.now();
		let published = 0;
		let selected = 0;
		let after: DueForAutoPublish | null = null;
		for (;;) {
			const page: readonly DueForAutoPublish[] = await this.reads.listDueForAutoPublish(actor, now, AUTO_PUBLISH_PAGE_SIZE, after);
			selected += page.length;
			for (const { rewardId } of page) {
				published += (await this.publishIfDue(command, rewardId, now)) ? 1 : 0;
			}
			const last: DueForAutoPublish | undefined = page.at(-1);
			if (last === undefined || page.length < AUTO_PUBLISH_PAGE_SIZE) {
				break;
			}
			after = last;
		}
		const result: AutoPublishDueRewardsResult = { published, skipped: selected - published };
		this.logger.log({ event: "rewards.auto_publish.run", ...result });
		return result;
	}

	/** One reward in its own transaction, re-checked there: false when it is no longer due or its compare-and-set lost. */
	private async publishIfDue(command: AutoPublishDueRewardsCommand, rewardId: string, now: EpochMs): Promise<boolean> {
		return this.uow.run(command.actor, async (scope: RewardsScope): Promise<boolean> => {
			const reward = await scope.rewards.findConsumer(rewardId);
			if (!reward?.isDueForAutoPublish(now)) {
				return false;
			}
			reward.autoPublish(now);
			const saved = await scope.rewards.saveIfUnchanged(reward);
			if (saved) {
				scope.events.collectFrom(reward);
			}
			return saved;
		});
	}
}
