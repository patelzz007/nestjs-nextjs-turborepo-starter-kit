import { Module } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { TypedConfigService } from "../../config/typed-config.service";
import type { UnitOfWork } from "../../platform/application/unit-of-work.port";
import { PgListenConnection, type OpenListenConnection } from "../../platform/infrastructure/database/pg-listen-connection";
import { SystemCommandModule } from "../../platform/infrastructure/system-command.module";
import type { AfterCommitPublisher } from "../../platform/infrastructure/unit-of-work/after-commit-publisher";
import { PrismaReadExecutor } from "../../platform/infrastructure/unit-of-work/prisma-read-executor";
import { PrismaUnitOfWork } from "../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { TransactionalEventDispatcher } from "../../platform/infrastructure/unit-of-work/transactional-event-dispatcher";
import { AFTER_COMMIT_PUBLISHER, UnitOfWorkModule } from "../../platform/infrastructure/unit-of-work/unit-of-work.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { FilesModule } from "../files/public-api";
import { GithubFileRegistrations } from "./infrastructure/adapters/github-file-registrations";
import { AttachPullRequestPictureHandler } from "./application/commands/attach-pull-request-picture/attach-pull-request-picture.handler";
import { CommentOnPullRequestHandler } from "./application/commands/comment-on-pull-request/comment-on-pull-request.handler";
import { DisableLiveUpdatesHandler } from "./application/commands/disable-live-updates/disable-live-updates.handler";
import { EnableLiveUpdatesHandler } from "./application/commands/enable-live-updates/enable-live-updates.handler";
import { LinkGithubAccountHandler } from "./application/commands/link-github-account/link-github-account.handler";
import { MergePullRequestHandler } from "./application/commands/merge-pull-request/merge-pull-request.handler";
import { PruneGithubWebhookDeliveriesHandler } from "./application/commands/prune-github-webhook-deliveries/prune-github-webhook-deliveries.handler";
import { RecordGithubWebhookDeliveryHandler } from "./application/commands/record-github-webhook-delivery/record-github-webhook-delivery.handler";
import { SetPullRequestReactionHandler } from "./application/commands/set-pull-request-reaction/set-pull-request-reaction.handler";
import { SubmitPullRequestReviewHandler } from "./application/commands/submit-pull-request-review/submit-pull-request-review.handler";
import { UnlinkGithubAccountHandler } from "./application/commands/unlink-github-account/unlink-github-account.handler";
import type { GithubScope } from "./application/github-scope";
import type { GithubAccountLinkReadPort } from "./application/ports/github-account-link.port";
import {
	COMMENT_PICTURE_UPLOADS,
	GITHUB_ACCOUNT_LINK_READS,
	GITHUB_CHANGE_SIGNALS,
	GITHUB_CLOCK,
	GITHUB_CONTRIBUTIONS,
	GITHUB_PULL_REQUEST_CACHE,
	GITHUB_PULL_REQUEST_READS,
	GITHUB_PULL_REQUEST_WRITES,
	GITHUB_REPOSITORY_FILES,
	GITHUB_TOKEN_CIPHER,
	GITHUB_TOKEN_OWNER,
	GITHUB_UNIT_OF_WORK,
	GITHUB_WEBHOOK_ENDPOINT,
	GITHUB_WEBHOOK_STORE,
	GITHUB_WEBHOOKS,
} from "./application/ports/github.tokens";
import { CheckLiveUpdatesStreamHandler } from "./application/queries/check-live-updates-stream/check-live-updates-stream.handler";
import { GetContentEditHistoryHandler } from "./application/queries/get-content-edit-history/get-content-edit-history.handler";
import { GetGithubAccountStatusHandler } from "./application/queries/get-github-account-status/get-github-account-status.handler";
import { GetGithubCommitHandler } from "./application/queries/get-github-commit/get-github-commit.handler";
import { GetGithubCommitPageHandler } from "./application/queries/get-github-commit-page/get-github-commit-page.handler";
import { GetGithubContributorStatsHandler } from "./application/queries/get-github-contributor-stats/get-github-contributor-stats.handler";
import { GetGithubRepositorySummaryHandler } from "./application/queries/get-github-repository-summary/get-github-repository-summary.handler";
import { GetLiveUpdatesStatusHandler } from "./application/queries/get-live-updates-status/get-live-updates-status.handler";
import { GetPullRequestCommitHandler } from "./application/queries/get-pull-request-commit/get-pull-request-commit.handler";
import { GetPullRequestCommitsHandler } from "./application/queries/get-pull-request-commits/get-pull-request-commits.handler";
import { GetPullRequestDetailHandler } from "./application/queries/get-pull-request-detail/get-pull-request-detail.handler";
import { GetPullRequestFilesHandler } from "./application/queries/get-pull-request-files/get-pull-request-files.handler";
import { GetPullRequestReviewThreadsHandler } from "./application/queries/get-pull-request-review-threads/get-pull-request-review-threads.handler";
import { GetPullRequestStatusHandler } from "./application/queries/get-pull-request-status/get-pull-request-status.handler";
import { GetPullRequestTimelineHandler } from "./application/queries/get-pull-request-timeline/get-pull-request-timeline.handler";
import { GetRepositoryPictureHandler } from "./application/queries/get-repository-picture/get-repository-picture.handler";
import { GetUploadedPictureHandler } from "./application/queries/get-uploaded-picture/get-uploaded-picture.handler";
import { ListGithubRepositoriesHandler } from "./application/queries/list-github-repositories/list-github-repositories.handler";
import { ListPullRequestsHandler } from "./application/queries/list-pull-requests/list-pull-requests.handler";
import { GithubCommentPictures } from "./application/services/github-comment-pictures";
import { GithubLinkedCredentials } from "./application/services/github-linked-credentials";
import { GithubLiveUpdatesStatusReader } from "./application/services/github-live-updates-status";
import { CommentPictureUploadsAdapter } from "./infrastructure/adapters/comment-picture-uploads.adapter";
import { GithubContributionsAdapter } from "./infrastructure/adapters/github-contributions.adapter";
import { GithubCredentialCipher } from "./infrastructure/adapters/github-credential.cipher";
import { GITHUB_CHANGES_LISTEN_CONNECTION, GithubPullRequestChangesHub } from "./infrastructure/adapters/github-pull-request-changes.hub";
import { GithubPullRequestReadsAdapter } from "./infrastructure/adapters/github-pull-request-reads.adapter";
import { GithubPullRequestWritesAdapter } from "./infrastructure/adapters/github-pull-request-writes.adapter";
import { GithubRepositoryFilesAdapter } from "./infrastructure/adapters/github-repository-files.adapter";
import { GithubTokenOwnerAdapter } from "./infrastructure/adapters/github-token-owner.adapter";
import { GithubWebhookEndpointAdapter } from "./infrastructure/adapters/github-webhook-endpoint.adapter";
import { GithubWebhooksAdapter } from "./infrastructure/adapters/github-webhooks.adapter";
import { SYSTEM_GITHUB_CLOCK } from "./infrastructure/adapters/system-github-clock";
import { GithubApiClient } from "./infrastructure/github-api/github-api.client";
import { GITHUB_FETCH, GLOBAL_GITHUB_FETCH, GithubHttpTransport } from "./infrastructure/github-api/github-http.transport";
import { GithubPictureAddresses } from "./infrastructure/github-api/github-picture-addresses";
import { GithubPullRequestCache } from "./infrastructure/github-api/github-pull-request.cache";
import { GithubPullRequestClient } from "./infrastructure/github-api/github-pull-request.client";
import { GithubRepositoryFilesClient } from "./infrastructure/github-api/github-repository-files.client";
import { GithubWebhooksClient } from "./infrastructure/github-api/github-webhooks.client";
import { GithubScopeFactory } from "./infrastructure/persistence/github-scope.factory";
import { PrismaGithubAccountLinkReadRepository } from "./infrastructure/persistence/prisma-github-account-link.read-repository";
import { PrismaGithubWebhookStore } from "./infrastructure/persistence/prisma-github-webhook.store";
import { GithubAccountController } from "./presentation/http/github-account.controller";
import { GithubContentEditsController } from "./presentation/http/github-content-edits.controller";
import { GithubLiveUpdatesController } from "./presentation/http/github-live-updates.controller";
import { GithubPicturesController } from "./presentation/http/github-pictures.controller";
import { GithubPullRequestsController } from "./presentation/http/github-pull-requests.controller";
import { GithubRepositoryVisibleGuard } from "./presentation/http/github-repository-visible.guard";
import { GithubWebhookController } from "./presentation/http/github-webhook.controller";
import { GithubController } from "./presentation/http/github.controller";
import { GithubWebhookDeliveryRetentionCron } from "./presentation/jobs/github-webhook-delivery-retention.cron";

/**
 * integrations-github: an anti-corruption layer over GitHub (ADR 045, ADR 052).
 * Read-only contributions of the configured repositories with the server's
 * token, and pull requests with each admin's own linked token. GitHub's wire
 * shapes stay in `infrastructure/github-api`; the application sees only our
 * contract. Live updates: webhooks recorded once, announced with pg_notify,
 * heard by every instance's LISTEN hub, streamed over SSE.
 */
@Module({
	imports: [PrismaModule, UnitOfWorkModule, SystemCommandModule, FilesModule],
	controllers: [
		GithubController,
		GithubAccountController,
		GithubPullRequestsController,
		GithubContentEditsController,
		GithubPicturesController,
		GithubLiveUpdatesController,
		GithubWebhookController,
	],
	providers: [
		GithubFileRegistrations,
		GithubHttpTransport,
		GithubApiClient,
		GithubPullRequestClient,
		GithubRepositoryFilesClient,
		GithubWebhooksClient,
		GithubPictureAddresses,
		GithubPullRequestCache,
		GithubPullRequestChangesHub,
		GithubContributionsAdapter,
		{ provide: GITHUB_CONTRIBUTIONS, useExisting: GithubContributionsAdapter },
		GithubCredentialCipher,
		{ provide: GITHUB_TOKEN_CIPHER, useExisting: GithubCredentialCipher },
		GithubTokenOwnerAdapter,
		{ provide: GITHUB_TOKEN_OWNER, useExisting: GithubTokenOwnerAdapter },
		{ provide: GITHUB_PULL_REQUEST_CACHE, useExisting: GithubPullRequestCache },
		GithubPullRequestReadsAdapter,
		{ provide: GITHUB_PULL_REQUEST_READS, useExisting: GithubPullRequestReadsAdapter },
		GithubPullRequestWritesAdapter,
		{ provide: GITHUB_PULL_REQUEST_WRITES, useExisting: GithubPullRequestWritesAdapter },
		GithubRepositoryFilesAdapter,
		{ provide: GITHUB_REPOSITORY_FILES, useExisting: GithubRepositoryFilesAdapter },
		CommentPictureUploadsAdapter,
		{ provide: COMMENT_PICTURE_UPLOADS, useExisting: CommentPictureUploadsAdapter },
		GithubWebhookEndpointAdapter,
		{ provide: GITHUB_WEBHOOK_ENDPOINT, useExisting: GithubWebhookEndpointAdapter },
		GithubWebhooksAdapter,
		{ provide: GITHUB_WEBHOOKS, useExisting: GithubWebhooksAdapter },
		PrismaGithubWebhookStore,
		{ provide: GITHUB_WEBHOOK_STORE, useExisting: PrismaGithubWebhookStore },
		{ provide: GITHUB_CHANGE_SIGNALS, useExisting: GithubPullRequestChangesHub },
		{
			provide: GITHUB_ACCOUNT_LINK_READS,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): GithubAccountLinkReadPort => new PrismaGithubAccountLinkReadRepository(new PrismaReadExecutor(transactions)),
		},
		{
			provide: GITHUB_UNIT_OF_WORK,
			inject: [TenantTransactionService, TransactionalEventDispatcher, AFTER_COMMIT_PUBLISHER],
			useFactory: (
				transactions: TenantTransactionService,
				dispatcher: TransactionalEventDispatcher<Prisma.TransactionClient>,
				publisher: AfterCommitPublisher,
			): UnitOfWork<GithubScope> => new PrismaUnitOfWork(transactions, new GithubScopeFactory(), dispatcher, publisher),
		},
		GithubLinkedCredentials,
		GithubCommentPictures,
		GithubLiveUpdatesStatusReader,
		ListGithubRepositoriesHandler,
		GetGithubRepositorySummaryHandler,
		GetGithubCommitPageHandler,
		GetGithubCommitHandler,
		GetGithubContributorStatsHandler,
		GetGithubAccountStatusHandler,
		ListPullRequestsHandler,
		GetPullRequestDetailHandler,
		GetPullRequestTimelineHandler,
		GetPullRequestCommitsHandler,
		GetPullRequestStatusHandler,
		GetPullRequestCommitHandler,
		GetPullRequestFilesHandler,
		GetPullRequestReviewThreadsHandler,
		GetContentEditHistoryHandler,
		GetRepositoryPictureHandler,
		GetUploadedPictureHandler,
		GetLiveUpdatesStatusHandler,
		CheckLiveUpdatesStreamHandler,
		LinkGithubAccountHandler,
		UnlinkGithubAccountHandler,
		CommentOnPullRequestHandler,
		SubmitPullRequestReviewHandler,
		MergePullRequestHandler,
		AttachPullRequestPictureHandler,
		SetPullRequestReactionHandler,
		EnableLiveUpdatesHandler,
		DisableLiveUpdatesHandler,
		RecordGithubWebhookDeliveryHandler,
		PruneGithubWebhookDeliveriesHandler,
		GithubRepositoryVisibleGuard,
		GithubWebhookDeliveryRetentionCron,
		{
			// The change listener's own database session (a LISTEN belongs to its connection).
			provide: GITHUB_CHANGES_LISTEN_CONNECTION,
			inject: [TypedConfigService],
			useFactory:
				(config: TypedConfigService): OpenListenConnection =>
				(): PgListenConnection =>
					new PgListenConnection(config.database.url, "github-pull-request-listener"),
		},
		{ provide: GITHUB_FETCH, useValue: GLOBAL_GITHUB_FETCH },
		{ provide: GITHUB_CLOCK, useValue: SYSTEM_GITHUB_CLOCK },
	],
})
export class GithubModule {}
