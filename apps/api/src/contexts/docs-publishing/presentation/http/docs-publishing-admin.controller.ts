import { Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiContract,
	apiPath,
	DocsSyncOverviewSchema,
	DocsSyncRunDetailSchema,
	DocsSyncRunSummarySchema,
	DocsSyncStartedSchema,
	DocsWebhookHandshakeSchema,
	type DocsSyncOverview,
	type DocsSyncRunDetail,
	type DocsSyncRunIdParam,
	type DocsSyncRunListQuery,
	type DocsSyncRunSummary,
	type DocsSyncStarted,
	type DocsWebhookHandshake,
	type PaginatedServiceResult,
	type StartDocsSync,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { RevealDocsWebhookHandshakeCommand } from "../../application/commands/reveal-docs-webhook-handshake/reveal-docs-webhook-handshake.command";
import { StartDocsSyncCommand } from "../../application/commands/start-docs-sync/start-docs-sync.command";
import { DOCS_PUBLISHING_READ_OPERATION } from "../../application/ports/docs-publishing.ports";
import { GetDocsSyncOverviewQuery, GetDocsSyncRunQuery, ListDocsSyncRunsQuery } from "../../application/queries/docs-sync.queries";

/**
 * The Operations console's Docs sync page (ADR 084). Admin-panel access AND the `DOCS_SYNC` permission: `LIST` to
 * see runs, `CREATE` to start one, `READ` for the verification token. The controller validates and dispatches.
 */
@ApiTags("Docs publishing")
@AdminAccessOnly("Admin access required for docs publishing.")
@PlatformOperation(DOCS_PUBLISHING_READ_OPERATION)
@Controller(apiPath("/admin/docs-publishing"))
export class DocsPublishingAdminController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@RequirePermission("LIST", "DOCS_SYNC")
	@Get("overview")
	@ApiOperation({ summary: "What is set up, and how the latest sync went" })
	@ZodResponse(DocsSyncOverviewSchema, { description: "The overview" })
	public overview(@CurrentActor() actor: ActorContext): Promise<DocsSyncOverview> {
		return this.queryBus.execute(new GetDocsSyncOverviewQuery(actor));
	}

	@RequirePermission("LIST", "DOCS_SYNC")
	@Get("runs")
	@ApiOperation({ summary: "List docs sync runs (newest first)" })
	@ZodPaginatedResponse(DocsSyncRunSummarySchema, { description: "Paginated runs; pagination is in `meta`" })
	public runs(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.docsPublishing.runs.input) query: DocsSyncRunListQuery,
	): Promise<PaginatedServiceResult<DocsSyncRunSummary>> {
		return this.queryBus.execute(new ListDocsSyncRunsQuery(actor, query));
	}

	@RequirePermission("LIST", "DOCS_SYNC")
	@Get("runs/:id")
	@ApiOperation({ summary: "Get one docs sync run with its held-back pages" })
	@ZodResponse(DocsSyncRunDetailSchema, { description: "The run" })
	public run(@CurrentActor() actor: ActorContext, @ZodParams(apiContract.docsPublishing.run.input) params: DocsSyncRunIdParam): Promise<DocsSyncRunDetail> {
		return this.queryBus.execute(new GetDocsSyncRunQuery(actor, params));
	}

	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("CREATE", "DOCS_SYNC")
	@Post("sync")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Start a docs sync now" })
	@ZodResponse(DocsSyncStartedSchema, { description: "GitHub accepted the request" })
	public startSync(@CurrentActor() actor: ActorContext, @ZodBody(apiContract.docsPublishing.startSync.input) input: StartDocsSync): Promise<DocsSyncStarted> {
		return this.commandBus.execute(new StartDocsSyncCommand(actor, input));
	}

	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("READ", "DOCS_SYNC")
	@Post("webhook-handshake/reveal")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Show the waiting webhook verification token", description: "A POST so that reading a secret is audited." })
	@ZodResponse(DocsWebhookHandshakeSchema, { description: "The token" })
	public revealHandshake(@CurrentActor() actor: ActorContext): Promise<DocsWebhookHandshake> {
		return this.commandBus.execute(new RevealDocsWebhookHandshakeCommand(actor));
	}
}
