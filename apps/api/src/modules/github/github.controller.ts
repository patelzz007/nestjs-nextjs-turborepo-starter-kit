import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	GithubCommitHistoryQuerySchema,
	GithubCommitPageSchema,
	GithubContributorStatsSchema,
	GithubRepositoryListSchema,
	GithubRepositoryParamsSchema,
	GithubRepositorySummarySchema,
	type GithubCommitHistoryQuery,
	type GithubCommitPage,
	type GithubContributorStats,
	type GithubRepositoryList,
	type GithubRepositoryParams,
	type GithubRepositorySummary,
} from "@workspace/shared";

import { ZodParams, ZodQuery } from "../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../common/decorators/zod-response.decorators";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import { GithubContributionsService } from "./github-contributions.service";

/**
 * Read-only contributions of the GitHub repositories the API may read —
 * pinned by `GITHUB_REPOSITORIES`, or discovered from the token's account.
 *
 * Authorization (every route): `READ:GITHUB` (granted to every platform role,
 * docs/technical/github-contributions.md). No ownership, tenant or RLS scope:
 * the repositories are platform configuration, the same for every caller, and
 * nothing is read from the database. A repository outside `GITHUB_REPOSITORIES`
 * (or not discovered) is a 404. Read-only, so no audit entry.
 */
/** The failures every GitHub-backed read can answer with, beyond the standard 401 / 403 / 429. */
const GITHUB_READ_ERRORS =
	"404 NOT_FOUND when the repository is not in the list (GET /github/repositories), or GitHub no longer shows it to the API's token. " +
	"503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting the token, and 502 EXTERNAL_SERVICE_ERROR when it answers with an error — " +
	"both only when no earlier answer (up to an hour past its cache lifetime) can be served instead.";

@ApiTags("GitHub")
@ApiBearerAuth()
@Controller(apiPath("/github/repositories"))
export class GithubController {
	public constructor(private readonly contributions: GithubContributionsService) {}

	@RequirePermission("READ", "GITHUB")
	@Get()
	@ApiOperation({
		summary: "List the GitHub repositories the API may read",
		description:
			"`configured`: the ones pinned in GITHUB_REPOSITORIES, in that order. `discovered` (GITHUB_REPOSITORIES empty): the token account's own public repositories (no forks) and the public repositories it recently contributed to, most recently pushed first. `off`: no GITHUB_TOKEN, an empty list. Discovery reads GitHub: 503 SERVICE_UNAVAILABLE / 502 EXTERNAL_SERVICE_ERROR when it fails and no earlier list can be served.",
	})
	@ZodResponse(GithubRepositoryListSchema, { description: "The repositories the API may read (empty when the integration is off)" })
	public async listRepositories(): Promise<GithubRepositoryList> {
		return this.contributions.listRepositories();
	}

	@RequirePermission("READ", "GITHUB")
	@Get(":owner/:repository")
	@ApiOperation({ summary: "Summary of a configured repository: stars, forks, languages, commit count, last push", description: GITHUB_READ_ERRORS })
	@ZodResponse(GithubRepositorySummarySchema, { description: "Repository summary" })
	public async getRepositorySummary(@ZodParams(GithubRepositoryParamsSchema) params: GithubRepositoryParams): Promise<GithubRepositorySummary> {
		return this.contributions.getRepositorySummary(params);
	}

	@RequirePermission("READ", "GITHUB")
	@Get(":owner/:repository/commits")
	@ApiOperation({
		summary: "One page of a configured repository's commit history with lines added/deleted per commit",
		description: `Newest first; pass \`nextCursor\` back as \`cursor\` for the next (older) page. ${GITHUB_READ_ERRORS}`,
	})
	@ZodResponse(GithubCommitPageSchema, { description: "Commits, newest first, and the cursor of the next page" })
	public async getCommitPage(
		@ZodParams(GithubRepositoryParamsSchema) params: GithubRepositoryParams,
		@ZodQuery(GithubCommitHistoryQuerySchema) query: GithubCommitHistoryQuery,
	): Promise<GithubCommitPage> {
		return this.contributions.getCommitPage(params, query);
	}

	@RequirePermission("READ", "GITHUB")
	@Get(":owner/:repository/contributors")
	@ApiOperation({
		summary: "Commits and lines added/deleted per contributor of a configured repository",
		description: `GitHub computes these in the background: \`{ status: "computing" }\` means ask again in a few seconds. ${GITHUB_READ_ERRORS}`,
	})
	@ZodResponse(GithubContributorStatsSchema, { description: "Contributor totals, or `computing` while GitHub prepares them" })
	public async getContributorStats(@ZodParams(GithubRepositoryParamsSchema) params: GithubRepositoryParams): Promise<GithubContributorStats> {
		return this.contributions.getContributorStats(params);
	}
}
