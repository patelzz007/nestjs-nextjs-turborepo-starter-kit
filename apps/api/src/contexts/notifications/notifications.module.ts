import { Module, type OnModuleInit } from "@nestjs/common";
import { PersonalDataErasureRegistry } from "../../platform/application/personal-data/personal-data-erasure.registry";
import { notificationsEraser } from "./infrastructure/personal-data/notifications-erasure";
import { PersonalDataExportRegistry } from "../../platform/application/personal-data/personal-data-export.registry";
import { NotificationsPersonalDataExporter } from "./infrastructure/personal-data/notifications-personal-data.exporter";
import type { Prisma } from "@prisma/client";
import { EmailRenderContextSchema, type EmailRenderContext } from "@workspace/shared";

import { getApiConfig } from "../../config/api-config";
import { TypedConfigService } from "../../config/typed-config.service";
import { IntegrationEventMapperRegistry } from "../../platform/application/events/integration-event-mapper";
import type { UnitOfWork } from "../../platform/application/unit-of-work.port";
import { OutboxEmailRouteRegistry } from "../../platform/infrastructure/outbox/outbox-email-relay";
import { OutboxModule } from "../../platform/infrastructure/outbox/outbox.module";
import { SystemCommandModule } from "../../platform/infrastructure/system-command.module";
import type { AfterCommitPublisher } from "../../platform/infrastructure/unit-of-work/after-commit-publisher";
import { PrismaUnitOfWork } from "../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { TransactionalEventDispatcher } from "../../platform/infrastructure/unit-of-work/transactional-event-dispatcher";
import { AFTER_COMMIT_PUBLISHER, UnitOfWorkModule } from "../../platform/infrastructure/unit-of-work/unit-of-work.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { ApplyEmailDeliveryEventHandler } from "./application/commands/apply-email-delivery-event/apply-email-delivery-event.handler";
import { DeliverEmailHandler } from "./application/commands/deliver-email/deliver-email.handler";
import { SendTestEmailHandler } from "./application/commands/send-test-email/send-test-email.handler";
import { HandOffRequestedEmailOnEmailRequested } from "./application/event-handlers/after-commit/hand-off-requested-email.event-handler";
import { SignalEmailLogChanged } from "./application/event-handlers/after-commit/signal-email-log-changed.event-handler";
import type { NotificationsScope } from "./application/notifications-scope";
import {
	EMAIL_DELIVERY,
	EMAIL_LOG_READ,
	EMAIL_LOG_SIGNAL,
	EMAIL_RENDER_CONTEXT,
	NOTIFICATION_WEBHOOK_RECEPTION,
	NOTIFICATION_WEBHOOK_VERIFIERS,
	EMAIL_REQUEST_RELAY,
	NOTIFICATIONS_UNIT_OF_WORK,
} from "./application/ports/notifications.tokens";
import { ListEmailLogHandler } from "./application/queries/list-email-log/list-email-log.handler";
import { ListEmailTemplatesHandler } from "./application/queries/list-email-templates/list-email-templates.handler";
import { PreviewEmailTemplateHandler } from "./application/queries/preview-email-template/preview-email-template.handler";
import { EmailDeliveryAdapter } from "./infrastructure/adapters/email-delivery.adapter";
import { EmailRequestHandOff } from "./infrastructure/adapters/email-hand-off.adapter";
import { EmailLogEventsService } from "./infrastructure/adapters/email-log-signal.adapter";
import { EmailRecipientRateLimiter, EMAIL_RATE_WINDOW_MS, EMAIL_RECIPIENT_POLICY } from "./infrastructure/adapters/email-recipient-rate-limiter.adapter";
import { EmailRequestRelayAdapter } from "./infrastructure/adapters/email-request-relay.adapter";
import { NotificationsHealthIndicator } from "./infrastructure/adapters/notifications-health.adapter";
import { NotificationsTransactionalPortsFactory } from "./infrastructure/adapters/transactional-email-requests.adapter";
import { emailTransportProvider } from "./infrastructure/adapters/transports/email-transport.provider";
import { NotificationsQueueDisabledModule } from "./infrastructure/queue/notifications-queue-disabled.module";
import { NotificationsIntegrationEventsMapper } from "./infrastructure/outbox/notifications-integration-events.mapper";
import { PrismaEmailLogReadRepository } from "./infrastructure/persistence/prisma-email-log.read-repository";
import { NotificationsScopeFactory } from "./infrastructure/persistence/notifications-scope.factory";
import { EmailLogController } from "./presentation/http/email-log.controller";
import { EmailPreviewController } from "./presentation/http/email-preview.controller";
import { EmailWebhookController } from "./presentation/http/email-webhook.controller";
import { NotificationWebhookReception } from "./application/services/notification-webhook-reception";
import { ConfiguredNotificationWebhookVerifiers } from "./infrastructure/adapters/notification-webhook-verifiers.adapter";
import { NotificationUnsubscribeController, TwilioWebhooksController } from "./presentation/http/notification-webhooks.controller";
import { NotificationsAdminController } from "./presentation/http/notifications-admin.controller";
import { NotificationsController } from "./presentation/http/notifications.controller";
import { TenantNotificationsController } from "./presentation/http/tenant-notifications.controller";
import { NotificationsMaintenanceCron } from "./presentation/jobs/notifications-maintenance.cron";
import {
	DeliverNotificationHandler,
	FanOutNotificationHandler,
	RunNotificationsMaintenanceHandler,
	SendBroadcastHandler,
	StartDueBroadcastsHandler,
} from "./application/commands/notification-command.handlers";
import { BroadcastReportController } from "./presentation/http/broadcast-report.controller";
import { BroadcastReportsAdminController } from "./presentation/http/broadcast-reports-admin.controller";
import { BroadcastsAdminController } from "./presentation/http/broadcasts-admin.controller";
import { TenantBroadcastsController } from "./presentation/http/tenant-broadcasts.controller";
import { BroadcastSchedulerCron } from "./presentation/jobs/broadcast.jobs";
import { BullMqBroadcastQueue } from "./infrastructure/queue/broadcast-queues";
import { FanOutOnNotificationRequested } from "./application/event-handlers/after-commit/fan-out-on-notification-requested.event-handler";
import { notificationProviders } from "./infrastructure/notifications.providers";
import { describeSlidingWindow, RateLimitPolicyRegistry } from "../../platform/application/rate-limiting/rate-limit-policy-registry";
import { SMS_CAP_WINDOW_MS, SMS_RECIPIENT_DAILY_POLICY, SMS_TENANT_DAILY_POLICY } from "./application/services/notification-fan-out";
import { TenantAccessModule } from "../tenancy/public-api";
import { BULLMQ_NOTIFICATION_QUEUES, NotificationsQueueModule } from "./infrastructure/queue/notifications-queue.module";
import { PublicUrlResolver } from "../../config/public-url.resolver";
import { NotificationsFileRegistrations } from "./infrastructure/persistence/notifications-file-registrations";
import { FilesModule } from "../files/public-api";
import { WebhooksInboundModule } from "../webhooks/inbound/public-api";

// Queue wiring is decided at load time from the validated config (parsed by main.ts first).
const usesRedis = getApiConfig().messaging.redisUrl !== undefined;
const notificationsQueueImports = usesRedis ? [NotificationsQueueModule] : [NotificationsQueueDisabledModule];

/**
 * The notifications context: the EmailLog lifecycle, durable email requests
 * (ADR 060), the provider webhook and the admin email log / preview surfaces.
 */
@Module({
	imports: [PrismaModule, OutboxModule, UnitOfWorkModule, SystemCommandModule, TenantAccessModule, FilesModule, WebhooksInboundModule, ...notificationsQueueImports],
	controllers: [
		EmailPreviewController,
		EmailWebhookController,
		EmailLogController,
		NotificationsController,
		NotificationsAdminController,
		TenantNotificationsController,
		NotificationUnsubscribeController,
		TwilioWebhooksController,
		BroadcastsAdminController,
		BroadcastReportsAdminController,
		TenantBroadcastsController,
		BroadcastReportController,
	],
	providers: [
		PublicUrlResolver,
		NotificationsFileRegistrations,
		{
			provide: EMAIL_RENDER_CONTEXT,
			inject: [TypedConfigService],
			useFactory: (config: TypedConfigService): EmailRenderContext =>
				EmailRenderContextSchema.parse({ appName: config.runtime.appName, appUrl: config.clientApps.webUrl, supportEmail: config.email.fromAddress }),
		},
		emailTransportProvider,
		EmailRecipientRateLimiter,
		NotificationsTransactionalPortsFactory,
		{
			provide: NOTIFICATIONS_UNIT_OF_WORK,
			inject: [TenantTransactionService, NotificationsTransactionalPortsFactory, TransactionalEventDispatcher, AFTER_COMMIT_PUBLISHER, TypedConfigService, PublicUrlResolver],
			useFactory: (
				transactions: TenantTransactionService,
				ports: NotificationsTransactionalPortsFactory,
				dispatcher: TransactionalEventDispatcher<Prisma.TransactionClient>,
				publisher: AfterCommitPublisher,
				config: TypedConfigService,
				urls: PublicUrlResolver,
			): UnitOfWork<NotificationsScope> =>
				new PrismaUnitOfWork(transactions, new NotificationsScopeFactory(ports, config.runtime.appName, urls.resolve), dispatcher, publisher),
		},
		EmailDeliveryAdapter,
		{ provide: EMAIL_DELIVERY, useExisting: EmailDeliveryAdapter },
		PrismaEmailLogReadRepository,
		{ provide: EMAIL_LOG_READ, useExisting: PrismaEmailLogReadRepository },
		EmailLogEventsService,
		{ provide: EMAIL_LOG_SIGNAL, useExisting: EmailLogEventsService },
		EmailRequestRelayAdapter,
		{ provide: EMAIL_REQUEST_RELAY, useExisting: EmailRequestRelayAdapter },
		EmailRequestHandOff,
		NotificationsHealthIndicator,
		DeliverEmailHandler,
		ApplyEmailDeliveryEventHandler,
		SendTestEmailHandler,
		ListEmailLogHandler,
		ListEmailTemplatesHandler,
		PreviewEmailTemplateHandler,
		HandOffRequestedEmailOnEmailRequested,
		SignalEmailLogChanged,
		// ── Provider callbacks through the shared inbound receiver (ADR 081) ──
		ConfiguredNotificationWebhookVerifiers,
		{ provide: NOTIFICATION_WEBHOOK_VERIFIERS, useExisting: ConfiguredNotificationWebhookVerifiers },
		NotificationWebhookReception,
		{ provide: NOTIFICATION_WEBHOOK_RECEPTION, useExisting: NotificationWebhookReception },
		// ── Notifications (ADR 070) ──
		...notificationProviders(usesRedis, usesRedis ? BULLMQ_NOTIFICATION_QUEUES : null, usesRedis ? BullMqBroadcastQueue : null),
		SendBroadcastHandler,
		StartDueBroadcastsHandler,
		BroadcastSchedulerCron,
		FanOutNotificationHandler,
		DeliverNotificationHandler,
		RunNotificationsMaintenanceHandler,
		FanOutOnNotificationRequested,
		NotificationsMaintenanceCron,
	],
	exports: [NotificationsTransactionalPortsFactory, NotificationsHealthIndicator],
})
export class NotificationsModule implements OnModuleInit {
	public constructor(
		private readonly mappers: IntegrationEventMapperRegistry,
		private readonly emailRoutes: OutboxEmailRouteRegistry,
		private readonly handOff: EmailRequestHandOff,
		private readonly rateLimitPolicies: RateLimitPolicyRegistry,
		private readonly config: TypedConfigService,
		private readonly personalData: PersonalDataExportRegistry,
		private readonly transactions: TenantTransactionService,
		private readonly erasure: PersonalDataErasureRegistry,
		private readonly erasureTransactions: TenantTransactionService,
	) {}

	/**
	 * Registers the `email.log.updated` outbox mapper (M3), this context as the target of the email outbox
	 * route (ADR 060), and the per-destination limits it counts (ADR 071).
	 */
	public onModuleInit(): void {
		this.erasure.registerEraser(notificationsEraser(this.erasureTransactions));
		this.mappers.register(new NotificationsIntegrationEventsMapper());
		this.personalData.register(new NotificationsPersonalDataExporter(this.transactions));
		this.emailRoutes.register(this.handOff);
		const { notifications, email } = this.config;
		this.rateLimitPolicies.register(
			{
				name: EMAIL_RECIPIENT_POLICY,
				algorithm: "sliding-window",
				subject: "destination",
				limit: describeSlidingWindow(email.rateLimitPerMinute, EMAIL_RATE_WINDOW_MS),
				failMode: "closed",
				penalty: false,
			},
			{
				name: SMS_RECIPIENT_DAILY_POLICY,
				algorithm: "sliding-window",
				subject: "destination",
				limit: describeSlidingWindow(notifications.smsDailyLimitPerRecipient, SMS_CAP_WINDOW_MS),
				failMode: "closed",
				penalty: false,
			},
			{
				name: SMS_TENANT_DAILY_POLICY,
				algorithm: "sliding-window",
				subject: "tenant",
				limit: describeSlidingWindow(notifications.smsDailyLimitPerTenant, SMS_CAP_WINDOW_MS),
				failMode: "closed",
				penalty: false,
			},
		);
	}
}
