import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Job } from "bullmq";

import { QUEUE_NAMES, RewardsMaintenanceJobSchema } from "@workspace/shared";

import { MerchantRewardService } from "./merchant-reward.service";
import { RewardsQueueScheduler } from "./rewards-queue.processors";
import { runWithSystemRlsContext } from "../../../prisma/rls-context";

@Processor(QUEUE_NAMES[3])
@Injectable()
export class ClaimsExpireReferrerProcessor extends WorkerHost {
	public constructor(
		_rewardsQueueScheduler: RewardsQueueScheduler,
		private readonly merchantRewardService: MerchantRewardService,
	) {
		super();
	}

	public async process(job: Job): Promise<void> {
		await runWithSystemRlsContext("queue.job", async (): Promise<void> => this.handle(job));
	}

	private async handle(job: Job): Promise<void> {
		RewardsMaintenanceJobSchema.parse(job.data);
		await this.merchantRewardService.expireReferrerClaims();
	}
}
