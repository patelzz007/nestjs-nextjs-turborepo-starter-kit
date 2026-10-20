import { Inject, Injectable } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { GithubComment } from "@workspace/shared";

import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import type { GithubPullRequestCachePort } from "../../ports/github-pull-request-cache.port";
import type { GithubPullRequestWritesPort } from "../../ports/github-pull-requests.port";
import { GITHUB_PULL_REQUEST_CACHE, GITHUB_PULL_REQUEST_WRITES } from "../../ports/github.tokens";
import { GithubCommentPictures } from "../../services/github-comment-pictures";
import { githubUserIdOf } from "../../github-user-actor";
import { CommentOnPullRequestCommand } from "./comment-on-pull-request.command";

@Injectable()
@CommandHandler(CommentOnPullRequestCommand)
export class CommentOnPullRequestHandler implements ICommandHandler<CommentOnPullRequestCommand, GithubComment> {
	public constructor(
		private readonly credentials: GithubLinkedCredentials,
		@Inject(GITHUB_PULL_REQUEST_WRITES) private readonly writes: GithubPullRequestWritesPort,
		@Inject(GITHUB_PULL_REQUEST_CACHE) private readonly cache: GithubPullRequestCachePort,
		private readonly pictures: GithubCommentPictures,
	) {}

	public async execute(command: CommentOnPullRequestCommand): Promise<GithubComment> {
		const { actor, input } = command;
		const userId = githubUserIdOf(actor);
		const comment = await this.credentials.withCredential(actor, async (linked): Promise<GithubComment> => {
			await this.pictures.commitLinkedPictures(linked, userId, input.params, input.comment.body);
			return this.writes.addComment(linked, input.params, input.comment.body);
		});
		this.cache.invalidatePullRequest(input.params.owner, input.params.repository, input.params.number);
		return comment;
	}
}
