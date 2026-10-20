import { Module, type OnModuleInit } from "@nestjs/common";
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
	EMAIL_REQUEST_RELAY,
	NOTIFICATIONS_UNIT_OF_WORK,
} from "./application/ports/notifications.tokens";
import { ListEmailLogHandler } from "./application/queries/list-email-log/list-email-log.handler";
import { ListEmailTemplatesHandler } from "./application/queries/list-email-templates/list-email-templates.handler";
import { PreviewEmailTemplateHandler } from "./application/queries/preview-email-template/preview-email-template.handler";
import { EmailDeliveryAdapter } from "./infrastructure/adapters/email-delivery.adapter";
import { EmailRequestHandOff } from "./infrastructure/adapters/email-hand-off.adapter";
import { EmailLogEventsService } from "./infrastructure/adapters/email-log-signal.adapter";
import { EmailRecipientRateLimiter } from "./infrastructure/adapters/email-recipient-rate-limiter.adapter";
import { EmailRequestRelayAdapter } from "./infrastructure/adapters/email-request-relay.adapter";
import { NotificationsHealthIndicator } from "./infrastructure/adapters/notifications-health.adapter";
import { NotificationsTransactionalPortsFactory } from "./infrastructure/adapters/transactional-email-requests.adapter";
import { emailTransportProvider } from "./infrastructure/adapters/transports/email-transport.provider";
import { NotificationsQueueDisabledModule } from "./infrastructure/queue/notifications-queue-disabled.module";
import { NotificationsQueueModule } from "./infrastructure/queue/notifications-queue.module";
import { NotificationsIntegrationEventsMapper } from "./infrastructure/outbox/notifications-integration-events.mapper";
import { PrismaEmailLogReadRepository } from "./infrastructure/persistence/prisma-email-log.read-repository";
import { NotificationsScopeFactory } from "./infrastructure/persistence/notifications-scope.factory";
import { EmailLogController } from "./presentation/http/email-log.controller";
import { EmailPreviewController } from "./presentation/http/email-preview.controller";
import { EmailWebhookController } from "./presentation/http/email-webhook.controller";

// Queue wiring is decided at load time from the validated config (parsed by main.ts first).
const notificationsQueueImports = getApiConfig().messaging.redisUrl !== undefined ? [NotificationsQueueModule] : [NotificationsQueueDisabledModule];

/**
 * The notifications context: the EmailLog lifecycle, durable email requests
 * (ADR 060), the provider webhook and the admin email log / preview surfaces.
 */
@Module({
	imports: [PrismaModule, OutboxModule, UnitOfWorkModule, SystemCommandModule, ...notificationsQueueImports],
	controllers: [EmailPreviewController, EmailWebhookController, EmailLogController],
	providers: [
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
			inject: [TenantTransactionService, NotificationsTransactionalPortsFactory, TransactionalEventDispatcher, AFTER_COMMIT_PUBLISHER],
			useFactory: (
				transactions: TenantTransactionService,
				ports: NotificationsTransactionalPortsFactory,
				dispatcher: TransactionalEventDispatcher<Prisma.TransactionClient>,
				publisher: AfterCommitPublisher,
			): UnitOfWork<NotificationsScope> => new PrismaUnitOfWork(transactions, new NotificationsScopeFactory(ports), dispatcher, publisher),
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
	],
	exports: [NotificationsTransactionalPortsFactory, NotificationsHealthIndicator],
})
export class NotificationsModule implements OnModuleInit {
	public constructor(
		private readonly mappers: IntegrationEventMapperRegistry,
		private readonly emailRoutes: OutboxEmailRouteRegistry,
		private readonly handOff: EmailRequestHandOff,
	) {}

	/** Registers the `email.log.updated` outbox mapper (M3) and this context as the target of the email outbox route (ADR 060). */
	public onModuleInit(): void {
		this.mappers.register(new NotificationsIntegrationEventsMapper());
		this.emailRoutes.register(this.handOff);
	}
}
