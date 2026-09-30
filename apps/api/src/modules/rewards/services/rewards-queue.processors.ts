import { Processor, WorkerHost, InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Job, Queue, hasLegacyRepeatableKeyShape } from "bullmq";

import { QUEUE_NAMES, RewardsMaintenanceJobSchema } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { MerchantRewardService } from "./merchant-reward.service";
import { runWithSystemRlsContext } from "../../../prisma/rls-context";

/** Repeatable job interval for rewards maintenance (10 minutes). */
const REWARDS_JOB_INTERVAL_MS = 10 * 60 * 1000;

const AUTO_PUBLISH_SCHEDULER_ID = "rewards-auto-publish";
const EXPIRE_PENDING_SCHEDULER_ID = "claims-expire-pending";
const EXPIRE_REFERRER_SCHEDULER_ID = "claims-expire-referrer";

/** BullMQ job-scheduler iterations use ids like `repeat:<schedulerId>:<millis>`. */
export function isSchedulerIterationFor(jobId: string | undefined, schedulerId: string): boolean {
	if (!jobId?.startsWith("repeat:")) {
		return false;
	}
	return jobId.startsWith(`repeat:${schedulerId}:`);
}

export function isSchedulerIterationJob(jobOrId: Job | string | undefined): boolean {
	if (jobOrId === undefined) {
		return false;
	}
	const jobId = typeof jobOrId === "string" ? jobOrId : (jobOrId.id ?? "");
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

		await this.removeLegacyRepeatableJobs(this.autoPublishQueue, QUEUE_NAMES[1], AUTO_PUBLISH_SCHEDULER_ID);
		await this.removeLegacyRepeatableJobs(this.expirePendingQueue, QUEUE_NAMES[2], EXPIRE_PENDING_SCHEDULER_ID);
		await this.removeLegacyRepeatableJobs(this.expireReferrerQueue, QUEUE_NAMES[3], EXPIRE_REFERRER_SCHEDULER_ID);

		const payload = RewardsMaintenanceJobSchema.parse({});
		await this.autoPublishQueue.upsertJobScheduler(AUTO_PUBLISH_SCHEDULER_ID, { every: REWARDS_JOB_INTERVAL_MS }, { name: "auto-publish", data: payload });
		await this.expirePendingQueue.upsertJobScheduler(EXPIRE_PENDING_SCHEDULER_ID, { every: REWARDS_JOB_INTERVAL_MS }, { name: "expire-pending", data: payload });
		await this.expireReferrerQueue.upsertJobScheduler(EXPIRE_REFERRER_SCHEDULER_ID, { every: REWARDS_JOB_INTERVAL_MS }, { name: "expire-referrer", data: payload });
		this.logger.log("Registered BullMQ rewards maintenance schedulers");
	}

	private async removeLegacyRepeatableJobs(queue: Queue, queueName: string, schedulerId: string): Promise<void> {
		const schedulers = await queue.getJobSchedulers(0, -1, true);
		for (const scheduler of schedulers) {
			const schedulerKey = scheduler.key;
			const isThisScheduler = schedulerKey === `repeat:${schedulerId}` || isSchedulerIterationFor(schedulerKey, schedulerId);
			if (!hasLegacyRepeatableKeyShape(schedulerKey) && !isThisScheduler) {
				continue;
			}

			try {
				await queue.removeJobScheduler(schedulerKey);
				this.logger.log(`Removed stale scheduler ${schedulerKey} from ${queueName}`);
			} catch (error) {
				this.logger.warn(`Could not remove stale scheduler ${schedulerKey} from ${queueName}: ${String(error)}`);
			}
		}

		const jobs = await queue.getJobs(["delayed", "waiting", "active", "failed"], 0, 500);
		for (const job of jobs) {
			const repeatJobKey = job.repeatJobKey ?? "";
			const jobId = job.id ?? "";
			const isRepeatIteration = isSchedulerIterationJob(jobId) || isSchedulerIterationJob(repeatJobKey);
			if (isRepeatIteration && (isSchedulerIterationFor(jobId, schedulerId) || isSchedulerIterationFor(repeatJobKey, schedulerId))) {
				const staleKey = repeatJobKey || jobId || "unknown";
				try {
					if (staleKey.startsWith("repeat:")) {
						await queue.removeJobScheduler(staleKey);
					}
					this.logger.log(`Removed stale scheduler iteration ${staleKey} from ${queueName}`);
				} catch (error) {
					this.logger.warn(`Could not remove stale scheduler iteration ${staleKey} from ${queueName}: ${String(error)}`);
				}
				continue;
			}

			if (isRepeatIteration) {
				continue;
			}

			const isLegacyRepeat = repeatJobKey !== "" && hasLegacyRepeatableKeyShape(repeatJobKey);
			const isCorruptTimestamp = job.timestamp <= 0;
			if (!isLegacyRepeat && !isCorruptTimestamp) {
				continue;
			}

			try {
				await job.remove();
				this.logger.log(`Removed stale delayed job ${String(job.id)} from ${queueName}`);
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
		await this.merchantRewardService.autoPublishPendingRewards();
	}
}

@Processor(QUEUE_NAMES[2])
@Injectable()
export class ClaimsExpirePendingProcessor extends WorkerHost {
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
		await this.merchantRewardService.expirePendingClaims();
	}
}
