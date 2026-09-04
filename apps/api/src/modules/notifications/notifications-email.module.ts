import { Module } from "@nestjs/common";

import { EmailLogEventsService } from "./email/email-log-events.service";
import { EmailLogService } from "./email/email-log.service";
import { EmailSenderService } from "./email/email-sender.service";

/** Email delivery + logging services shared by HTTP controllers and BullMQ workers. */
@Module({
	providers: [EmailSenderService, EmailLogService, EmailLogEventsService],
	exports: [EmailSenderService, EmailLogService, EmailLogEventsService],
})
export class NotificationsEmailModule {}
