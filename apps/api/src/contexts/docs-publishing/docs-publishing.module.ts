import { Module } from "@nestjs/common";
import type { Redis } from "ioredis";

import { TypedConfigService } from "../../config/typed-config.service";
import { CLOCK, type Clock } from "../../platform/application/clock.port";
import { SystemCommandModule } from "../../platform/infrastructure/system-command.module";
import { REDIS_PUBLISHER } from "../../platform/infrastructure/redis/redis.tokens";
import { PrismaModule } from "../../prisma/prisma.module";
import { WebhooksInboundModule } from "../webhooks/inbound/public-api";
import { PruneDocsSyncRunsHandler } from "./application/commands/prune-docs-sync-runs/prune-docs-sync-runs.handler";
import { ReceiveNotionWebhookHandler } from "./application/commands/receive-notion-webhook/receive-notion-webhook.handler";
import { RecordDocsSyncRunHandler } from "./application/commands/record-docs-sync-run/record-docs-sync-run.handler";
import { RevealDocsWebhookHandshakeHandler } from "./application/commands/reveal-docs-webhook-handshake/reveal-docs-webhook-handshake.handler";
import { StartDocsSyncHandler } from "./application/commands/start-docs-sync/start-docs-sync.handler";
import {
	DOCS_PUBLISHING_SETTINGS,
	DOCS_SYNC_DISPATCHER,
	DOCS_SYNC_RUN_READ,
	DOCS_SYNC_RUN_STORE,
	DOCS_WEBHOOK_HANDSHAKE_STORE,
	type DocsPublishingSettings,
	type DocsSyncDispatcherPort,
	type DocsWebhookHandshakeStorePort,
} from "./application/ports/docs-publishing.ports";
import { GetDocsSyncOverviewHandler, GetDocsSyncRunHandler, ListDocsSyncRunsHandler } from "./application/queries/docs-sync.handlers";
import { GithubWorkflowDispatcher } from "./infrastructure/github-workflow.dispatcher";
import { PrismaDocsSyncRunRepository } from "./infrastructure/prisma-docs-sync-run.repository";
import { InMemoryWebhookHandshakeStore, RedisWebhookHandshakeStore } from "./infrastructure/webhook-handshake.stores";
import { DocsPublishingAdminController } from "./presentation/http/docs-publishing-admin.controller";
import { DocsSyncReportController } from "./presentation/http/docs-sync-report.controller";
import { NotionWebhookController } from "./presentation/http/notion-webhook.controller";
import { DocsSyncRunRetentionCron } from "./presentation/jobs/docs-sync-run-retention.cron";

/**
 * Docs publishing (ADR 084): the platform's side of the docs sync. It receives Notion's webhook, starts the sync on
 * GitHub, records what the sync reports, and feeds the Operations console. The sync itself runs in GitHub Actions
 * (`packages/docs-sync`), so this context never reads a writing tool: a tool with no webhook needs nothing here.
 */
@Module({
	imports: [PrismaModule, SystemCommandModule, WebhooksInboundModule],
	controllers: [NotionWebhookController, DocsSyncReportController, DocsPublishingAdminController],
	providers: [
		{ provide: DOCS_PUBLISHING_SETTINGS, inject: [TypedConfigService], useFactory: (config: TypedConfigService): DocsPublishingSettings => config.docsPublishing },
		PrismaDocsSyncRunRepository,
		{ provide: DOCS_SYNC_RUN_STORE, useExisting: PrismaDocsSyncRunRepository },
		{ provide: DOCS_SYNC_RUN_READ, useExisting: PrismaDocsSyncRunRepository },
		{
			provide: DOCS_SYNC_DISPATCHER,
			inject: [TypedConfigService],
			useFactory: (config: TypedConfigService): DocsSyncDispatcherPort | null => {
				const { dispatch } = config.docsPublishing;
				return dispatch === null ? null : new GithubWorkflowDispatcher(dispatch, (url, init) => fetch(url, init));
			},
		},
		{
			provide: DOCS_WEBHOOK_HANDSHAKE_STORE,
			inject: [REDIS_PUBLISHER, TypedConfigService, CLOCK],
			useFactory: (redis: Redis | null, config: TypedConfigService, clock: Clock): DocsWebhookHandshakeStorePort => {
				const { jwtAccessSecret } = config.auth;
				return redis === null
					? new InMemoryWebhookHandshakeStore(jwtAccessSecret, clock)
					: new RedisWebhookHandshakeStore(redis, config.redisNamespace, jwtAccessSecret, clock);
			},
		},
		ReceiveNotionWebhookHandler,
		RecordDocsSyncRunHandler,
		StartDocsSyncHandler,
		RevealDocsWebhookHandshakeHandler,
		PruneDocsSyncRunsHandler,
		GetDocsSyncOverviewHandler,
		ListDocsSyncRunsHandler,
		GetDocsSyncRunHandler,
		DocsSyncRunRetentionCron,
	],
})
export class DocsPublishingModule {}
