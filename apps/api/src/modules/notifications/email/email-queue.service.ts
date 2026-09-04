import { Inject, Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

import { MESSAGING_OPTIONS, type ResolvedMessagingOptions } from "@workspace/messaging/nest";
import { EmailSendJobSchema, QUEUE_JOB_OPTIONS, QUEUE_NAMES, type EmailSendJob } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";

/**
 * Enqueues outbound email jobs when BullMQ is enabled.
 */
@Injectable()
export class EmailQueueService {
	public constructor(
		private readonly config: TypedConfigService,
		@InjectQueue(QUEUE_NAMES[0]) private readonly queue: Queue<EmailSendJob>,
	) {}

	public isEnabled(): boolean {
		return this.config.useBullMq;
	}

	public async enqueue(job: EmailSendJob): Promise<string> {
		const parsed = EmailSendJobSchema.parse(job);
		const added = await this.queue.add("send", parsed, QUEUE_JOB_OPTIONS.emailSend);
		return added.id ?? "unknown";
	}
}

/** No-op queue service when `REDIS_URL` is unset. */
@Injectable()
export class DisabledEmailQueueService {
	public isEnabled(): boolean {
		return false;
	}

	public enqueue(): Promise<string> {
		return Promise.reject(new Error("Email queue is disabled — set REDIS_URL to enable BullMQ"));
	}
}

@Injectable()
export class EmailQueueHealthAdapter {
	public constructor(
		@Inject(MESSAGING_OPTIONS) private readonly options: ResolvedMessagingOptions,
		@InjectQueue(QUEUE_NAMES[0]) private readonly emailQueue: Queue,
	) {}

	public async isHealthy(): Promise<boolean> {
		if (this.options.redisUrl === undefined) {
			return true;
		}
		try {
			await this.emailQueue.getJobCounts();
			return true;
		} catch {
			return false;
		}
	}
}
