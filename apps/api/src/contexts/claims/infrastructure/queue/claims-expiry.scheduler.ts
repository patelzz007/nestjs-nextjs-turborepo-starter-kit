import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, type OnModuleInit } from "@nestjs/common";
import { QUEUE_NAMES, RewardsMaintenanceJobSchema } from "@workspace/shared";
import type { Queue } from "bullmq";

import { TypedConfigService } from "../../../../config/typed-config.service";
import { MaintenanceSchedulerRegistry } from "../../../../platform/infrastructure/jobs/maintenance-scheduler.registry";

const MS_PER_MINUTE = 60_000;
/** Overdue claims are expired every 10 minutes (a claim is valid for days). */
const CLAIM_EXPIRY_INTERVAL_MS = 10 * MS_PER_MINUTE;
/** Byte-stable scheduler ids: the legacy rewards jobs registered the same ones, so a deploy replaces them. */
const EXPIRE_PENDING_SCHEDULER_ID = "claims-expire-pending";
const EXPIRE_REFERRER_SCHEDULER_ID = "claims-expire-referrer";
/** Owed referrer-credit emails are swept every minute (the email is user-facing; the normal path requests it right after the checkout). */
const REFERRER_CREDIT_EMAILS_INTERVAL_MS = MS_PER_MINUTE;
/** Byte-stable: the legacy rewards job registered the same id. */
const REFERRER_CREDIT_EMAILS_SCHEDULER_ID = "rewards-referral-credit-notify";

/** Registers the repeatable claim-expiry jobs and the referrer-credit email sweeper (only when BullMQ is in use). */
@Injectable()
export class ClaimsExpiryScheduler implements OnModuleInit {
	public constructor(
		private readonly schedulers: MaintenanceSchedulerRegistry,
		private readonly config: TypedConfigService,
		@InjectQueue(QUEUE_NAMES.claimsExpirePending) private readonly expirePendingQueue: Queue,
		@InjectQueue(QUEUE_NAMES.claimsExpireReferrer) private readonly expireReferrerQueue: Queue,
		@InjectQueue(QUEUE_NAMES.rewardsReferralCreditNotify) private readonly referrerCreditEmailsQueue: Queue,
	) {}

	public onModuleInit(): void {
		if (!this.config.useBullMq) {
			return;
		}
		const data = RewardsMaintenanceJobSchema.parse({});
		this.schedulers.add(this.expirePendingQueue, {
			queueName: QUEUE_NAMES.claimsExpirePending,
			schedulerId: EXPIRE_PENDING_SCHEDULER_ID,
			everyMs: CLAIM_EXPIRY_INTERVAL_MS,
			jobName: "expire-pending",
			data,
		});
		this.schedulers.add(this.expireReferrerQueue, {
			queueName: QUEUE_NAMES.claimsExpireReferrer,
			schedulerId: EXPIRE_REFERRER_SCHEDULER_ID,
			everyMs: CLAIM_EXPIRY_INTERVAL_MS,
			jobName: "expire-referrer",
			data,
		});
		this.schedulers.add(this.referrerCreditEmailsQueue, {
			queueName: QUEUE_NAMES.rewardsReferralCreditNotify,
			schedulerId: REFERRER_CREDIT_EMAILS_SCHEDULER_ID,
			everyMs: REFERRER_CREDIT_EMAILS_INTERVAL_MS,
			jobName: "deliver-pending",
			data,
		});
	}
}
