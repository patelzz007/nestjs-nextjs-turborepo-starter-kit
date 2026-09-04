import { Module } from "@nestjs/common";

import { EmailSendProcessor } from "./email/email-send.processor";
import { DisabledEmailQueueService, EmailQueueService } from "./email/email-queue.service";
import { NotificationsEmailModule } from "./notifications-email.module";

/** Fallback when `REDIS_URL` is unset. */
@Module({
	imports: [NotificationsEmailModule],
	providers: [DisabledEmailQueueService, { provide: EmailQueueService, useExisting: DisabledEmailQueueService }],
	exports: [EmailQueueService],
})
export class NotificationsQueueDisabledModule {}
