import { Module } from "@nestjs/common";

import { FilesModule } from "../files/files.module";
import { TypedConfigService } from "../../config/typed-config.service";
import { PgListenConnection, type OpenListenConnection } from "../../infrastructure/database/pg-listen-connection";
import { GithubApiClient } from "./github-api.client";
import { GITHUB_CLOCK, GithubContributionsService, SYSTEM_GITHUB_CLOCK } from "./github-contributions.service";
import { GITHUB_FETCH, GLOBAL_GITHUB_FETCH, GithubHttpTransport } from "./github-http.transport";
import { GithubController } from "./github.controller";
import { GithubLiveUpdatesController } from "./live-updates/github-live-updates.controller";
import { GithubLiveUpdatesService } from "./live-updates/github-live-updates.service";
import { GithubRepositoryVisibleGuard } from "./live-updates/github-repository-visible.guard";
import { GITHUB_CHANGES_LISTEN_CONNECTION, GithubPullRequestChangesHub } from "./live-updates/github-pull-request-changes.hub";
import { GithubWebhookController } from "./live-updates/github-webhook.controller";
import { GithubWebhookDeliveryRetention } from "./live-updates/github-webhook-delivery.retention";
import { GithubWebhookRepository } from "./live-updates/github-webhook.repository";
import { GithubWebhooksClient } from "./live-updates/github-webhooks.client";
import { GithubAccountController } from "./pull-requests/github-account.controller";
import { GithubPictureAddresses } from "./pull-requests/github-picture-addresses";
import { GithubPicturesController } from "./pull-requests/github-pictures.controller";
import { GithubCommentPicturesService } from "./pull-requests/github-comment-pictures.service";
import { GithubRepositoryFilesClient } from "./pull-requests/github-repository-files.client";
import { GithubAccountLinkRepository } from "./pull-requests/github-account-link.repository";
import { GithubContentEditsController } from "./pull-requests/github-content-edits.controller";
import { GithubCredentialCipher } from "./pull-requests/github-credential.cipher";
import { GithubCredentialsService } from "./pull-requests/github-credentials.service";
import { GithubPullRequestCache } from "./pull-requests/github-pull-request.cache";
import { GithubPullRequestClient } from "./pull-requests/github-pull-request.client";
import { GithubPullRequestsController } from "./pull-requests/github-pull-requests.controller";
import { GithubPullRequestsService } from "./pull-requests/github-pull-requests.service";

/**
 * GitHub: read-only contributions of the configured repositories with the
 * server's token (docs/technical/github-contributions.md, ADR 045), and pull
 * requests with each admin's own linked token (ADR 052). One transport sends
 * every request to GitHub. Live updates (webhooks → SSE) are in `live-updates/`.
 */
@Module({
	imports: [FilesModule],
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
		GithubHttpTransport,
		GithubApiClient,
		GithubContributionsService,
		GithubPullRequestClient,
		GithubCredentialCipher,
		GithubAccountLinkRepository,
		GithubPullRequestCache,
		GithubCredentialsService,
		GithubPullRequestsService,
		GithubPictureAddresses,
		GithubRepositoryFilesClient,
		GithubCommentPicturesService,
		GithubWebhooksClient,
		GithubWebhookRepository,
		GithubPullRequestChangesHub,
		GithubLiveUpdatesService,
		GithubRepositoryVisibleGuard,
		GithubWebhookDeliveryRetention,
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
