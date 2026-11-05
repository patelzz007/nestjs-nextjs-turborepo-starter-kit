import { Module } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { CLOCK, type Clock } from "../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../platform/application/unit-of-work.port";
import { SystemCommandModule } from "../../../platform/infrastructure/system-command.module";
import type { AfterCommitPublisher } from "../../../platform/infrastructure/unit-of-work/after-commit-publisher";
import { PrismaReadExecutor } from "../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import { PrismaUnitOfWork } from "../../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { TransactionalEventDispatcher } from "../../../platform/infrastructure/unit-of-work/transactional-event-dispatcher";
import { AFTER_COMMIT_PUBLISHER, UnitOfWorkModule } from "../../../platform/infrastructure/unit-of-work/unit-of-work.module";
import { PrismaModule } from "../../../prisma/prisma.module";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { NotificationsModule, NotificationsTransactionalPortsFactory } from "../../notifications/public-api";
import { TenantAccessModule } from "../../tenancy/public-api";
import { CreateWebhookEndpointHandler } from "./application/commands/create-webhook-endpoint/create-webhook-endpoint.handler";
import { DeleteWebhookEndpointHandler } from "./application/commands/delete-webhook-endpoint/delete-webhook-endpoint.handler";
import { DisableWebhookEndpointHandler } from "./application/commands/disable-webhook-endpoint/disable-webhook-endpoint.handler";
import { EnableWebhookEndpointHandler } from "./application/commands/enable-webhook-endpoint/enable-webhook-endpoint.handler";
import { RedeliverWebhookHandler } from "./application/commands/redeliver-webhook/redeliver-webhook.handler";
import { RotateWebhookSecretHandler } from "./application/commands/rotate-webhook-secret/rotate-webhook-secret.handler";
import { SendWebhookTestHandler } from "./application/commands/send-webhook-test/send-webhook-test.handler";
import { UpdateWebhookEndpointHandler } from "./application/commands/update-webhook-endpoint/update-webhook-endpoint.handler";
import { FanOutWebhookEventAfterCommit, SendQueuedWebhookAfterCommit } from "./application/event-handlers/after-commit/send-webhooks-after-commit.event-handlers";
import { WEBHOOK_DELIVERY_ENGINE } from "./application/ports/webhook-delivery-engine.token";
import type { WebhookIdGenerator } from "./application/ports/webhook-ids.port";
import type { WebhookSecretsPort } from "./application/ports/webhook-secrets.port";
import type { WebhookSenderPort } from "./application/ports/webhook-sender.port";
import type { WebhooksReadPort } from "./application/ports/webhooks-read.port";
import {
	WEBHOOK_IDS,
	WEBHOOK_RANDOM,
	WEBHOOK_READS,
	WEBHOOK_SECRETS,
	WEBHOOK_SENDER,
	WEBHOOK_URL_POLICY,
	WEBHOOKS_UNIT_OF_WORK,
} from "./application/ports/webhooks-outbound.tokens";
import { GetWebhookEndpointHandler } from "./application/queries/get-webhook-endpoint/get-webhook-endpoint.handler";
import { ListWebhookDeliveriesHandler } from "./application/queries/list-webhook-deliveries/list-webhook-deliveries.handler";
import { ListWebhookEndpointsHandler } from "./application/queries/list-webhook-endpoints/list-webhook-endpoints.handler";
import { WebhookDeliveryEngine } from "./application/services/webhook-delivery-engine";
import type { WebhooksScope } from "./application/webhooks-scope";
import { GuardedWebhookSender } from "./infrastructure/adapters/guarded-webhook-sender";
import { WebhookIdsAdapter } from "./infrastructure/adapters/webhook-ids.adapter";
import { WebhookSecretCipher } from "./infrastructure/adapters/webhook-secret.cipher";
import { WebhookUrlPolicyAdapter } from "./infrastructure/adapters/webhook-url-policy.adapter";
import { PrismaWebhooksReadRepository } from "./infrastructure/persistence/prisma-webhooks.read-repository";
import { WebhooksScopeFactory } from "./infrastructure/persistence/webhooks-scope.factory";
import { WebhooksOutboundRegistrations } from "./infrastructure/webhooks-outbound-registrations";
import { TenantWebhooksController } from "./presentation/http/tenant-webhooks.controller";
import { WebhookSweepScheduler } from "./presentation/jobs/webhook-sweep.scheduler";

/**
 * Outgoing webhooks for integrators (ADR 082): a tenant's endpoints, the event outbox its business events are
 * written to, and the signed, retried deliveries. A composition module (its scope binds rewards', tenancy's and
 * notifications' transactional ports), mounted by `app.module.ts` only.
 */
@Module({
	imports: [PrismaModule, UnitOfWorkModule, SystemCommandModule, NotificationsModule, TenantAccessModule],
	controllers: [TenantWebhooksController],
	providers: [
		{
			provide: WEBHOOKS_UNIT_OF_WORK,
			inject: [TenantTransactionService, NotificationsTransactionalPortsFactory, TransactionalEventDispatcher, AFTER_COMMIT_PUBLISHER],
			useFactory: (
				transactions: TenantTransactionService,
				notifications: NotificationsTransactionalPortsFactory,
				dispatcher: TransactionalEventDispatcher<Prisma.TransactionClient>,
				publisher: AfterCommitPublisher,
			): UnitOfWork<WebhooksScope> => new PrismaUnitOfWork(transactions, new WebhooksScopeFactory(notifications), dispatcher, publisher),
		},
		{
			provide: WEBHOOK_READS,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): WebhooksReadPort =>
				new PrismaWebhooksReadRepository(new PrismaReadExecutor<Prisma.TransactionClient>(transactions)),
		},
		WebhookSecretCipher,
		{ provide: WEBHOOK_SECRETS, useExisting: WebhookSecretCipher },
		GuardedWebhookSender,
		{ provide: WEBHOOK_SENDER, useExisting: GuardedWebhookSender },
		WebhookUrlPolicyAdapter,
		{ provide: WEBHOOK_URL_POLICY, useExisting: WebhookUrlPolicyAdapter },
		WebhookIdsAdapter,
		{ provide: WEBHOOK_IDS, useExisting: WebhookIdsAdapter },
		{ provide: WEBHOOK_RANDOM, useValue: (): number => Math.random() },
		{
			provide: WEBHOOK_DELIVERY_ENGINE,
			inject: [WEBHOOKS_UNIT_OF_WORK, WEBHOOK_SECRETS, WEBHOOK_SENDER, WEBHOOK_IDS, CLOCK, WEBHOOK_RANDOM],
			useFactory: (
				uow: UnitOfWork<WebhooksScope>,
				secrets: WebhookSecretsPort,
				sender: WebhookSenderPort,
				ids: WebhookIdGenerator,
				clock: Clock,
				random: () => number,
			): WebhookDeliveryEngine => new WebhookDeliveryEngine({ uow, secrets, sender, ids, clock, random }),
		},
		WebhooksOutboundRegistrations,
		CreateWebhookEndpointHandler,
		UpdateWebhookEndpointHandler,
		DeleteWebhookEndpointHandler,
		EnableWebhookEndpointHandler,
		DisableWebhookEndpointHandler,
		RotateWebhookSecretHandler,
		SendWebhookTestHandler,
		RedeliverWebhookHandler,
		ListWebhookEndpointsHandler,
		GetWebhookEndpointHandler,
		ListWebhookDeliveriesHandler,
		FanOutWebhookEventAfterCommit,
		SendQueuedWebhookAfterCommit,
		WebhookSweepScheduler,
	],
})
export class WebhooksOutboundModule {}
