import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Job } from "bullmq";

import { EmailSendJobSchema, QUEUE_NAMES, type EmailSendJob } from "@workspace/shared";

import { buildEmailTemplateFromJobData } from "./email-template.factory";
import { EmailSenderService } from "./email-sender.service";
import { runWithSystemRlsContext } from "../../../prisma/rls-context";

@Processor(QUEUE_NAMES[0])
@Injectable()
export class EmailSendProcessor extends WorkerHost {
	private readonly logger: Logger = new Logger(EmailSendProcessor.name);

	public constructor(private readonly emailSender: EmailSenderService) {
		super();
	}

	public async process(job: Job<EmailSendJob>): Promise<void> {
		await runWithSystemRlsContext("queue.job", async (): Promise<void> => this.handle(job));
	}

	private async handle(job: Job<EmailSendJob>): Promise<void> {
		const parsed = EmailSendJobSchema.parse(job.data);
		const template = buildEmailTemplateFromJobData(parsed.templateKey, parsed.props);
		const result = await this.emailSender.send(template, { skipQueue: true });
		if (!result.ok) {
			this.logger.warn(`Email job ${job.id ?? "unknown"} failed: ${result.reason}`);
			throw new Error(result.detail ?? result.reason);
		}
	}
}
