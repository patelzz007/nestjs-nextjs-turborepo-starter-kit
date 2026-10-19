import { Controller, Get } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { apiPath, GithubContentEditHistorySchema, GithubContentEditParamsSchema, type GithubContentEditHistory, type GithubContentEditParams } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { PULL_REQUEST_READ_ERRORS } from "./github-pull-requests.api-docs";
import { GetContentEditHistoryQuery } from "../../application/queries/get-content-edit-history/get-content-edit-history.query";

/** Edit histories of comments, reviews and descriptions, by GitHub node id. Same access as reading pull requests. */
@ApiTags("GitHub pull requests")
@ApiBearerAuth()
@AdminAccessOnly("Admin access required for GitHub pull requests.")
@Controller(apiPath("/github/content-edits"))
export class GithubContentEditsController {
	public constructor(private readonly queryBus: QueryBus) {}

	@RequirePermission("READ", "GITHUB_PULL_REQUEST")
	@Get(":nodeId")
	@ApiOperation({
		summary: "Every saved version of a comment, review or pull request description",
		description: `Newest first; the last entry is the original. A version GitHub removed from the history has no text. ${PULL_REQUEST_READ_ERRORS}`,
	})
	@ZodResponse(GithubContentEditHistorySchema, { description: "The saved versions" })
	public async contentEdits(
		@CurrentActor() actor: ActorContext,
		@ZodParams(GithubContentEditParamsSchema) params: GithubContentEditParams,
	): Promise<GithubContentEditHistory> {
		return this.queryBus.execute(new GetContentEditHistoryQuery(actor, params));
	}
}
