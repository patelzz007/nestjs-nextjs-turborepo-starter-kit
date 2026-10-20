// ============================================
// github-pull-request.client.ts - Pull-request reads, with an admin's own token
// ============================================
// Every request goes through the shared `GithubHttpTransport` with the
// caller's linked credential, so GitHub decides what each admin may see.
// Callers get validated GitHub shapes; mapping to the contract lives in
// `github-pull-requests.mappers.ts`.

import { Injectable, Logger } from "@nestjs/common";
import {
	GITHUB_COMMIT_FILES_MAX,
	GITHUB_CONTENT_EDITS_MAX,
	GITHUB_PULL_REQUEST_COMMIT_PAGE_SIZE,
	GITHUB_PULL_REQUEST_FILE_PAGE_SIZE,
	GITHUB_PULL_REQUEST_PAGE_SIZE,
	GITHUB_REVIEW_THREAD_COMMENTS_MAX,
	GITHUB_REVIEW_THREADS_MAX,
	GITHUB_TIMELINE_PAGE_SIZE,
	type GithubPullRequestCommitParams,
	type GithubPullRequestParams,
	type GithubMergeMethod,
	type GithubReactionContent,
	type GithubReactionSubject,
	type GithubReviewEvent,
} from "@workspace/shared";
import { z } from "zod";

import { GITHUB_LINK_HEADER, GITHUB_REST_API_URL } from "./github.constants";
import type { GithubCommitDetailResult } from "./github-api.client";
import {
	commitTarget,
	contentTarget,
	describeTarget,
	GITHUB_LINKED_ACCOUNT_TARGET,
	GITHUB_SEARCH_TARGET,
	GithubContentNotFoundError,
	GithubPullRequestNotFoundError,
	GithubResponseError,
	GithubWriteRejectedError,
	pullRequestTarget,
	type GithubReadTarget,
} from "../../application/errors/github.errors";
import { GithubHttpTransport, type GithubCredential } from "./github-http.transport";
import { GithubCommitDetailWireSchema, type GithubCommitFileWire } from "./github.wire-schemas";
import {
	GITHUB_CONTENT_EDITS_QUERY,
	GITHUB_NODE_BODY_HTML_QUERY,
	GITHUB_PULL_REQUEST_COMMITS_QUERY,
	GITHUB_PULL_REQUEST_DETAIL_QUERY,
	GITHUB_PULL_REQUEST_CHECKS_QUERY,
	GITHUB_PULL_REQUEST_HEAD_QUERY,
	GITHUB_PULL_REQUEST_MERGEABILITY_QUERY,
	GITHUB_PULL_REQUEST_REVIEW_THREADS_QUERY,
	GITHUB_PULL_REQUEST_SEARCH_QUERY,
	GITHUB_PULL_REQUEST_TIMELINE_QUERY,
} from "./github-pull-requests.queries";
import {
	GithubAuthenticatedUserWireSchema,
	GithubPostedCommentWireSchema,
	GithubContentEditsResponseWireSchema,
	GithubNodeBodyHtmlResponseWireSchema,
	GithubPullRequestCommitsResponseWireSchema,
	GithubPullRequestDetailResponseWireSchema,
	GithubPullRequestFilesWireSchema,
	GithubPullRequestChecksResponseWireSchema,
	GithubPullRequestHeadResponseWireSchema,
	GithubPullRequestMergeabilityResponseWireSchema,
	GithubMergedWireSchema,
	GithubPullRequestSearchResponseWireSchema,
	GithubPullRequestTimelineResponseWireSchema,
	GithubReviewThreadsResponseWireSchema,
	GithubSubmittedReviewWireSchema,
	GithubRestReactionListWireSchema,
	GithubRestReactionWireSchema,
	type GithubAuthenticatedUserWire,
	type GithubCheckRollupWire,
	type GithubContentEditsWire,
	type GithubPullRequestCommitsWire,
	type GithubPullRequestDetailWire,
	type GithubMergeStateWire,
	type GithubPostedCommentWire,
	type GithubPullRequestSearchWire,
	type GithubSubmittedReviewWire,
	type GithubReviewThreadsWire,
	type GithubTimelineConnectionWire,
} from "./github-pull-requests.wire-schemas";

/**
 * The header GitHub sets on every answer to a token that expires:
 * `2026-11-14 00:00:00 UTC` (some answers use a numeric offset, `+0000`).
 */
export const GITHUB_TOKEN_EXPIRATION_HEADER = "github-authentication-token-expiration";

const TOKEN_EXPIRATION_PATTERN = /^(?<date>\d{4}-\d{2}-\d{2}) (?<time>\d{2}:\d{2}:\d{2}) (?:UTC|(?<offset>[+-]\d{4}))$/;
const OFFSET_PATTERN = /^(?<sign>[+-])(?<hours>\d{2})(?<minutes>\d{2})$/;
const TokenExpirationGroupsSchema = z.object({ date: z.string(), time: z.string(), offset: z.string().optional() });
const OffsetGroupsSchema = z.object({ sign: z.string(), hours: z.string(), minutes: z.string() });

/** How the `Link` header names the page after this one. */
const NEXT_PAGE_RELATION = 'rel="next"';

/** Who a token belongs to, and when GitHub expires it (`null`: never, or GitHub did not say). */
export interface GithubTokenOwner {
	readonly user: GithubAuthenticatedUserWire;
	readonly tokenExpiresAt: number | null;
}

/** One page of a pull request's changed files, as GitHub answered it. */
export interface GithubPullRequestFilesResult {
	readonly files: readonly GithubCommitFileWire[];
	readonly hasNextPage: boolean;
}

/** GitHub's name for each review verdict (`PullRequestReviewEvent`). */
const REVIEW_EVENTS: Readonly<Record<GithubReviewEvent, string>> = {
	comment: "COMMENT",
	approve: "APPROVE",
	requestChanges: "REQUEST_CHANGES",
};

/** GitHub's REST name for each reaction. */
const REST_REACTION_CONTENTS: Readonly<Record<GithubReactionContent, string>> = {
	thumbsUp: "+1",
	thumbsDown: "-1",
	laugh: "laugh",
	hooray: "hooray",
	confused: "confused",
	heart: "heart",
	rocket: "rocket",
	eyes: "eyes",
};

/** Reactions read per page while looking for the caller's own (GitHub's largest page). */
const REACTION_PAGE_SIZE = 100;
/** Pages read before giving up on finding the caller's reaction (10 000 of one kind on one comment). */
const REACTION_PAGES_MAX = 100;

/** A GitHub expiry header as epoch ms; `null` when absent or in a format this client does not know. */
export function parseTokenExpiration(header: string | null): number | null {
	if (header === null) {
		return null;
	}
	const groups = TokenExpirationGroupsSchema.safeParse(TOKEN_EXPIRATION_PATTERN.exec(header.trim())?.groups);
	if (!groups.success) {
		return null;
	}
	const offset = groups.data.offset === undefined ? "Z" : toIsoOffset(groups.data.offset);
	const epochMs = Date.parse(`${groups.data.date}T${groups.data.time}${offset}`);
	return Number.isNaN(epochMs) ? null : epochMs;
}

/** `+0800` → `+08:00`, the form ISO 8601 parsers take. */
function toIsoOffset(offset: string): string {
	const parts = OffsetGroupsSchema.parse(OFFSET_PATTERN.exec(offset)?.groups);
	return `${parts.sign}${parts.hours}:${parts.minutes}`;
}

@Injectable()
export class GithubPullRequestClient {
	private readonly logger: Logger = new Logger(GithubPullRequestClient.name);

	public constructor(private readonly transport: GithubHttpTransport) {}

	/** The account a token belongs to (`GET /user`) and the token's expiry — checks the token before it is stored. */
	public async fetchTokenOwner(credential: GithubCredential): Promise<GithubTokenOwner> {
		const response = await this.transport.send(credential, `${GITHUB_REST_API_URL}/user`, { method: "GET" }, GITHUB_LINKED_ACCOUNT_TARGET);
		const user = await this.transport.parseBody(response, GithubAuthenticatedUserWireSchema, GITHUB_LINKED_ACCOUNT_TARGET);
		const header = response.headers.get(GITHUB_TOKEN_EXPIRATION_HEADER);
		const tokenExpiresAt = parseTokenExpiration(header);
		if (header !== null && tokenExpiresAt === null) {
			this.logger.warn(`GitHub sent a token expiry this client cannot read: ${header}`);
		}
		return { user, tokenExpiresAt };
	}

	/** One page of a pull-request search. `query` is built by the service from a closed set of filters, never from client text. */
	public async searchPullRequests(credential: GithubCredential, query: string, after: string | null): Promise<GithubPullRequestSearchWire> {
		const envelope = await this.transport.graphql(credential, GithubPullRequestSearchResponseWireSchema, GITHUB_PULL_REQUEST_SEARCH_QUERY, GITHUB_SEARCH_TARGET, {
			query,
			first: GITHUB_PULL_REQUEST_PAGE_SIZE,
			after,
		});
		const search = envelope.data?.search ?? null;
		if (search === null) {
			return { issueCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] };
		}
		return search;
	}

	public async fetchPullRequest(credential: GithubCredential, params: GithubPullRequestParams): Promise<GithubPullRequestDetailWire> {
		const envelope = await this.transport.graphql(credential, GithubPullRequestDetailResponseWireSchema, GITHUB_PULL_REQUEST_DETAIL_QUERY, pullRequestTarget(params), {
			...pullRequestVariables(params),
			first: GITHUB_TIMELINE_PAGE_SIZE,
			after: null,
		});
		return requirePullRequest(envelope.data?.repository?.pullRequest ?? null, params);
	}

	public async fetchTimeline(credential: GithubCredential, params: GithubPullRequestParams, after: string | null): Promise<GithubTimelineConnectionWire> {
		const envelope = await this.transport.graphql(credential, GithubPullRequestTimelineResponseWireSchema, GITHUB_PULL_REQUEST_TIMELINE_QUERY, pullRequestTarget(params), {
			...pullRequestVariables(params),
			first: GITHUB_TIMELINE_PAGE_SIZE,
			after,
		});
		return requirePullRequest(envelope.data?.repository?.pullRequest ?? null, params).timelineItems;
	}

	public async fetchCommits(credential: GithubCredential, params: GithubPullRequestParams, after: string | null): Promise<GithubPullRequestCommitsWire> {
		const envelope = await this.transport.graphql(credential, GithubPullRequestCommitsResponseWireSchema, GITHUB_PULL_REQUEST_COMMITS_QUERY, pullRequestTarget(params), {
			...pullRequestVariables(params),
			first: GITHUB_PULL_REQUEST_COMMIT_PAGE_SIZE,
			after,
		});
		return requirePullRequest(envelope.data?.repository?.pullRequest ?? null, params).commits;
	}

	/** One page of changed files (REST: GraphQL has no patches); `hasNextPage` from GitHub's `Link` header. */
	public async fetchFiles(credential: GithubCredential, params: GithubPullRequestParams, page: number): Promise<GithubPullRequestFilesResult> {
		const path = `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repository)}/pulls/${String(params.number)}/files`;
		const query = new URLSearchParams({ per_page: String(GITHUB_PULL_REQUEST_FILE_PAGE_SIZE), page: String(page) });
		const target = pullRequestTarget(params);
		const response = await this.transport.send(credential, `${GITHUB_REST_API_URL}${path}?${query.toString()}`, { method: "GET" }, target);
		const hasNextPage = response.headers.get(GITHUB_LINK_HEADER)?.includes(NEXT_PAGE_RELATION) ?? false;
		return { files: await this.transport.parseBody(response, GithubPullRequestFilesWireSchema, target), hasNextPage };
	}

	/**
	 * One of the pull request's commits with the first {@link GITHUB_COMMIT_FILES_MAX}
	 * changed files and their diffs (REST), read with the caller's own token.
	 */
	public async fetchCommit(credential: GithubCredential, params: GithubPullRequestCommitParams): Promise<GithubCommitDetailResult> {
		const path = `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repository)}/commits/${encodeURIComponent(params.sha)}`;
		const query = new URLSearchParams({ per_page: String(GITHUB_COMMIT_FILES_MAX) });
		const target = commitTarget(params);
		const response = await this.transport.send(credential, `${GITHUB_REST_API_URL}${path}?${query.toString()}`, { method: "GET" }, target);
		const filesTruncated = response.headers.get(GITHUB_LINK_HEADER)?.includes(NEXT_PAGE_RELATION) ?? false;
		return { commit: await this.transport.parseBody(response, GithubCommitDetailWireSchema, target), filesTruncated };
	}

	/**
	 * Comments on the conversation as the linked account (REST — GitHub accepts
	 * a fine-grained token with "Pull requests: Read and write" here).
	 */
	public async addComment(credential: GithubCredential, params: GithubPullRequestParams, body: string): Promise<GithubPostedCommentWire> {
		const target = pullRequestTarget(params);
		const response = await this.transport.post(
			credential,
			`${GITHUB_REST_API_URL}${repositoryPath(params)}/issues/${String(params.number)}/comments`,
			{ body },
			target,
			"Pull requests",
		);
		return this.transport.parseBody(response, GithubPostedCommentWireSchema, target);
	}

	/** Submits a review as the linked account; an empty summary is left out (only approving allows it). */
	public async submitReview(credential: GithubCredential, params: GithubPullRequestParams, event: GithubReviewEvent, body: string): Promise<GithubSubmittedReviewWire> {
		const target = pullRequestTarget(params);
		const review = body.length === 0 ? { event: REVIEW_EVENTS[event] } : { event: REVIEW_EVENTS[event], body };
		const response = await this.transport.post(
			credential,
			`${GITHUB_REST_API_URL}${repositoryPath(params)}/pulls/${String(params.number)}/reviews`,
			review,
			target,
			"Pull requests",
		);
		return this.transport.parseBody(response, GithubSubmittedReviewWireSchema, target);
	}

	/**
	 * Sets the linked account's reaction on or off (REST, which takes a
	 * fine-grained token). Adding one GitHub already has answers it back
	 * unchanged; taking one away looks up the account's own reaction of that
	 * kind and deletes it — none to delete is already the state asked for.
	 */
	public async setReaction(
		credential: GithubCredential,
		login: string,
		params: GithubPullRequestParams,
		subject: GithubReactionSubject,
		content: GithubReactionContent,
		reacted: boolean,
	): Promise<void> {
		const target = pullRequestTarget(params);
		const reactionsUrl = `${GITHUB_REST_API_URL}${repositoryPath(params)}${reactionSubjectPath(params, subject)}/reactions`;
		if (reacted) {
			const response = await this.transport.post(credential, reactionsUrl, { content: REST_REACTION_CONTENTS[content] }, target, "Pull requests");
			await this.transport.parseBody(response, GithubRestReactionWireSchema, target);
			return;
		}
		const reactionId = await this.findOwnReaction(credential, login, reactionsUrl, content, target);
		if (reactionId !== null) {
			await this.transport.delete(credential, `${reactionsUrl}/${String(reactionId)}`, target, "Pull requests");
		}
	}

	/** The id of the account's own reaction of one kind, read page by page; `null` when it has none. */
	private async findOwnReaction(
		credential: GithubCredential,
		login: string,
		reactionsUrl: string,
		content: GithubReactionContent,
		target: GithubReadTarget,
	): Promise<number | null> {
		for (let page = 1; page <= REACTION_PAGES_MAX; page += 1) {
			const query = new URLSearchParams({ content: REST_REACTION_CONTENTS[content], per_page: String(REACTION_PAGE_SIZE), page: String(page) });
			const response = await this.transport.send(credential, `${reactionsUrl}?${query.toString()}`, { method: "GET" }, target);
			const hasNextPage = response.headers.get(GITHUB_LINK_HEADER)?.includes(NEXT_PAGE_RELATION) ?? false;
			const reactions = await this.transport.parseBody(response, GithubRestReactionListWireSchema, target);
			const own = reactions.find((reaction): boolean => reaction.user?.login.toLowerCase() === login.toLowerCase());
			if (own !== undefined) {
				return own.id;
			}
			if (!hasNextPage) {
				return null;
			}
		}
		return null;
	}

	/** The repository's merge settings and the pull request's merge state (cleanly mergeable, GitHub's verdict, head commit). */
	public async fetchMergeState(credential: GithubCredential, params: GithubPullRequestParams): Promise<GithubMergeStateWire> {
		const envelope = await this.transport.graphql(
			credential,
			GithubPullRequestMergeabilityResponseWireSchema,
			GITHUB_PULL_REQUEST_MERGEABILITY_QUERY,
			pullRequestTarget(params),
			pullRequestVariables(params),
		);
		const repository = envelope.data?.repository ?? null;
		const pullRequest = requirePullRequest(repository?.pullRequest ?? null, params);
		return { ...requirePullRequest(repository, params), pullRequest };
	}

	/**
	 * Merges the pull request as the linked account (REST, which takes a token with "Contents: Read and
	 * write"), only if its head is still `sha`. GitHub's refusals — not mergeable (405), the head moved
	 * on (409), a rule it enforces (422) — come back as GitHub's own reason.
	 */
	public async merge(
		credential: GithubCredential,
		params: GithubPullRequestParams,
		merge: { readonly method: GithubMergeMethod; readonly sha: string; readonly title: string; readonly message: string },
	): Promise<string> {
		const target = pullRequestTarget(params);
		const body = {
			merge_method: merge.method,
			sha: merge.sha,
			...(merge.method === "rebase" || merge.title.length === 0 ? {} : { commit_title: merge.title }),
			...(merge.method === "rebase" || merge.message.length === 0 ? {} : { commit_message: merge.message }),
		};
		const response = await this.transport.put(credential, `${GITHUB_REST_API_URL}${repositoryPath(params)}/pulls/${String(params.number)}/merge`, body, target, "Contents");
		return (await this.transport.parseBody(response, GithubMergedWireSchema, target)).sha;
	}

	/** Deletes a branch of the pull request's repository (after merging it). A branch already gone counts as deleted. */
	public async deleteBranch(credential: GithubCredential, params: GithubPullRequestParams, branch: string): Promise<void> {
		const ref = branch.split("/").map(encodeURIComponent).join("/");
		try {
			await this.transport.delete(credential, `${GITHUB_REST_API_URL}${repositoryPath(params)}/git/refs/heads/${ref}`, pullRequestTarget(params), "Contents");
		} catch (error: unknown) {
			// GitHub answers 422 "Reference does not exist" when the repository already deleted it on merge.
			if (error instanceof GithubWriteRejectedError && error.refusal === "unprocessable" && /reference does not exist/iu.test(error.message)) {
				return;
			}
			throw error;
		}
	}

	/**
	 * The head commit's check rollup: `null` when it has no checks, `undefined`
	 * when GitHub answers the token with an error for them (a token that may
	 * read the pull request but not its checks) — the rest of the merge box
	 * still shows.
	 */
	public async fetchChecks(credential: GithubCredential, params: GithubPullRequestParams): Promise<GithubCheckRollupWire | null | undefined> {
		let envelope: z.output<typeof GithubPullRequestChecksResponseWireSchema>;
		try {
			envelope = await this.transport.graphql(
				credential,
				GithubPullRequestChecksResponseWireSchema,
				GITHUB_PULL_REQUEST_CHECKS_QUERY,
				pullRequestTarget(params),
				pullRequestVariables(params),
			);
		} catch (error: unknown) {
			if (error instanceof GithubResponseError && error.problem === "graphql-error") {
				this.logger.warn(`GitHub would not show the checks of ${describeTarget(pullRequestTarget(params))} to the linked token`);
				return undefined;
			}
			throw error;
		}
		const [last] = requirePullRequest(envelope.data?.repository?.pullRequest ?? null, params).commits.nodes;
		return last?.commit.statusCheckRollup ?? null;
	}

	/** The commit the pull request's head branch points at — what its diff (and a line comment) belongs to. */
	public async fetchHeadSha(credential: GithubCredential, params: GithubPullRequestParams): Promise<string> {
		const envelope = await this.transport.graphql(
			credential,
			GithubPullRequestHeadResponseWireSchema,
			GITHUB_PULL_REQUEST_HEAD_QUERY,
			pullRequestTarget(params),
			pullRequestVariables(params),
		);
		return requirePullRequest(envelope.data?.repository?.pullRequest ?? null, params).headRefOid;
	}

	public async fetchReviewThreads(credential: GithubCredential, params: GithubPullRequestParams): Promise<GithubReviewThreadsWire> {
		const envelope = await this.transport.graphql(credential, GithubReviewThreadsResponseWireSchema, GITHUB_PULL_REQUEST_REVIEW_THREADS_QUERY, pullRequestTarget(params), {
			...pullRequestVariables(params),
			threads: GITHUB_REVIEW_THREADS_MAX,
			comments: GITHUB_REVIEW_THREAD_COMMENTS_MAX,
		});
		return requirePullRequest(envelope.data?.repository?.pullRequest ?? null, params);
	}

	/** The saved versions of a comment-like node; {@link GithubContentNotFoundError} for a node that is not one, or that the token cannot see. */
	public async fetchContentEdits(credential: GithubCredential, nodeId: string): Promise<GithubContentEditsWire> {
		const target = contentTarget(nodeId);
		const envelope = await this.transport.graphql(credential, GithubContentEditsResponseWireSchema, GITHUB_CONTENT_EDITS_QUERY, target, {
			id: nodeId,
			first: GITHUB_CONTENT_EDITS_MAX,
		});
		const edits = envelope.data?.node?.userContentEdits;
		if (edits === undefined) {
			throw new GithubContentNotFoundError(nodeId);
		}
		return edits;
	}

	/** The rendered body of a pull request, comment, review or line comment, read now — GitHub signs the links to its uploads afresh in it. */
	public async fetchBodyHtml(credential: GithubCredential, nodeId: string): Promise<string> {
		const envelope = await this.transport.graphql(credential, GithubNodeBodyHtmlResponseWireSchema, GITHUB_NODE_BODY_HTML_QUERY, contentTarget(nodeId), { id: nodeId });
		const bodyHtml = envelope.data?.node?.bodyHTML;
		if (bodyHtml === undefined) {
			throw new GithubContentNotFoundError(nodeId);
		}
		return bodyHtml;
	}
}

/** `/repos/:owner/:repository` — each part encoded. */
/** Where GitHub's REST API keeps a subject's reactions, under the repository. */
function reactionSubjectPath(params: GithubPullRequestParams, subject: GithubReactionSubject): string {
	switch (subject.type) {
		case "pullRequest":
			return `/issues/${String(params.number)}`;
		case "issueComment":
			return `/issues/comments/${subject.commentId}`;
		case "reviewComment":
			return `/pulls/comments/${subject.commentId}`;
	}
}

function repositoryPath(params: GithubPullRequestParams): string {
	return `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repository)}`;
}

function pullRequestVariables(params: GithubPullRequestParams): { readonly owner: string; readonly name: string; readonly number: number } {
	return { owner: params.owner, name: params.repository, number: params.number };
}

/** GitHub answers `pullRequest: null` (or `repository: null`) when the token cannot see it. */
function requirePullRequest<T>(pullRequest: T | null, params: GithubPullRequestParams): T {
	if (pullRequest === null) {
		throw new GithubPullRequestNotFoundError(params);
	}
	return pullRequest;
}
