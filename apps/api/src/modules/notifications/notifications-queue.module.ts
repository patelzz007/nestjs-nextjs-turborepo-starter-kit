import { Module } from "@nestjs/common";

import { EmailSendProcessor } from "./email/email-send.processor";
import { EmailQueueService } from "./email/email-queue.service";
import { EmailSenderService } from "./email/email-sender.service";
import { emailSenderProvider } from "./email/email-sender.provider";
import { NotificationsEmailModule } from "./notifications-email.module";

/** BullMQ email worker — imported when Redis is configured. */
@Module({
	imports: [NotificationsEmailModule],
	providers: [EmailSendProcessor, EmailQueueService, emailSenderProvider],
	exports: [EmailQueueService, EmailSenderService],
})
export class NotificationsQueueModule {}
