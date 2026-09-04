import { Processor, WorkerHost, InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Job, Queue, hasLegacyRepeatableKeyShape } from "bullmq";

import { QUEUE_NAMES, RewardsMaintenanceJobSchema } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { MerchantRewardService } from "./merchant-reward.service";

/** Repeatable job interval for rewards maintenance (10 minutes). */
const REWARDS_JOB_INTERVAL_MS = 10 * 60 * 1000;

const AUTO_PUBLISH_SCHEDULER_ID = "rewards-auto-publish";
const EXPIRE_PENDING_SCHEDULER_ID = "claims-expire-pending";
const EXPIRE_REFERRER_SCHEDULER_ID = "claims-expire-referrer";

/** BullMQ job-scheduler iterations use ids like `repeat:<schedulerId>:<millis>`. */
function isSchedulerIterationJob(job: Job): boolean {
	const jobId = job.id ?? "";
	return jobId.startsWith("repeat:");
}

/** Registers BullMQ job schedulers for rewards maintenance. */
@Injectable()
export class RewardsQueueScheduler implements OnModuleInit {
	private readonly logger: Logger = new Logger(RewardsQueueScheduler.name);

	public constructor(
		private readonly config: TypedConfigService,
		@InjectQueue(QUEUE_NAMES[1]) private readonly autoPublishQueue: Queue,
		@InjectQueue(QUEUE_NAMES[2]) private readonly expirePendingQueue: Queue,
		@InjectQueue(QUEUE_NAMES[3]) private readonly expireReferrerQueue: Queue,
	) {}

	public async onModuleInit(): Promise<void> {
		if (!this.config.useBullMq) {
			return;
		}

		await this.removeLegacyRepeatableJobs(this.autoPublishQueue, QUEUE_NAMES[1]);
		await this.removeLegacyRepeatableJobs(this.expirePendingQueue, QUEUE_NAMES[2]);
		await this.removeLegacyRepeatableJobs(this.expireReferrerQueue, QUEUE_NAMES[3]);

		const payload = RewardsMaintenanceJobSchema.parse({});
		await this.autoPublishQueue.upsertJobScheduler(AUTO_PUBLISH_SCHEDULER_ID, { every: REWARDS_JOB_INTERVAL_MS }, { name: "auto-publish", data: payload });
		await this.expirePendingQueue.upsertJobScheduler(EXPIRE_PENDING_SCHEDULER_ID, { every: REWARDS_JOB_INTERVAL_MS }, { name: "expire-pending", data: payload });
		await this.expireReferrerQueue.upsertJobScheduler(EXPIRE_REFERRER_SCHEDULER_ID, { every: REWARDS_JOB_INTERVAL_MS }, { name: "expire-referrer", data: payload });
		this.logger.log("Registered BullMQ rewards maintenance schedulers");
	}

	private async removeLegacyRepeatableJobs(queue: Queue, queueName: string): Promise<void> {
		const schedulers = await queue.getJobSchedulers(0, -1, true);
		for (const scheduler of schedulers) {
			if (!hasLegacyRepeatableKeyShape(scheduler.key)) {
				continue;
			}

			try {
				await queue.removeJobScheduler(scheduler.key);
				this.logger.warn(`Removed legacy repeatable scheduler ${scheduler.key} from ${queueName}`);
			} catch (error) {
				this.logger.warn(`Could not remove legacy repeatable scheduler ${scheduler.key} from ${queueName}: ${String(error)}`);
			}
		}

		const jobs = await queue.getJobs(["delayed", "waiting"], 0, 500);
		for (const job of jobs) {
			if (isSchedulerIterationJob(job)) {
				continue;
			}

			const isLegacyRepeat = job.repeatJobKey !== undefined && hasLegacyRepeatableKeyShape(job.repeatJobKey);
			const isCorruptTimestamp = job.timestamp <= 0;
			if (!isLegacyRepeat && !isCorruptTimestamp) {
				continue;
			}

			try {
				await job.remove();
				this.logger.warn(`Removed stale delayed job ${String(job.id)} from ${queueName}`);
			} catch (error) {
				this.logger.warn(`Could not remove stale job ${String(job.id)} from ${queueName}: ${String(error)}`);
			}
		}
	}
}

@Processor(QUEUE_NAMES[1])
@Injectable()
export class RewardsAutoPublishProcessor extends WorkerHost {
	public constructor(
		rewardsQueueScheduler: RewardsQueueScheduler,
		private readonly merchantRewardService: MerchantRewardService,
	) {
		super();
		void rewardsQueueScheduler;
	}

	public async process(job: Job): Promise<void> {
		RewardsMaintenanceJobSchema.parse(job.data);
		await this.merchantRewardService.autoPublishPendingRewards();
	}
}

@Processor(QUEUE_NAMES[2])
@Injectable()
export class ClaimsExpirePendingProcessor extends WorkerHost {
	public constructor(
		rewardsQueueScheduler: RewardsQueueScheduler,
		private readonly merchantRewardService: MerchantRewardService,
	) {
		super();
		void rewardsQueueScheduler;
	}

	public async process(job: Job): Promise<void> {
		RewardsMaintenanceJobSchema.parse(job.data);
		await this.merchantRewardService.expirePendingClaims();
	}
}
