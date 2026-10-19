import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EmailSendResult } from "@workspace/shared";

import { AuthorizationError } from "../../../../../platform/application/errors/app-error";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { EMAIL_TEMPLATE_REGISTRY } from "../../../domain/templates/email-template.registry";
import type { NotificationsScope } from "../../notifications-scope";
import { NOTIFICATIONS_UNIT_OF_WORK } from "../../ports/notifications.tokens";
import { SendTestEmailCommand } from "./send-test-email.command";

/**
 * The admin test send, through the transactional email request port: the log
 * row and its outbox request commit in the admin's own unit of work, then the
 * after-commit hand-off delivers it. The log row records `trigger=admin-test-send`
 * and the acting admin (on top of the HTTP audit entry of the request).
 */
@CommandHandler(SendTestEmailCommand)
export class SendTestEmailHandler implements ICommandHandler<SendTestEmailCommand, EmailSendResult> {
	public constructor(@Inject(NOTIFICATIONS_UNIT_OF_WORK) private readonly uow: UnitOfWork<NotificationsScope>) {}

	public async execute(command: SendTestEmailCommand): Promise<EmailSendResult> {
		const { actor, input } = command;
		if (actor.kind !== "user") {
			throw new AuthorizationError({ message: "Only a signed-in administrator can send a test email." });
		}
		const template = EMAIL_TEMPLATE_REGISTRY[input.templateKey].build();
		return this.uow.run(actor, async (scope: NotificationsScope): Promise<EmailSendResult> =>
			scope.emailRequests.request(template, { audit: { trigger: "admin-test-send", actorUserId: actor.userId } }),
		);
	}
}
