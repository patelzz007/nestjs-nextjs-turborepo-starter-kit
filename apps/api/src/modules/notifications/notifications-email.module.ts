import { Module } from "@nestjs/common";

import { EmailLogEventsService } from "./email/email-log-events.service";
import { EmailLogService } from "./email/email-log.service";

/** Email logging services — delivery is provided by the queue module with BullMQ wired in. */
@Module({
	providers: [EmailLogService, EmailLogEventsService],
	exports: [EmailLogService, EmailLogEventsService],
})
export class NotificationsEmailModule {}
