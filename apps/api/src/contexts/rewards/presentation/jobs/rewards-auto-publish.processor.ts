import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import type { Job } from "bullmq";
import { QUEUE_NAMES, RewardsMaintenanceJobSchema } from "@workspace/shared";

import { systemActor } from "../../../../platform/application/actor-context";
import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { AutoPublishDueRewardsCommand, type AutoPublishDueRewardsResult } from "../../application/commands/auto-publish-due-rewards/auto-publish-due-rewards.command";

/** The allowlisted system operation the auto-publish job runs as (byte-stable; RLS and audit rows name it). */
const AUTO_PUBLISH_OPERATION = "queue.rewards.auto_publish";

/** `rewards.auto-publish` → AutoPublishDueRewards, audited by the dispatcher; a failure rethrows so BullMQ retries. */
@Processor(QUEUE_NAMES.rewardsAutoPublish)
@Injectable()
export class RewardsAutoPublishProcessor extends WorkerHost {
	public constructor(private readonly commands: SystemCommandDispatcher) {
		super();
	}

	public async process(job: Pick<Job, "data">): Promise<AutoPublishDueRewardsResult> {
		RewardsMaintenanceJobSchema.parse(job.data);
		const actor = systemActor(AUTO_PUBLISH_OPERATION, "job", null, "Publish rewards whose review window has elapsed", null);
		return this.commands.dispatch(new AutoPublishDueRewardsCommand(actor), { kind: "job", name: QUEUE_NAMES.rewardsAutoPublish });
	}
}
