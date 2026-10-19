import { Controller, Get, HttpStatus, Post, Put } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	AddGithubPullRequestCommentSchema,
	apiPath,
	GithubCommentSchema,
	GithubCommitDetailSchema,
	GithubCursorQuerySchema,
	GithubPullRequestCommitPageSchema,
	GithubPullRequestDetailSchema,
	GithubPullRequestFilePageSchema,
	GithubPullRequestFilesQuerySchema,
	GithubPullRequestListQuerySchema,
	GithubPullRequestPageSchema,
	GithubPullRequestCommitParamsSchema,
	GithubPullRequestParamsSchema,
	GithubPullRequestStatusSchema,
	GithubReviewSchema,
	GithubReviewThreadListSchema,
	GithubTimelinePageSchema,
	SubmitGithubPullRequestReviewSchema,
	type AddGithubPullRequestCommentInput,
	type GithubComment,
	type GithubCommitDetail,
	type GithubCursorQuery,
	type GithubPullRequestCommitPage,
	type GithubPullRequestDetail,
	type GithubPullRequestFilePage,
	type GithubPullRequestFilesQuery,
	type GithubPullRequestListQuery,
	type GithubPullRequestPage,
	type GithubPullRequestCommitParams,
	type GithubPullRequestParams,
	type GithubPullRequestStatus,
	type GithubReview,
	type GithubReviewThreadList,
	type GithubTimelinePage,
	type SubmitGithubPullRequestReviewInput,
	SetGithubReactionSchema,
	GithubReactionStateSchema,
	AttachGithubCommentPictureSchema,
	GithubMergeResultSchema,
	MergeGithubPullRequestSchema,
	type GithubMergeResult,
	type MergeGithubPullRequestInput,
	GITHUB_COMMENT_ASSETS_BRANCH,
	GithubCommentPictureSchema,
	type AttachGithubCommentPictureInput,
	type GithubCommentPicture,
	type SetGithubReactionInput,
	type GithubReactionState,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { ZodBody, ZodParams, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { Idempotent } from "../../../../platform/presentation/http/idempotency/idempotent.decorator";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { PULL_REQUEST_READ_ERRORS, PULL_REQUEST_WRITE_ERRORS } from "./github-pull-requests.api-docs";
import { AttachPullRequestPictureCommand } from "../../application/commands/attach-pull-request-picture/attach-pull-request-picture.command";
import { CommentOnPullRequestCommand } from "../../application/commands/comment-on-pull-request/comment-on-pull-request.command";
import { MergePullRequestCommand } from "../../application/commands/merge-pull-request/merge-pull-request.command";
import { SetPullRequestReactionCommand } from "../../application/commands/set-pull-request-reaction/set-pull-request-reaction.command";
import { SubmitPullRequestReviewCommand } from "../../application/commands/submit-pull-request-review/submit-pull-request-review.command";
import { GetPullRequestCommitQuery } from "../../application/queries/get-pull-request-commit/get-pull-request-commit.query";
import { GetPullRequestCommitsQuery } from "../../application/queries/get-pull-request-commits/get-pull-request-commits.query";
import { GetPullRequestDetailQuery } from "../../application/queries/get-pull-request-detail/get-pull-request-detail.query";
import { GetPullRequestFilesQuery } from "../../application/queries/get-pull-request-files/get-pull-request-files.query";
import { GetPullRequestReviewThreadsQuery } from "../../application/queries/get-pull-request-review-threads/get-pull-request-review-threads.query";
import { GetPullRequestStatusQuery } from "../../application/queries/get-pull-request-status/get-pull-request-status.query";
import { GetPullRequestTimelineQuery } from "../../application/queries/get-pull-request-timeline/get-pull-request-timeline.query";
import { ListPullRequestsQuery } from "../../application/queries/list-pull-requests/list-pull-requests.query";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";

/**
 * Pull requests read with the caller's own linked token (ADR 052): GitHub
 * decides what each admin sees. Admin panel access plus
 * `READ:GITHUB_PULL_REQUEST` to read, `UPDATE:GITHUB_PULL_REQUEST` to comment
 * or review. Nothing is read from the database except the caller's own link.
 * Reads are not audited (GitHub is the record); writes are, like every
 * state-changing request, and must carry an Idempotency-Key.
 */
@ApiTags("GitHub pull requests")
@ApiBearerAuth()
@AdminAccessOnly("Admin access required for GitHub pull requests.")
@Controller(apiPath("/github/pull-requests"))
export class GithubPullRequestsController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@RequirePermission("READ", "GITHUB_PULL_REQUEST")
	@Get()
	@ApiOperation({
		summary: "One page of your pull requests",
		description: `\`filter\`: \`yours\` (in repositories your GitHub account owns), \`created\`, \`reviewRequested\`, \`assigned\`, \`mentioned\`; \`state\`: open or closed. Most recently updated first. ${PULL_REQUEST_READ_ERRORS}`,
	})
	@ZodResponse(GithubPullRequestPageSchema, { description: "Pull requests and the cursor of the next page" })
	public async list(@CurrentActor() actor: ActorContext, @ZodQuery(GithubPullRequestListQuerySchema) query: GithubPullRequestListQuery): Promise<GithubPullRequestPage> {
		return this.queryBus.execute(new ListPullRequestsQuery(actor, query));
	}

	@RequirePermission("READ", "GITHUB_PULL_REQUEST")
	@Get(":owner/:repository/:number")
	@ApiOperation({ summary: "One pull request with the first page of its conversation", description: PULL_REQUEST_READ_ERRORS })
	@ZodResponse(GithubPullRequestDetailSchema, { description: "The pull request" })
	public async detail(@CurrentActor() actor: ActorContext, @ZodParams(GithubPullRequestParamsSchema) params: GithubPullRequestParams): Promise<GithubPullRequestDetail> {
		return this.queryBus.execute(new GetPullRequestDetailQuery(actor, params));
	}

	@RequirePermission("READ", "GITHUB_PULL_REQUEST")
	@Get(":owner/:repository/:number/timeline")
	@ApiOperation({
		summary: "A later page of a pull request's conversation",
		description: `Pass the previous page's \`nextCursor\` as \`cursor\`. ${PULL_REQUEST_READ_ERRORS}`,
	})
	@ZodResponse(GithubTimelinePageSchema, { description: "Conversation entries, oldest first" })
	public async timeline(
		@CurrentActor() actor: ActorContext,
		@ZodParams(GithubPullRequestParamsSchema) params: GithubPullRequestParams,
		@ZodQuery(GithubCursorQuerySchema) query: GithubCursorQuery,
	): Promise<GithubTimelinePage> {
		return this.queryBus.execute(new GetPullRequestTimelineQuery(actor, { params, cursor: query.cursor }));
	}

	@RequirePermission("READ", "GITHUB_PULL_REQUEST")
	@Get(":owner/:repository/:number/commits")
	@ApiOperation({ summary: "A pull request's commits, oldest first", description: PULL_REQUEST_READ_ERRORS })
	@ZodResponse(GithubPullRequestCommitPageSchema, { description: "Commits and the cursor of the next page" })
	public async commits(
		@CurrentActor() actor: ActorContext,
		@ZodParams(GithubPullRequestParamsSchema) params: GithubPullRequestParams,
		@ZodQuery(GithubCursorQuerySchema) query: GithubCursorQuery,
	): Promise<GithubPullRequestCommitPage> {
		return this.queryBus.execute(new GetPullRequestCommitsQuery(actor, { params, cursor: query.cursor }));
	}

	@RequirePermission("READ", "GITHUB_PULL_REQUEST")
	@Get(":owner/:repository/:number/status")
	@ApiOperation({
		summary: "A pull request's merge box: checks and conflicts",
		description: `The head commit's checks as GitHub rolls them up (\`none\` without checks, \`unavailable\` when GitHub will not show them to your token) and whether the branch merges cleanly (\`unknown\` while GitHub works it out). ${PULL_REQUEST_READ_ERRORS}`,
	})
	@ZodResponse(GithubPullRequestStatusSchema, { description: "Checks and mergeability" })
	public async status(@CurrentActor() actor: ActorContext, @ZodParams(GithubPullRequestParamsSchema) params: GithubPullRequestParams): Promise<GithubPullRequestStatus> {
		return this.queryBus.execute(new GetPullRequestStatusQuery(actor, params));
	}

	@RequirePermission("READ", "GITHUB_PULL_REQUEST")
	@Get(":owner/:repository/:number/commits/:sha")
	@ApiOperation({
		summary: "One of a pull request's commits with its changed files and diffs",
		description: `Read with your own token, so any repository it can see. The first 100 files, with the same diff limits as the files page. ${PULL_REQUEST_READ_ERRORS}`,
	})
	@ZodResponse(GithubCommitDetailSchema, { description: "The commit and its diff" })
	public async commit(
		@CurrentActor() actor: ActorContext,
		@ZodParams(GithubPullRequestCommitParamsSchema) params: GithubPullRequestCommitParams,
	): Promise<GithubCommitDetail> {
		return this.queryBus.execute(new GetPullRequestCommitQuery(actor, params));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "GITHUB_PULL_REQUEST")
	@Idempotent({ required: true })
	@Post(":owner/:repository/:number/comments")
	@ApiOperation({ summary: "Comment on a pull request's conversation", description: `${PULL_REQUEST_WRITE_ERRORS}${PULL_REQUEST_READ_ERRORS}` })
	@ZodResponse(GithubCommentSchema, { status: HttpStatus.CREATED, description: "The comment, as GitHub saved it" })
	public async addComment(
		@CurrentActor() actor: ActorContext,
		@ZodParams(GithubPullRequestParamsSchema) params: GithubPullRequestParams,
		@ZodBody(AddGithubPullRequestCommentSchema) body: AddGithubPullRequestCommentInput,
	): Promise<GithubComment> {
		return this.commandBus.execute(new CommentOnPullRequestCommand(actor, { params, comment: body }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "GITHUB_PULL_REQUEST")
	@Idempotent({ required: true })
	@Post(":owner/:repository/:number/reviews")
	@ApiOperation({
		summary: "Review a pull request: comment, approve or request changes",
		description: `A summary is required to comment or request changes. ${PULL_REQUEST_WRITE_ERRORS}${PULL_REQUEST_READ_ERRORS}`,
	})
	@ZodResponse(GithubReviewSchema, { status: HttpStatus.CREATED, description: "The review, as GitHub saved it" })
	public async submitReview(
		@CurrentActor() actor: ActorContext,
		@ZodParams(GithubPullRequestParamsSchema) params: GithubPullRequestParams,
		@ZodBody(SubmitGithubPullRequestReviewSchema) body: SubmitGithubPullRequestReviewInput,
	): Promise<GithubReview> {
		return this.commandBus.execute(new SubmitPullRequestReviewCommand(actor, { params, review: body }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "GITHUB_PULL_REQUEST")
	@Idempotent({ required: true })
	@Post(":owner/:repository/:number/merge")
	@ApiOperation({
		summary: "Merge a pull request, and optionally delete its branch",
		description: `Merges as you (your token needs "Contents: Read and write") with \`merge\`, \`squash\` or \`rebase\` — whichever the repository allows — only if its head is still \`expectedHeadSha\`. GitHub's refusals (not mergeable, the head moved on, a rule such as required reviews) answer 409 \`GITHUB_WRITE_REJECTED\` with GitHub's reason. With \`deleteBranch\`, a branch of this repository is deleted afterwards; that never undoes the merge — \`branch.outcome\` says how it went. ${PULL_REQUEST_WRITE_ERRORS}${PULL_REQUEST_READ_ERRORS}`,
	})
	@ZodResponse(GithubMergeResultSchema, { status: HttpStatus.CREATED, description: "The merge commit, and what happened to the branch" })
	public async merge(
		@CurrentActor() actor: ActorContext,
		@ZodParams(GithubPullRequestParamsSchema) params: GithubPullRequestParams,
		@ZodBody(MergeGithubPullRequestSchema) body: MergeGithubPullRequestInput,
	): Promise<GithubMergeResult> {
		return this.commandBus.execute(new MergePullRequestCommand(actor, { params, merge: body }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "GITHUB_PULL_REQUEST")
	@Idempotent({ required: true })
	@Post(":owner/:repository/:number/pictures")
	@ApiOperation({
		summary: "Commit an uploaded picture to the repository, to link from a comment",
		description: `\`fileId\` is your own READY \`GITHUB_COMMENT_IMAGE\` upload (\`POST /files/upload-url\`). It is committed to the repository's \`${GITHUB_COMMENT_ASSETS_BRANCH}\` branch as you (your token needs "Contents: Read and write" there), and the upload is deleted. Link the answered \`url\` from the comment: GitHub shows it to whoever may read the repository. ${PULL_REQUEST_WRITE_ERRORS}${PULL_REQUEST_READ_ERRORS}`,
	})
	@ZodResponse(GithubCommentPictureSchema, { status: HttpStatus.CREATED, description: "Where the picture now is in the repository" })
	public async attachPicture(
		@CurrentActor() actor: ActorContext,
		@ZodParams(GithubPullRequestParamsSchema) params: GithubPullRequestParams,
		@ZodBody(AttachGithubCommentPictureSchema) body: AttachGithubCommentPictureInput,
	): Promise<GithubCommentPicture> {
		return this.commandBus.execute(new AttachPullRequestPictureCommand(actor, { params, picture: body }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "GITHUB_PULL_REQUEST")
	@Put(":owner/:repository/:number/reactions")
	@ApiOperation({
		summary: "Set your emoji reaction on a pull request or one of its comments, on or off",
		description: `The subject is the pull request, a conversation comment or a line comment (a review's summary takes no reactions from an API). Setting a reaction to what it already is changes nothing, so a retry needs no Idempotency-Key. ${PULL_REQUEST_WRITE_ERRORS}${PULL_REQUEST_READ_ERRORS}`,
	})
	@ZodResponse(GithubReactionStateSchema, { description: "The reaction as it now stands on GitHub" })
	public async setReaction(
		@CurrentActor() actor: ActorContext,
		@ZodParams(GithubPullRequestParamsSchema) params: GithubPullRequestParams,
		@ZodBody(SetGithubReactionSchema) body: SetGithubReactionInput,
	): Promise<GithubReactionState> {
		return this.commandBus.execute(new SetPullRequestReactionCommand(actor, { params, reaction: body }));
	}

	@RequirePermission("READ", "GITHUB_PULL_REQUEST")
	@Get(":owner/:repository/:number/files")
	@ApiOperation({
		summary: "One page of a pull request's changed files with their diffs",
		description: `100 files a page (GitHub lists at most 3,000). Same diff rules as a commit: a file's diff is \`too-large\` past 20,000 characters or once the page's diffs reach 200,000 together, \`unavailable\` when GitHub sends none. \`headSha\` is the commit the diffs belong to. ${PULL_REQUEST_READ_ERRORS}`,
	})
	@ZodResponse(GithubPullRequestFilePageSchema, { description: "Changed files and the next page number" })
	public async files(
		@CurrentActor() actor: ActorContext,
		@ZodParams(GithubPullRequestParamsSchema) params: GithubPullRequestParams,
		@ZodQuery(GithubPullRequestFilesQuerySchema) query: GithubPullRequestFilesQuery,
	): Promise<GithubPullRequestFilePage> {
		return this.queryBus.execute(new GetPullRequestFilesQuery(actor, { params, page: query.page }));
	}

	@RequirePermission("READ", "GITHUB_PULL_REQUEST")
	@Get(":owner/:repository/:number/review-threads")
	@ApiOperation({ summary: "The conversations on lines of a pull request's diff", description: `At most 100 threads of 50 comments each. ${PULL_REQUEST_READ_ERRORS}` })
	@ZodResponse(GithubReviewThreadListSchema, { description: "Line-comment threads" })
	public async reviewThreads(@CurrentActor() actor: ActorContext, @ZodParams(GithubPullRequestParamsSchema) params: GithubPullRequestParams): Promise<GithubReviewThreadList> {
		return this.queryBus.execute(new GetPullRequestReviewThreadsQuery(actor, params));
	}
}
