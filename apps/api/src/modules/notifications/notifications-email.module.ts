import { Module } from "@nestjs/common";

import { EmailLogEventsService } from "./email/email-log-events.service";
import { EmailLogRepository } from "./email/email-log.repository";
import { EmailLogService } from "./email/email-log.service";

/** Email logging services — delivery is provided by the queue module with BullMQ wired in. */
@Module({
	providers: [EmailLogRepository, EmailLogService, EmailLogEventsService],
	exports: [EmailLogService, EmailLogEventsService],
})
export class NotificationsEmailModule {}
