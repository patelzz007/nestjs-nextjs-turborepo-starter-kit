import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { EmailSendJobSchema, QUEUE_NAMES, type EmailSendJob } from "@workspace/shared";
import { Job, UnrecoverableError } from "bullmq";

import { systemActor } from "../../../../platform/application/actor-context";
import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { DeliverEmailCommand, type DeliverEmailResult } from "../../application/commands/deliver-email/deliver-email.command";
import { EmailDeliveryAbandonedError, EmailLogMissingError } from "../../application/commands/deliver-email/deliver-email.errors";
import { QUEUE_EMAIL_SEND_OPERATION } from "../../application/ports/notifications.tokens";

/** The job fields the processor reads (a BullMQ `Job<EmailSendJob>` satisfies it). */
export type EmailSendJobExecution = Pick<Job<EmailSendJob>, "id" | "data" | "attemptsMade" | "opts">;

/** BullMQ's default when a job carries no `attempts` option: a single execution. */
const DEFAULT_JOB_ATTEMPTS = 1;

/**
 * `emailSend` worker: translates one job execution into the `DeliverEmail`
 * command, dispatched (and audited) by the SystemCommandDispatcher. ONE
 * provider call per execution; BullMQ owns retries and backoff (`emailSend`
 * preset, jobId = email log id). A redelivered job whose row is no longer
 * `pending` is skipped by the command. When retrying cannot help (row
 * missing, delivery abandoned) the job fails with `UnrecoverableError`, which
 * stops BullMQ at once.
 */
@Processor(QUEUE_NAMES.emailSend)
@Injectable()
export class EmailSendProcessor extends WorkerHost {
	private readonly logger: Logger = new Logger(EmailSendProcessor.name);

	public constructor(private readonly commands: SystemCommandDispatcher) {
		super();
	}

	public async process(job: EmailSendJobExecution): Promise<DeliverEmailResult> {
		const parsed = EmailSendJobSchema.parse(job.data);
		const attemptNumber = job.attemptsMade + 1;
		const actor = systemActor(QUEUE_EMAIL_SEND_OPERATION, "job", null, "Deliver one queued email", null);
		try {
			return await this.commands.dispatch(new DeliverEmailCommand(actor, { ...parsed, attemptNumber, maxAttempts: job.opts.attempts ?? DEFAULT_JOB_ATTEMPTS }), {
				kind: "job",
				name: QUEUE_NAMES.emailSend,
			});
		} catch (error) {
			this.logger.warn(`Email job ${job.id ?? parsed.emailLogId} attempt ${String(attemptNumber)} failed`);
			if (error instanceof EmailLogMissingError || error instanceof EmailDeliveryAbandonedError) {
				throw new UnrecoverableError(error.message);
			}
			throw error;
		}
	}
}
