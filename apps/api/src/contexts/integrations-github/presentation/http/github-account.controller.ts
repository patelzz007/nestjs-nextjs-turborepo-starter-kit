import { Controller, Delete, Get, Put } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { apiContract, apiPath, GithubAccountStatusSchema, type GithubAccountStatus, type LinkGithubAccountInput } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { ZodBody } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { LinkGithubAccountCommand } from "../../application/commands/link-github-account/link-github-account.command";
import { UnlinkGithubAccountCommand } from "../../application/commands/unlink-github-account/unlink-github-account.command";
import { GetGithubAccountStatusQuery } from "../../application/queries/get-github-account-status/get-github-account-status.query";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";

/**
 * The caller's own GitHub token (ADR 052). Admin panel access plus
 * `READ:GITHUB_PULL_REQUEST` to see the link, `UPDATE:GITHUB_PULL_REQUEST` to
 * change it. Every row is the caller's own (RLS `app_owns(user_id)`); the
 * token is never returned and is redacted from the HTTP audit log.
 */
@ApiTags("GitHub pull requests")
@ApiBearerAuth()
@AdminAccessOnly("Admin access required for GitHub pull requests.")
@Controller(apiPath("/github/account"))
export class GithubAccountController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@RequirePermission("READ", "GITHUB_PULL_REQUEST")
	@Get()
	@ApiOperation({
		summary: "Your GitHub link",
		description:
			"`off` when this server has no GITHUB_CREDENTIAL_ENCRYPTION_KEYS (pull requests are not set up), `unlinked` before you link a token, otherwise the account your token belongs to — never the token.",
	})
	@ZodResponse(GithubAccountStatusSchema, { description: "Your GitHub link" })
	public async status(@CurrentActor() actor: ActorContext): Promise<GithubAccountStatus> {
		return this.queryBus.execute(new GetGithubAccountStatusQuery(actor));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "GITHUB_PULL_REQUEST")
	@Put()
	@ApiOperation({
		summary: "Link (or replace) your fine-grained GitHub token",
		description:
			"GitHub is asked who the token belongs to and when it expires before it is stored, encrypted. Needs Pull requests (read and write), Contents (read) and Metadata (read); add Webhooks (read and write) for live updates. 400 GITHUB_TOKEN_INVALID when GitHub refuses the token; 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for it.",
	})
	@ZodResponse(GithubAccountStatusSchema, { description: "The linked account" })
	public async link(
		@CurrentActor() actor: ActorContext,
		@ZodBody(apiContract.githubPullRequests.linkAccount.input) body: LinkGithubAccountInput,
	): Promise<GithubAccountStatus> {
		return this.commandBus.execute(new LinkGithubAccountCommand(actor, body));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "GITHUB_PULL_REQUEST")
	@Delete()
	@ApiOperation({ summary: "Forget your GitHub token", description: "The token is wiped; nothing about your pull requests is stored to begin with." })
	@ZodResponse(GithubAccountStatusSchema, { description: "`unlinked`" })
	public async unlink(@CurrentActor() actor: ActorContext): Promise<GithubAccountStatus> {
		return this.commandBus.execute(new UnlinkGithubAccountCommand(actor));
	}
}
