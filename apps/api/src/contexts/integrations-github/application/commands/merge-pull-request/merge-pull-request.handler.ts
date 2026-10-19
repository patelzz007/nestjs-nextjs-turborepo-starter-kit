import { Inject, Injectable } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { GITHUB_TIMELINE_EVENT_DETAIL_MAX_LENGTH, type GithubMergeResult } from "@workspace/shared";

import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import type { GithubPullRequestCachePort } from "../../ports/github-pull-request-cache.port";
import type { GithubPullRequestWritesPort } from "../../ports/github-pull-requests.port";
import { GITHUB_PULL_REQUEST_CACHE, GITHUB_PULL_REQUEST_WRITES } from "../../ports/github.tokens";
import { shouldDeleteMergedBranch } from "../../../domain/policies/merge-branch.policy";
import { GithubWriteRejectedError } from "../../errors/github.errors";
import { MergePullRequestCommand } from "./merge-pull-request.command";

@Injectable()
@CommandHandler(MergePullRequestCommand)
export class MergePullRequestHandler implements ICommandHandler<MergePullRequestCommand, GithubMergeResult> {
	public constructor(
		private readonly credentials: GithubLinkedCredentials,
		@Inject(GITHUB_PULL_REQUEST_WRITES) private readonly writes: GithubPullRequestWritesPort,
		@Inject(GITHUB_PULL_REQUEST_CACHE) private readonly cache: GithubPullRequestCachePort,
	) {}

	public async execute(command: MergePullRequestCommand): Promise<GithubMergeResult> {
		const { actor, input } = command;
		const { params, merge } = input;
		const result = await this.credentials.withCredential(actor, async (linked): Promise<GithubMergeResult> => {
			const sha = await this.writes.merge(linked, params, { method: merge.method, sha: merge.expectedHeadSha, title: merge.commitTitle, message: merge.commitMessage });
			if (!merge.deleteBranch) {
				return { sha, branch: { outcome: "kept" } };
			}
			const head = await this.writes.headBranch(linked, params);
			if (!shouldDeleteMergedBranch(merge.deleteBranch, head.isCrossRepository)) {
				return { sha, branch: { outcome: "kept" } };
			}
			try {
				await this.writes.deleteBranch(linked, params, head.headRefName);
				return { sha, branch: { outcome: "deleted" } };
			} catch (error: unknown) {
				if (error instanceof GithubWriteRejectedError) {
					return { sha, branch: { outcome: "failed", reason: error.message.slice(0, GITHUB_TIMELINE_EVENT_DETAIL_MAX_LENGTH) } };
				}
				throw error;
			}
		});
		this.cache.invalidatePullRequest(params.owner, params.repository, params.number);
		return result;
	}
}
