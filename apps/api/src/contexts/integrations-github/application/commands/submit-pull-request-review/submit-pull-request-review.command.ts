import { Command } from "@nestjs/cqrs";
import type { GithubPullRequestParams, GithubReview, SubmitGithubPullRequestReviewInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The pull request and what to write on it. */
export interface SubmitPullRequestReviewInput {
	readonly params: GithubPullRequestParams;
	readonly review: SubmitGithubPullRequestReviewInput;
}

/** Submits a review as the caller's GitHub account (its linked pictures committed first) — GitHub enforces who may approve; then drops the cached views. */
export class SubmitPullRequestReviewCommand extends Command<GithubReview> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: SubmitPullRequestReviewInput,
	) {
		super();
	}
}
