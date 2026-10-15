import { Controller, Delete, Get, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { apiContract, apiPath, GithubAccountStatusSchema, type GithubAccountStatus, type LinkGithubAccountInput } from "@workspace/shared";

import { ZodBody } from "../../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { AdminAccessOnly } from "../../auth/decorators/admin-access.decorator";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { GithubCredentialsService } from "./github-credentials.service";

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
	public constructor(private readonly credentials: GithubCredentialsService) {}

	@RequirePermission("READ", "GITHUB_PULL_REQUEST")
	@Get()
	@ApiOperation({
		summary: "Your GitHub link",
		description:
			"`off` when this server has no GITHUB_CREDENTIAL_ENCRYPTION_KEYS (pull requests are not set up), `unlinked` before you link a token, otherwise the account your token belongs to — never the token.",
	})
	@ZodResponse(GithubAccountStatusSchema, { description: "Your GitHub link" })
	public async status(@GetUser("sub") userId: string): Promise<GithubAccountStatus> {
		return this.credentials.status(userId);
	}

	@RequirePermission("UPDATE", "GITHUB_PULL_REQUEST")
	@Put()
	@ApiOperation({
		summary: "Link (or replace) your fine-grained GitHub token",
		description:
			"GitHub is asked who the token belongs to and when it expires before it is stored, encrypted. Needs Pull requests (read and write), Contents (read) and Metadata (read); add Webhooks (read and write) for live updates. 400 GITHUB_TOKEN_INVALID when GitHub refuses the token; 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for it.",
	})
	@ZodResponse(GithubAccountStatusSchema, { description: "The linked account" })
	public async link(@GetUser("sub") userId: string, @ZodBody(apiContract.githubPullRequests.linkAccount.input) body: LinkGithubAccountInput): Promise<GithubAccountStatus> {
		return this.credentials.link(userId, body.personalAccessToken);
	}

	@RequirePermission("UPDATE", "GITHUB_PULL_REQUEST")
	@Delete()
	@ApiOperation({ summary: "Forget your GitHub token", description: "The token is wiped; nothing about your pull requests is stored to begin with." })
	@ZodResponse(GithubAccountStatusSchema, { description: "`unlinked`" })
	public async unlink(@GetUser("sub") userId: string): Promise<GithubAccountStatus> {
		return this.credentials.unlink(userId);
	}
}
