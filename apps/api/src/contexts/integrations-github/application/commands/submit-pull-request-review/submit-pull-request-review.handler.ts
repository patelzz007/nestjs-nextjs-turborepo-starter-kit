import { Inject, Injectable } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { GithubReview } from "@workspace/shared";

import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import type { GithubPullRequestCachePort } from "../../ports/github-pull-request-cache.port";
import type { GithubPullRequestWritesPort } from "../../ports/github-pull-requests.port";
import { GITHUB_PULL_REQUEST_CACHE, GITHUB_PULL_REQUEST_WRITES } from "../../ports/github.tokens";
import { GithubCommentPictures } from "../../services/github-comment-pictures";
import { githubUserIdOf } from "../../github-user-actor";
import { SubmitPullRequestReviewCommand } from "./submit-pull-request-review.command";

@Injectable()
@CommandHandler(SubmitPullRequestReviewCommand)
export class SubmitPullRequestReviewHandler implements ICommandHandler<SubmitPullRequestReviewCommand, GithubReview> {
	public constructor(
		private readonly credentials: GithubLinkedCredentials,
		@Inject(GITHUB_PULL_REQUEST_WRITES) private readonly writes: GithubPullRequestWritesPort,
		@Inject(GITHUB_PULL_REQUEST_CACHE) private readonly cache: GithubPullRequestCachePort,
		private readonly pictures: GithubCommentPictures,
	) {}

	public async execute(command: SubmitPullRequestReviewCommand): Promise<GithubReview> {
		const { actor, input } = command;
		const userId = githubUserIdOf(actor);
		const review = await this.credentials.withCredential(actor, async (linked): Promise<GithubReview> => {
			await this.pictures.commitLinkedPictures(linked, userId, input.params, input.review.body);
			return this.writes.submitReview(linked, input.params, input.review.event, input.review.body);
		});
		this.cache.invalidatePullRequest(input.params.owner, input.params.repository, input.params.number);
		return review;
	}
}
