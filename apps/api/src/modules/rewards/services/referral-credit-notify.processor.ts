import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Job, Queue } from "bullmq";

import { QUEUE_NAMES, RewardsMaintenanceJobSchema } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { registerMaintenanceScheduler } from "../../../infrastructure/jobs/maintenance-scheduler";
import { runWithSystemRlsContext } from "../../../prisma/rls-context";
import { ReferralCreditNotificationService } from "./referral-credit-notification.service";

/** `rewards.referral-credit-notify` — retries referrer emails the checkout could not deliver right after its commit. */
export const REFERRAL_CREDIT_NOTIFY_QUEUE = QUEUE_NAMES.rewardsReferralCreditNotify;

const REFERRAL_CREDIT_NOTIFY_SCHEDULER_ID = "rewards-referral-credit-notify";

/** How often pending referrer emails are retried (one minute — the email is user-facing, the batch is small). */
const REFERRAL_CREDIT_NOTIFY_INTERVAL_MS = 60_000;

@Injectable()
export class ReferralCreditNotifyScheduler implements OnModuleInit {
	private readonly logger: Logger = new Logger(ReferralCreditNotifyScheduler.name);

	public constructor(
		private readonly config: TypedConfigService,
		@InjectQueue(REFERRAL_CREDIT_NOTIFY_QUEUE) private readonly queue: Queue,
	) {}

	public async onModuleInit(): Promise<void> {
		if (!this.config.useBullMq) {
			return;
		}
		await registerMaintenanceScheduler(
			this.queue,
			{
				queueName: REFERRAL_CREDIT_NOTIFY_QUEUE,
				schedulerId: REFERRAL_CREDIT_NOTIFY_SCHEDULER_ID,
				everyMs: REFERRAL_CREDIT_NOTIFY_INTERVAL_MS,
				jobName: "deliver-pending",
				data: RewardsMaintenanceJobSchema.parse({}),
			},
			this.logger,
		);
	}
}

@Processor(REFERRAL_CREDIT_NOTIFY_QUEUE)
@Injectable()
export class ReferralCreditNotifyProcessor extends WorkerHost {
	private readonly logger: Logger = new Logger(ReferralCreditNotifyProcessor.name);

	public constructor(
		_scheduler: ReferralCreditNotifyScheduler,
		private readonly notifications: ReferralCreditNotificationService,
	) {
		super();
	}

	public async process(job: Job): Promise<void> {
		await runWithSystemRlsContext("queue.rewards.referral_credit_notify", async (): Promise<void> => this.handle(job));
	}

	private async handle(job: Job): Promise<void> {
		RewardsMaintenanceJobSchema.parse(job.data);
		const { delivered, failed } = await this.notifications.deliverPending();
		if (delivered > 0 || failed > 0) {
			this.logger.log({ event: "rewards.referral_credit_notify", delivered, failed });
		}
	}
}
