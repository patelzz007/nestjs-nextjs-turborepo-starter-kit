import { Module } from "@nestjs/common";

import { DisabledEmailQueueService, EmailQueueService } from "./email/email-queue.service";
import { EmailSenderService } from "./email/email-sender.service";
import { emailSenderProvider } from "./email/email-sender.provider";
import { NotificationsEmailModule } from "./notifications-email.module";

/** Fallback when `REDIS_URL` is unset. */
@Module({
	imports: [NotificationsEmailModule],
	providers: [DisabledEmailQueueService, { provide: EmailQueueService, useExisting: DisabledEmailQueueService }, emailSenderProvider],
	exports: [EmailQueueService, EmailSenderService],
})
export class NotificationsQueueDisabledModule {}
