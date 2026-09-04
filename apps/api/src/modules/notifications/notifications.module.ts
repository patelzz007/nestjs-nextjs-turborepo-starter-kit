import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";

import { ConfigModule } from "../../config/config.module";
import { TypedConfigService } from "../../config/typed-config.service";
import { PrismaModule } from "../../prisma/prisma.module";

import { EmailLogController } from "./email/email-log.controller";
import { EmailPreviewController } from "./email/email-preview.controller";
import { EmailWebhookController } from "./email/email-webhook.controller";
import { webhookThrottlerOptionsFactory } from "./email/webhook-throttler";
import { NotificationsHealthIndicator } from "./health/notifications.health";
import { NotificationsEmailModule } from "./notifications-email.module";
import { NotificationsQueueDisabledModule } from "./notifications-queue-disabled.module";
import { NotificationsQueueModule } from "./notifications-queue.module";

const redisUrl: string | undefined = process.env.REDIS_URL;
const notificationsQueueImports = redisUrl !== undefined && redisUrl.length > 0 ? [NotificationsQueueModule] : [NotificationsQueueDisabledModule];

@Module({
	imports: [
		PrismaModule,
		NotificationsEmailModule,
		...notificationsQueueImports,
		ThrottlerModule.forRootAsync({
			imports: [ConfigModule],
			inject: [TypedConfigService],
			useFactory: webhookThrottlerOptionsFactory,
		}),
	],
	controllers: [EmailPreviewController, EmailWebhookController, EmailLogController],
	providers: [NotificationsHealthIndicator],
	exports: [NotificationsEmailModule, NotificationsHealthIndicator, ...notificationsQueueImports],
})
export class NotificationsModule {}
