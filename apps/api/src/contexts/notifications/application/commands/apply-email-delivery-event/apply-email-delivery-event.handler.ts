import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { EmailLog } from "../../../domain/aggregates/email-log.aggregate";
import { EmailDeliveryStatusChanged } from "../../../domain/events/email-log-updated.event";
import type { DeliveryEventRecordResult } from "../../../domain/repositories/email-log.repository";
import { EMAIL_LOG_WRITE_OPERATION, type NotificationsScope } from "../../notifications-scope";
import { NOTIFICATIONS_UNIT_OF_WORK } from "../../ports/notifications.tokens";
import { ApplyEmailDeliveryEventCommand } from "./apply-email-delivery-event.command";

/**
 * One transaction per webhook delivery: the event row is recorded once per
 * `webhookId` (UNIQUE — a redelivery is `duplicate` and applies nothing) and
 * the row status moves only along the forward table, never behind an event
 * that is newer than this one (compare-and-set in the repository).
 */
@CommandHandler(ApplyEmailDeliveryEventCommand)
export class ApplyEmailDeliveryEventHandler implements ICommandHandler<ApplyEmailDeliveryEventCommand, DeliveryEventRecordResult> {
	public constructor(
		@Inject(NOTIFICATIONS_UNIT_OF_WORK) private readonly uow: UnitOfWork<NotificationsScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ApplyEmailDeliveryEventCommand): Promise<DeliveryEventRecordResult> {
		const { actor, input } = command;
		const allowedFrom = input.status === undefined ? [] : EmailLog.allowedFrom(input.status);
		return this.uow.runSystemOperation(EMAIL_LOG_WRITE_OPERATION, actor, async (scope: NotificationsScope): Promise<DeliveryEventRecordResult> => {
			const result = await scope.emailLogs.recordDeliveryEvent({ ...input, allowedFrom });
			if (result.kind === "recorded" && result.outcome === "applied" && result.emailLogId !== null) {
				scope.events.collect(new EmailDeliveryStatusChanged(this.clock.now(), result.emailLogId));
			}
			return result;
		});
	}
}
