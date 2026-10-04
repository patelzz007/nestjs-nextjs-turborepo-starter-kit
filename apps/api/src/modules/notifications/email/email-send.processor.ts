import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Job } from "bullmq";

import { EmailSendJobSchema, QUEUE_NAMES, type EmailSendJob } from "@workspace/shared";

import { buildEmailTemplateFromJobData } from "./email-template.factory";
import { EmailSenderService } from "./email-sender.service";
import { runWithSystemRlsContext } from "../../../prisma/rls-context";

@Processor(QUEUE_NAMES.emailSend)
@Injectable()
export class EmailSendProcessor extends WorkerHost {
	private readonly logger: Logger = new Logger(EmailSendProcessor.name);

	public constructor(private readonly emailSender: EmailSenderService) {
		super();
	}

	public async process(job: Job<EmailSendJob>): Promise<void> {
		await runWithSystemRlsContext("queue.email.send", async (): Promise<void> => this.handle(job));
	}

	/**
	 * One provider call per execution; BullMQ owns the retries (`emailSend`
	 * preset). `deliverQueued` throws `UnrecoverableError` when retrying cannot
	 * help, which stops BullMQ immediately.
	 */
	private async handle(job: Job<EmailSendJob>): Promise<void> {
		const parsed = EmailSendJobSchema.parse(job.data);
		const template = buildEmailTemplateFromJobData(parsed.templateKey, parsed.props);
		try {
			await this.emailSender.deliverQueued(parsed.emailLogId, template, { attemptNumber: job.attemptsMade + 1, maxAttempts: job.opts.attempts ?? 1 });
		} catch (error) {
			this.logger.warn(`Email job ${job.id ?? parsed.emailLogId} attempt ${String(job.attemptsMade + 1)} failed`);
			throw error;
		}
	}
}
