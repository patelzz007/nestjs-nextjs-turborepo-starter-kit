import { Command } from "@nestjs/cqrs";
import type { GithubMergeResult, GithubPullRequestParams, MergeGithubPullRequestInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The pull request and what to write on it. */
export interface MergePullRequestInput {
	readonly params: GithubPullRequestParams;
	readonly merge: MergeGithubPullRequestInput;
}

/** Merges as the caller's account, pinned to the head commit they saw (GitHub refuses when it moved on), then — when asked, and the branch is this repository's — deletes the branch. The deletion never undoes the merge: a failure is reported with GitHub's reason. Drops every cached view. */
export class MergePullRequestCommand extends Command<GithubMergeResult> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: MergePullRequestInput,
	) {
		super();
	}
}
