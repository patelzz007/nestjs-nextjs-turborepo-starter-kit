import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { EmailLog } from "../../../domain/aggregates/email-log.aggregate";
import type { BaseEmailProps, BaseEmailTemplate } from "../../../domain/templates/base/base-email-template";
import { buildEmailTemplateFromJobData } from "../../../domain/templates/email-template-props";
import { EMAIL_LOG_WRITE_OPERATION, type NotificationsScope } from "../../notifications-scope";
import { EmailDeliveryFailure, type EmailDeliveryPort } from "../../ports/email-delivery.port";
import { EMAIL_DELIVERY, NOTIFICATIONS_UNIT_OF_WORK } from "../../ports/notifications.tokens";
import { DeliverEmailCommand, type DeliverEmailResult } from "./deliver-email.command";
import { EmailDeliveryAbandonedError, EmailDeliveryRetryRequestedError, EmailLogMissingError, EmailSentButNotRecordedError } from "./deliver-email.errors";

/** Recorded on a row whose queued props no longer pass the template's schema. */
const INVALID_PROPS_DETAIL = "queued props failed validation";

/**
 * Delivers one requested email. A row that is no longer `pending` was already
 * finalized (redelivered job, or the sweep and the after-commit nudge both
 * handed it off) and is skipped — redelivery is idempotent. The provider call
 * runs OUTSIDE any transaction; the outcome is a compare-and-set on `pending`.
 */
@CommandHandler(DeliverEmailCommand)
export class DeliverEmailHandler implements ICommandHandler<DeliverEmailCommand, DeliverEmailResult> {
	private readonly logger: Logger = new Logger(DeliverEmailHandler.name);

	public constructor(
		@Inject(NOTIFICATIONS_UNIT_OF_WORK) private readonly uow: UnitOfWork<NotificationsScope>,
		@Inject(EMAIL_DELIVERY) private readonly delivery: EmailDeliveryPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: DeliverEmailCommand): Promise<DeliverEmailResult> {
		const { actor, input } = command;
		const log = await this.uow.runSystemOperation(EMAIL_LOG_WRITE_OPERATION, actor, async (scope: NotificationsScope): Promise<EmailLog | null> =>
			scope.emailLogs.findById(input.emailLogId),
		);
		if (log === null) {
			throw new EmailLogMissingError(input.emailLogId);
		}
		if (!log.isAwaitingDelivery()) {
			return { outcome: "skipped" };
		}

		let template: BaseEmailTemplate<BaseEmailProps>;
		try {
			template = buildEmailTemplateFromJobData(input.templateKey, input.props);
		} catch (error) {
			await this.finalizeFailed(actor, log, INVALID_PROPS_DETAIL, null);
			throw new EmailDeliveryAbandonedError(`Queued email ${input.emailLogId} has invalid props`, { cause: error });
		}

		const startedAt = this.clock.now();
		try {
			const receipt = await this.delivery.deliver(log.id, template);
			await this.finalizeSent(actor, log, receipt.resendId, this.clock.now() - startedAt);
			return { outcome: "sent", providerMessageId: receipt.providerMessageId };
		} catch (error) {
			if (!(error instanceof EmailDeliveryFailure)) {
				throw error;
			}
			const lastAttempt = input.attemptNumber >= input.maxAttempts;
			if (!error.retryable || lastAttempt) {
				await this.finalizeFailed(actor, log, error.message, this.clock.now() - startedAt);
				this.logger.error(`Email ${log.id} (${log.templateKey}) failed for good: ${error.message}`);
				throw new EmailDeliveryAbandonedError(error.message, { cause: error });
			}
			throw new EmailDeliveryRetryRequestedError(error.message, { cause: error });
		}
	}

	private async finalizeSent(actor: ActorContext, log: EmailLog, resendId: string | null, durationMs: number): Promise<void> {
		try {
			await this.uow.runSystemOperation(EMAIL_LOG_WRITE_OPERATION, actor, async (scope: NotificationsScope): Promise<void> => {
				log.recordSent(resendId, durationMs, this.clock.now());
				const finalized = await scope.emailLogs.finalizeSent(log, resendId);
				this.collectIf(finalized, log, scope);
			});
		} catch (error) {
			throw new EmailSentButNotRecordedError(log.id, { cause: error });
		}
	}

	private async finalizeFailed(actor: ActorContext, log: EmailLog, detail: string, durationMs: number | null): Promise<void> {
		await this.uow.runSystemOperation(EMAIL_LOG_WRITE_OPERATION, actor, async (scope: NotificationsScope): Promise<void> => {
			log.recordFailed(detail, durationMs, this.clock.now());
			const finalized = await scope.emailLogs.finalizeFailed(log, detail);
			this.collectIf(finalized, log, scope);
		});
	}

	/** Only the writer that actually finalized the row emits the outcome event; a lost compare-and-set emits nothing. */
	private collectIf(finalized: boolean, log: EmailLog, scope: NotificationsScope): void {
		const events = log.pullEvents();
		if (!finalized) {
			return;
		}
		for (const event of events) {
			scope.events.collect(event);
		}
	}
}
