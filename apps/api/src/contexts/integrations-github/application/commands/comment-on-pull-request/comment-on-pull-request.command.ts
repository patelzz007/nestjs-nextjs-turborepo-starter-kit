import { Command } from "@nestjs/cqrs";
import type { AddGithubPullRequestCommentInput, GithubComment, GithubPullRequestParams } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The pull request and what to write on it. */
export interface CommentOnPullRequestInput {
	readonly params: GithubPullRequestParams;
	readonly comment: AddGithubPullRequestCommentInput;
}

/** Comments on the conversation as the caller's GitHub account, committing the pictures it links first. Never retried here (a retry is the client's, with its Idempotency-Key); every cached view of the pull request is dropped. */
export class CommentOnPullRequestCommand extends Command<GithubComment> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CommentOnPullRequestInput,
	) {
		super();
	}
}
