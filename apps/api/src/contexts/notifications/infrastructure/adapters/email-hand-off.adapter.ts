import { Inject, Injectable, Logger } from "@nestjs/common";
import type { NotificationEmailRequestedPayload } from "@workspace/shared";

import { TypedConfigService } from "../../../../config/typed-config.service";
import { systemActor } from "../../../../platform/application/actor-context";
import type { SystemCommandOrigin } from "../../../../platform/application/ports/command-audit.port";
import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import type { OutboxEmailRequestTarget } from "../../../../platform/infrastructure/outbox/outbox-email-relay";
import { DeliverEmailCommand } from "../../application/commands/deliver-email/deliver-email.command";
import { EmailDeliveryRetryRequestedError } from "../../application/commands/deliver-email/deliver-email.errors";
import { EmailQueueService } from "./email-queue.adapter";
import { QUEUE_EMAIL_SEND_OPERATION } from "../../application/ports/notifications.tokens";

/** Inline-retry backoff: 300 ms × 2^(n-2), ±40 % jitter (the BullMQ preset's shape, for the no-Redis path). */
const RETRY_BASE_DELAY_MS = 300;
const RETRY_BACKOFF_MULTIPLIER = 2;
/** Attempt number of the second try: the first retry waits exactly `RETRY_BASE_DELAY_MS` before jitter. */
const FIRST_RETRY_ATTEMPT = 2;
const RETRY_JITTER_MIN_FACTOR = 0.6;
const RETRY_JITTER_SPAN = 0.8;

/** Origin recorded on the system-command audit row of an inline delivery attempt. */
const INLINE_DELIVERY_ORIGIN: SystemCommandOrigin = { kind: "job", name: "email-inline-delivery" };

/**
 * Where the outbox relay hands an email request (ADR 060).
 *
 * - With BullMQ (Redis configured — required in production): the `emailSend`
 *   queue, jobId = email log id, so handing the same request off twice is a no-op.
 * - Without Redis (local development only): the request is delivered inline,
 *   attempt by attempt, through the same `DeliverEmail` command and a bounded
 *   backoff loop. A delivery that fails for good is recorded on its log row, so
 *   the hand-off itself still succeeds. Limitation: without Redis there is no
 *   outbox sweep, so a crash between commit and this hand-off leaves the
 *   request PENDING until the API runs with Redis.
 */
@Injectable()
export class EmailRequestHandOff implements OutboxEmailRequestTarget {
	private readonly logger: Logger = new Logger(EmailRequestHandOff.name);

	public constructor(
		private readonly config: TypedConfigService,
		@Inject(EmailQueueService) private readonly queue: Pick<EmailQueueService, "isEnabled" | "enqueue">,
		@Inject(SystemCommandDispatcher) private readonly commands: Pick<SystemCommandDispatcher, "dispatch">,
	) {}

	public async handOff(request: NotificationEmailRequestedPayload): Promise<void> {
		if (this.queue.isEnabled()) {
			await this.queue.enqueue(request);
			return;
		}
		await this.deliverInline(request);
	}

	private async deliverInline(request: NotificationEmailRequestedPayload): Promise<void> {
		const maxAttempts = this.config.email.maxAttempts;
		const actor = systemActor(QUEUE_EMAIL_SEND_OPERATION, "job", null, "Deliver one requested email inline (no Redis)", null);
		for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
			if (attemptNumber >= FIRST_RETRY_ATTEMPT) {
				await this.backoff(attemptNumber);
			}
			try {
				await this.commands.dispatch(new DeliverEmailCommand(actor, { ...request, attemptNumber, maxAttempts }), INLINE_DELIVERY_ORIGIN);
				return;
			} catch (error) {
				if (error instanceof EmailDeliveryRetryRequestedError) {
					continue;
				}
				// Abandoned (row finalized `failed`), sent-but-not-recorded (a webhook finishes it) or missing row:
				// retrying inline cannot help, and the log row already says what happened.
				this.logger.warn(`Inline delivery of email ${request.emailLogId} stopped: ${error instanceof Error ? error.message : "unknown error"}`);
				return;
			}
		}
	}

	private async backoff(attemptNumber: number): Promise<void> {
		const baseDelay: number = RETRY_BASE_DELAY_MS * RETRY_BACKOFF_MULTIPLIER ** (attemptNumber - FIRST_RETRY_ATTEMPT);
		const delay: number = baseDelay * (RETRY_JITTER_MIN_FACTOR + Math.random() * RETRY_JITTER_SPAN);
		await new Promise<void>((resolve): void => {
			setTimeout(resolve, delay);
		});
	}
}
