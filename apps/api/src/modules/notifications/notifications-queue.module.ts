import { Module } from "@nestjs/common";

import { EmailSendProcessor } from "./email/email-send.processor";
import { EmailQueueService } from "./email/email-queue.service";
import { NotificationsEmailModule } from "./notifications-email.module";

/** BullMQ email worker — imported when Redis is configured. */
@Module({
	imports: [NotificationsEmailModule],
	providers: [EmailSendProcessor, EmailQueueService],
	exports: [EmailQueueService],
})
export class NotificationsQueueModule {}
