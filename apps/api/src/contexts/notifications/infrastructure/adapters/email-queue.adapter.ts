import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { EmailSendJobSchema, QUEUE_JOB_OPTIONS, QUEUE_NAMES, type EmailSendJob } from "@workspace/shared";
import { Queue } from "bullmq";

import { TypedConfigService } from "../../../../config/typed-config.service";

/** Enqueues outbound email jobs when BullMQ is enabled. */
@Injectable()
export class EmailQueueService {
	public constructor(
		private readonly config: TypedConfigService,
		@InjectQueue(QUEUE_NAMES.emailSend) private readonly queue: Queue<EmailSendJob>,
	) {}

	public isEnabled(): boolean {
		return this.config.useBullMq;
	}

	public async enqueue(job: EmailSendJob): Promise<string> {
		const parsed = EmailSendJobSchema.parse(job);
		// jobId = email log id: handing the same request off twice (nudge + sweep, or a relay retry) is deduplicated by BullMQ.
		const added = await this.queue.add("send", parsed, { ...QUEUE_JOB_OPTIONS.emailSend, jobId: parsed.emailLogId });
		return added.id ?? parsed.emailLogId;
	}
}

/** Queue service when `REDIS_URL` is unset: never enabled. */
@Injectable()
export class DisabledEmailQueueService {
	public isEnabled(): boolean {
		return false;
	}

	public enqueue(): Promise<string> {
		return Promise.reject(new Error("Email queue is disabled — set REDIS_URL to enable BullMQ"));
	}
}
