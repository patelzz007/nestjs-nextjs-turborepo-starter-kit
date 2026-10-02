import { Processor, WorkerHost, InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Job, Queue } from "bullmq";

import { QUEUE_NAMES, RewardsMaintenanceJobSchema } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { MerchantRewardService } from "./merchant-reward.service";
import { runWithSystemRlsContext } from "../../../prisma/rls-context";
import { registerMaintenanceScheduler } from "../../../infrastructure/jobs/maintenance-scheduler";

/** Repeatable job interval for rewards maintenance (10 minutes). */
const REWARDS_JOB_INTERVAL_MS = 10 * 60 * 1000;

const AUTO_PUBLISH_SCHEDULER_ID = "rewards-auto-publish";
const EXPIRE_PENDING_SCHEDULER_ID = "claims-expire-pending";
const EXPIRE_REFERRER_SCHEDULER_ID = "claims-expire-referrer";

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

		const data = RewardsMaintenanceJobSchema.parse({});
		const everyMs = REWARDS_JOB_INTERVAL_MS;
		await registerMaintenanceScheduler(
			this.autoPublishQueue,
			{ queueName: QUEUE_NAMES[1], schedulerId: AUTO_PUBLISH_SCHEDULER_ID, everyMs, jobName: "auto-publish", data },
			this.logger,
		);
		await registerMaintenanceScheduler(
			this.expirePendingQueue,
			{ queueName: QUEUE_NAMES[2], schedulerId: EXPIRE_PENDING_SCHEDULER_ID, everyMs, jobName: "expire-pending", data },
			this.logger,
		);
		await registerMaintenanceScheduler(
			this.expireReferrerQueue,
			{ queueName: QUEUE_NAMES[3], schedulerId: EXPIRE_REFERRER_SCHEDULER_ID, everyMs, jobName: "expire-referrer", data },
			this.logger,
		);
		this.logger.log("Registered BullMQ rewards maintenance schedulers");
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
