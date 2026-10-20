// Pull-request writes as the caller's GitHub account (ADR 052): GitHub's
// answers are mapped into our contract here; refusals surface as
// `GithubWriteRejectedError`. Never cached, never retried here.

import { Inject, Injectable } from "@nestjs/common";
import type { GithubComment, GithubPullRequestParams, GithubReactionContent, GithubReactionSubject, GithubReview, GithubReviewEvent } from "@workspace/shared";

import type { GithubClock } from "../../application/ports/github-clock.port";
import type { LinkedGithubCredential } from "../../application/ports/github-credentials.port";
import type { GithubHeadBranch, GithubMergeRequest, GithubPullRequestWritesPort } from "../../application/ports/github-pull-requests.port";
import { GITHUB_CLOCK } from "../../application/ports/github.tokens";
import { GithubPullRequestClient } from "../github-api/github-pull-request.client";
import { toPostedComment, toSubmittedReview } from "../github-api/github-pull-requests.mappers";
import { linkedTransportCredential } from "./linked-credential";

@Injectable()
export class GithubPullRequestWritesAdapter implements GithubPullRequestWritesPort {
	public constructor(
		private readonly client: GithubPullRequestClient,
		@Inject(GITHUB_CLOCK) private readonly clock: GithubClock,
	) {}

	public async addComment(linked: LinkedGithubCredential, params: GithubPullRequestParams, body: string): Promise<GithubComment> {
		return toPostedComment(await this.client.addComment(linkedTransportCredential(linked), params, body));
	}

	public async submitReview(linked: LinkedGithubCredential, params: GithubPullRequestParams, event: GithubReviewEvent, body: string): Promise<GithubReview> {
		return toSubmittedReview(await this.client.submitReview(linkedTransportCredential(linked), params, event, body), this.clock.nowEpochMs());
	}

	public async setReaction(
		linked: LinkedGithubCredential,
		params: GithubPullRequestParams,
		subject: GithubReactionSubject,
		content: GithubReactionContent,
		reacted: boolean,
	): Promise<void> {
		await this.client.setReaction(linkedTransportCredential(linked), linked.login, params, subject, content, reacted);
	}

	public async merge(linked: LinkedGithubCredential, params: GithubPullRequestParams, merge: GithubMergeRequest): Promise<string> {
		return this.client.merge(linkedTransportCredential(linked), params, merge);
	}

	public async headBranch(linked: LinkedGithubCredential, params: GithubPullRequestParams): Promise<GithubHeadBranch> {
		const state = await this.client.fetchMergeState(linkedTransportCredential(linked), params);
		return { isCrossRepository: state.pullRequest.isCrossRepository, headRefName: state.pullRequest.headRefName };
	}

	public async deleteBranch(linked: LinkedGithubCredential, params: GithubPullRequestParams, branch: string): Promise<void> {
		await this.client.deleteBranch(linkedTransportCredential(linked), params, branch);
	}
}
