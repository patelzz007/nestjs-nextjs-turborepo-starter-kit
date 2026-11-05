import { Module } from "@nestjs/common";

import { TypedConfigService } from "../../../config/typed-config.service";
import { SystemCommandModule } from "../../../platform/infrastructure/system-command.module";
import { PrismaModule } from "../../../prisma/prisma.module";
import { PruneReceivedWebhooksHandler } from "./application/commands/prune-received-webhooks/prune-received-webhooks.handler";
import {
	INBOUND_WEBHOOK_RECEIVER,
	RECEIVED_WEBHOOK_READ,
	RECEIVED_WEBHOOK_RETENTION_DAYS,
	RECEIVED_WEBHOOK_STORE,
	WEBHOOK_FAILURE_READER,
} from "./application/ports/webhooks-inbound.tokens";
import { GetReceivedWebhookHandler } from "./application/queries/get-received-webhook/get-received-webhook.handler";
import { ListReceivedWebhooksHandler } from "./application/queries/list-received-webhooks/list-received-webhooks.handler";
import { InboundWebhookReceiver } from "./application/services/inbound-webhook-receiver";
import { HttpWebhookFailureReader } from "./infrastructure/adapters/http-webhook-failure.reader";
import { PrismaReceivedWebhookReadRepository } from "./infrastructure/persistence/prisma-received-webhook.read-repository";
import { PrismaReceivedWebhookStore } from "./infrastructure/persistence/prisma-received-webhook.store";
import { ReceivedWebhooksController } from "./presentation/http/received-webhooks.controller";
import { ReceivedWebhookRetentionCron } from "./presentation/jobs/received-webhook-retention.cron";

/**
 * The inbound half of the webhooks context (ADR 081): the one receiving path every provider's webhook
 * takes (`INBOUND_WEBHOOK_RECEIVER` — verify, claim, hand to the owning context, record), the
 * received-webhook log it writes, the admin viewer over that log, and the hourly retention prune.
 * The receiving contexts (GitHub live updates, payments, notifications) import this module for the
 * receiver; it depends on none of them.
 */
@Module({
	imports: [PrismaModule, SystemCommandModule],
	controllers: [ReceivedWebhooksController],
	providers: [
		PrismaReceivedWebhookStore,
		{ provide: RECEIVED_WEBHOOK_STORE, useExisting: PrismaReceivedWebhookStore },
		PrismaReceivedWebhookReadRepository,
		{ provide: RECEIVED_WEBHOOK_READ, useExisting: PrismaReceivedWebhookReadRepository },
		HttpWebhookFailureReader,
		{ provide: WEBHOOK_FAILURE_READER, useExisting: HttpWebhookFailureReader },
		{ provide: RECEIVED_WEBHOOK_RETENTION_DAYS, inject: [TypedConfigService], useFactory: (config: TypedConfigService): number => config.inboundWebhooks.retentionDays },
		InboundWebhookReceiver,
		{ provide: INBOUND_WEBHOOK_RECEIVER, useExisting: InboundWebhookReceiver },
		ListReceivedWebhooksHandler,
		GetReceivedWebhookHandler,
		PruneReceivedWebhooksHandler,
		ReceivedWebhookRetentionCron,
	],
	exports: [INBOUND_WEBHOOK_RECEIVER],
})
export class WebhooksInboundModule {}
