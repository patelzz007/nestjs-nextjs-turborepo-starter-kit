import { Controller, Delete, Get, Inject, Put, Sse, UseGuards, type MessageEvent } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { apiPath, GithubLiveUpdatesParamsSchema, GithubLiveUpdatesStatusSchema, type GithubLiveUpdatesParams, type GithubLiveUpdatesStatus } from "@workspace/shared";
import { filter, interval, map, merge, type Observable } from "rxjs";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { ApiEventStreamResponse } from "../../../../platform/presentation/http/validation/decorators/api-event-stream.decorator";
import { ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { PULL_REQUEST_READ_ERRORS, PULL_REQUEST_WRITE_ERRORS } from "./github-pull-requests.api-docs";
import { DisableLiveUpdatesCommand } from "../../application/commands/disable-live-updates/disable-live-updates.command";
import { EnableLiveUpdatesCommand } from "../../application/commands/enable-live-updates/enable-live-updates.command";
import type { GithubChangeSignal, GithubChangeSignalsPort } from "../../application/ports/github-live-updates.port";
import { GITHUB_CHANGE_SIGNALS } from "../../application/ports/github.tokens";
import { GetLiveUpdatesStatusQuery } from "../../application/queries/get-live-updates-status/get-live-updates-status.query";
import { isChangeOfRepository } from "../../domain/policies/webhook-delivery.policy";
import { GithubRepositoryVisibleGuard } from "./github-repository-visible.guard";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";

/** A frame now and then keeps proxies from closing a quiet stream. */
export const GITHUB_LIVE_UPDATES_KEEPALIVE_MS = 25_000;

/**
 * Live pull-request updates per repository (ADR 052): whether they are on,
 * turning them on and off (the webhook is registered and deleted on GitHub with
 * the caller's token — "Webhooks: Read and write"), and the stream of one
 * repository's changes. Same access as reading and writing pull requests.
 */
@ApiTags("GitHub pull requests")
@ApiBearerAuth()
@AdminAccessOnly("Admin access required for GitHub pull requests.")
@Controller(apiPath("/github/live-updates"))
export class GithubLiveUpdatesController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
		@Inject(GITHUB_CHANGE_SIGNALS) private readonly changes: GithubChangeSignalsPort,
	) {}

	@RequirePermission("READ", "GITHUB_PULL_REQUEST")
	@Get(":owner/:repository")
	@ApiOperation({ summary: "Whether a repository's pull requests update live", description: "`off`: this server receives no webhooks; `disabled`; `enabled`." })
	@ZodResponse(GithubLiveUpdatesStatusSchema, { description: "Live updates of the repository" })
	public async status(@CurrentActor() actor: ActorContext, @ZodParams(GithubLiveUpdatesParamsSchema) params: GithubLiveUpdatesParams): Promise<GithubLiveUpdatesStatus> {
		return this.queryBus.execute(new GetLiveUpdatesStatusQuery(actor, params));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "GITHUB_PULL_REQUEST")
	@Put(":owner/:repository")
	@ApiOperation({
		summary: "Turn a repository's live updates on",
		description: `Registers a webhook on the repository with your token (it needs "Webhooks: Read and write"). Already on changes nothing, so a retry is safe without an Idempotency-Key. 503 \`GITHUB_LIVE_UPDATES_OFF\` when this server receives no webhooks. ${PULL_REQUEST_WRITE_ERRORS}${PULL_REQUEST_READ_ERRORS}`,
	})
	@ZodResponse(GithubLiveUpdatesStatusSchema, { description: "Live updates are on" })
	public async enable(@CurrentActor() actor: ActorContext, @ZodParams(GithubLiveUpdatesParamsSchema) params: GithubLiveUpdatesParams): Promise<GithubLiveUpdatesStatus> {
		return this.commandBus.execute(new EnableLiveUpdatesCommand(actor, params));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "GITHUB_PULL_REQUEST")
	@Delete(":owner/:repository")
	@ApiOperation({
		summary: "Turn a repository's live updates off",
		description: `Deletes its webhook on GitHub with your token. Already off changes nothing. ${PULL_REQUEST_WRITE_ERRORS}${PULL_REQUEST_READ_ERRORS}`,
	})
	@ZodResponse(GithubLiveUpdatesStatusSchema, { description: "Live updates are off" })
	public async disable(@CurrentActor() actor: ActorContext, @ZodParams(GithubLiveUpdatesParamsSchema) params: GithubLiveUpdatesParams): Promise<GithubLiveUpdatesStatus> {
		return this.commandBus.execute(new DisableLiveUpdatesCommand(actor, params));
	}

	/**
	 * One repository's changes, as they happen. Opened only when your token can
	 * see the repository (404 otherwise). A frame names the pull request that
	 * changed — `{ owner, repository, number }` — never its content: the app
	 * reloads it with its own reads. A `resync` frame says changes may have been
	 * missed (the server's listener reconnected): reload what is shown.
	 */
	@RequirePermission("READ", "GITHUB_PULL_REQUEST")
	@UseGuards(GithubRepositoryVisibleGuard)
	@Sse(":owner/:repository/events")
	@ApiOperation({ summary: "One repository's pull-request changes, live (SSE)" })
	@ApiEventStreamResponse(
		"A `{ owner, repository, number }` frame per change, `resync` when changes may have been missed, a `ping` every 25 s (no envelope, no response contract)",
	)
	public stream(@ZodParams(GithubLiveUpdatesParamsSchema) params: GithubLiveUpdatesParams): Observable<MessageEvent> {
		return merge(
			this.changes.observe().pipe(
				// The repository's own changes (names compared without case), and every resync.
				filter((signal: GithubChangeSignal): boolean => signal.kind === "resync" || isChangeOfRepository(signal.change, params)),
				map((signal: GithubChangeSignal): MessageEvent => (signal.kind === "change" ? { data: signal.change } : { type: "resync", data: "" })),
			),
			interval(GITHUB_LIVE_UPDATES_KEEPALIVE_MS).pipe(map((): MessageEvent => ({ type: "ping", data: "" }))),
		);
	}
}
