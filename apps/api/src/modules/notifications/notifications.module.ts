import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";

// Only the CLASS REFERENCE is needed here (for `inject`) — the instance comes
// from the @Global() ConfigModule at runtime.
import { TypedConfigService } from "../../config/typed-config.service.js";
import { PrismaModule } from "../../prisma/prisma.module.js";

import { EmailLogController } from "./email/email-log.controller.js";
import { EmailLogEventsService } from "./email/email-log-events.service.js";
import { EmailLogService } from "./email/email-log.service.js";
import { EmailPreviewController } from "./email/email-preview.controller.js";
import { EmailSenderService } from "./email/email-sender.service.js";
import { EmailWebhookController } from "./email/email-webhook.controller.js";
import { webhookThrottlerOptionsFactory } from "./email/webhook-throttler.js";

/**
 * Notifications context — owns the entire outbound-email system.
 *
 * Layering (mirrors the DDD direction from docs/architecture.md):
 * - `email/base`        — the abstract `BaseEmailTemplate` + render context
 * - `email/templates`   — concrete templates (pure renderers)
 * - `email/…service`    — delivery (sender), persistence (log), registry
 * - controllers         — preview (admin) + webhook (public)
 *
 * `EmailSenderService` is exported so the auth module can delegate its legacy
 * `EmailService` to the new pipeline.
 */
@Module({
	imports: [
		PrismaModule,
		// Per-IP rate limiting for the PUBLIC delivery-webhook route only
		// (defense-in-depth on top of signature verification).
		ThrottlerModule.forRootAsync({
			inject: [TypedConfigService],
			useFactory: webhookThrottlerOptionsFactory,
		}),
	],
	controllers: [EmailPreviewController, EmailWebhookController, EmailLogController],
	// TypedConfigService is NOT listed here — it comes from the @Global()
	// ConfigModule (see config/config.module.ts). Imported modules instantiate
	// before this module's own providers, so a local copy would never be visible
	// to ThrottlerModule.forRootAsync's `inject` anyway. LogService likewise
	// comes from the @Global() LogsModule.
	providers: [EmailSenderService, EmailLogService, EmailLogEventsService],
	// EmailLogEventsService is exported for Telescope's email-job adapter
	// (telescope → notifications is a one-way observation edge — notifications
	// must never import TelescopeModule, that would create a cycle).
	exports: [EmailSenderService, EmailLogService, EmailLogEventsService],
})
export class NotificationsModule {}
