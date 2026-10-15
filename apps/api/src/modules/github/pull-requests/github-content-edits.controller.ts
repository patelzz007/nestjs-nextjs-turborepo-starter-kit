import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { apiPath, GithubContentEditHistorySchema, GithubContentEditParamsSchema, type GithubContentEditHistory, type GithubContentEditParams } from "@workspace/shared";

import { ZodParams } from "../../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { AdminAccessOnly } from "../../auth/decorators/admin-access.decorator";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { PULL_REQUEST_READ_ERRORS } from "./github-pull-requests.api-docs";
import { GithubPullRequestsService } from "./github-pull-requests.service";

/** Edit histories of comments, reviews and descriptions, by GitHub node id. Same access as reading pull requests. */
@ApiTags("GitHub pull requests")
@ApiBearerAuth()
@AdminAccessOnly("Admin access required for GitHub pull requests.")
@Controller(apiPath("/github/content-edits"))
export class GithubContentEditsController {
	public constructor(private readonly pullRequests: GithubPullRequestsService) {}

	@RequirePermission("READ", "GITHUB_PULL_REQUEST")
	@Get(":nodeId")
	@ApiOperation({
		summary: "Every saved version of a comment, review or pull request description",
		description: `Newest first; the last entry is the original. A version GitHub removed from the history has no text. ${PULL_REQUEST_READ_ERRORS}`,
	})
	@ZodResponse(GithubContentEditHistorySchema, { description: "The saved versions" })
	public async contentEdits(@GetUser("sub") userId: string, @ZodParams(GithubContentEditParamsSchema) params: GithubContentEditParams): Promise<GithubContentEditHistory> {
		return this.pullRequests.contentEdits(userId, params.nodeId);
	}
}
