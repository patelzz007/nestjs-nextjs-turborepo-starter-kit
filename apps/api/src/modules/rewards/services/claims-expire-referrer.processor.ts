import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Job } from "bullmq";

import { QUEUE_NAMES, RewardsMaintenanceJobSchema } from "@workspace/shared";

import { MerchantRewardService } from "./merchant-reward.service";
import { RewardsQueueScheduler } from "./rewards-queue.processors";

@Processor(QUEUE_NAMES[3])
@Injectable()
export class ClaimsExpireReferrerProcessor extends WorkerHost {
	public constructor(
		rewardsQueueScheduler: RewardsQueueScheduler,
		private readonly merchantRewardService: MerchantRewardService,
	) {
		super();
		void rewardsQueueScheduler;
	}

	public async process(job: Job): Promise<void> {
		RewardsMaintenanceJobSchema.parse(job.data);
		await this.merchantRewardService.expireReferrerClaims();
	}
}
