// ============================================
// github-api.client.ts - The one place the API talks to GitHub
// ============================================
// Every request: the configured token, an explicit timeout, GitHub's errors
// translated into typed application errors, and the body parsed with a wire
// schema before anything reads it. Callers get validated GitHub shapes; the
// mapping to our contract lives in `github.mappers.ts`.

import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import {
	GITHUB_COMMIT_FILES_MAX,
	GITHUB_DISCOVERY_PER_KIND_MAX,
	JsonValueSchema,
	type GithubCommitParams,
	type GithubRepositoryParams,
	type JsonValue,
} from "@workspace/shared";
import type { z } from "zod";

import { TypedConfigService } from "../../config/typed-config.service";
import {
	GITHUB_GRAPHQL_API_URL,
	GITHUB_JSON_MEDIA_TYPE,
	GITHUB_LINK_HEADER,
	GITHUB_RATE_LIMIT_REMAINING_HEADER,
	GITHUB_REST_API_URL,
	GITHUB_REST_API_VERSION,
	GITHUB_RETRY_AFTER_HEADER,
} from "./github.constants";
import {
	commitTarget,
	describeTarget,
	GITHUB_ACCOUNT_TARGET,
	GithubCommitNotFoundError,
	GithubRepositoryNotFoundError,
	GithubResponseError,
	GithubUnavailableError,
	repositoryTarget,
	type GithubReadTarget,
} from "./github.errors";
import {
	GITHUB_COMMIT_HISTORY_QUERY,
	GITHUB_CONTRIBUTION_HISTORY_QUERY,
	GITHUB_REPOSITORY_SUMMARY_QUERY,
	GITHUB_SUMMARY_LANGUAGES_REQUESTED,
	GITHUB_VIEWER_REPOSITORIES_QUERY,
} from "./github.queries";
import {
	GithubCommitDetailWireSchema,
	GithubCommitHistoryResponseWireSchema,
	GithubContributionHistoryResponseWireSchema,
	GithubContributorStatsWireSchema,
	GithubRepositorySummaryResponseWireSchema,
	GithubViewerRepositoriesResponseWireSchema,
	type GithubCommitDetailWire,
	type GithubCommitHistoryWire,
	type GithubContributionHistoryWire,
	type GithubContributorStatWire,
	type GithubGraphqlEnvelopeWire,
	type GithubRepositorySummaryNodeWire,
	type GithubViewerRepositoriesWire,
} from "./github.wire-schemas";

/** The HTTP boundary — `fetch` in production, a fake in tests. */
export type GithubFetch = (url: string, init: RequestInit) => Promise<Response>;

export const GITHUB_FETCH = Symbol("GITHUB_FETCH");

/** Production binding of {@link GITHUB_FETCH}: the runtime's global `fetch`. */
export const GLOBAL_GITHUB_FETCH: GithubFetch = (url: string, init: RequestInit): Promise<Response> => fetch(url, init);

/** Contributor statistics as GitHub reports them: still being computed, or ready. */
export type GithubContributorStatsResult = { readonly status: "computing" } | { readonly status: "ready"; readonly stats: readonly GithubContributorStatWire[] };

/** One commit and whether GitHub has more of its files than the page it answered with. */
export interface GithubCommitDetailResult {
	readonly commit: GithubCommitDetailWire;
	readonly filesTruncated: boolean;
}

/** The commit-history page a GraphQL read asked for. */
export interface GithubCommitHistoryRequest {
	readonly first: number;
	readonly after: string | null;
}

/** GraphQL variables — scalars only, never interpolated into the query text. */
type GithubGraphqlVariables = Readonly<Record<string, string | number | null>>;

/** GitHub's GraphQL error kinds this client branches on. */
const GRAPHQL_NOT_FOUND = "NOT_FOUND";
const GRAPHQL_RATE_LIMITED = "RATE_LIMITED";

/** The statuses GitHub answers with that this client branches on (`Response.status` is a plain number). */
const STATUS_ACCEPTED: number = HttpStatus.ACCEPTED;
const STATUS_NO_CONTENT: number = HttpStatus.NO_CONTENT;
const STATUS_UNAUTHORIZED: number = HttpStatus.UNAUTHORIZED;
const STATUS_FORBIDDEN: number = HttpStatus.FORBIDDEN;
const STATUS_NOT_FOUND: number = HttpStatus.NOT_FOUND;
const STATUS_UNPROCESSABLE_ENTITY: number = HttpStatus.UNPROCESSABLE_ENTITY;
const STATUS_TOO_MANY_REQUESTS: number = HttpStatus.TOO_MANY_REQUESTS;

/** How the `Link` header names the page after this one. */
const NEXT_PAGE_RELATION = 'rel="next"';

/** The name `AbortSignal.timeout()` gives the error it aborts with. */
const TIMEOUT_ERROR_NAME = "TimeoutError";

@Injectable()
export class GithubApiClient {
	private readonly logger: Logger = new Logger(GithubApiClient.name);

	public constructor(
		private readonly config: TypedConfigService,
		@Inject(GITHUB_FETCH) private readonly fetchGithub: GithubFetch,
	) {}

	/** Stars, forks, languages, commit count and last push. Throws {@link GithubRepositoryNotFoundError} when GitHub does not show the repository. */
	public async fetchRepositorySummary(params: GithubRepositoryParams): Promise<GithubRepositorySummaryNodeWire> {
		const envelope = await this.graphql(GithubRepositorySummaryResponseWireSchema, GITHUB_REPOSITORY_SUMMARY_QUERY, repositoryTarget(params), {
			owner: params.owner,
			name: params.repository,
			languages: GITHUB_SUMMARY_LANGUAGES_REQUESTED,
		});
		const repository = envelope.data?.repository ?? null;
		if (repository === null) {
			throw new GithubRepositoryNotFoundError(params);
		}
		return repository;
	}

	/** One page of the default branch's history; `null` for an empty repository (no default branch yet). */
	public async fetchCommitHistory(params: GithubRepositoryParams, page: GithubCommitHistoryRequest): Promise<GithubCommitHistoryWire | null> {
		const envelope = await this.graphql(GithubCommitHistoryResponseWireSchema, GITHUB_COMMIT_HISTORY_QUERY, repositoryTarget(params), {
			owner: params.owner,
			name: params.repository,
			first: page.first,
			after: page.after,
		});
		const repository = envelope.data?.repository ?? null;
		if (repository === null) {
			throw new GithubRepositoryNotFoundError(params);
		}
		return repository.defaultBranchRef?.target?.history ?? null;
	}

	/**
	 * One commit with the first {@link GITHUB_COMMIT_FILES_MAX} of its changed
	 * files and their diffs. Throws {@link GithubCommitNotFoundError} when the
	 * repository has no such commit (GitHub answers 404 or 422).
	 */
	public async fetchCommit(params: GithubCommitParams): Promise<GithubCommitDetailResult> {
		const path = `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repository)}/commits/${encodeURIComponent(params.sha)}`;
		const query = new URLSearchParams({ per_page: String(GITHUB_COMMIT_FILES_MAX) });
		const target = commitTarget(params);
		const response = await this.send(`${GITHUB_REST_API_URL}${path}?${query.toString()}`, { method: "GET" }, target);
		const filesTruncated = response.headers.get(GITHUB_LINK_HEADER)?.includes(NEXT_PAGE_RELATION) ?? false;
		return { commit: await this.parseBody(response, GithubCommitDetailWireSchema, target), filesTruncated };
	}

	/**
	 * One page of the default branch's history with what contribution totals
	 * need per commit; `null` for an empty repository (no default branch yet).
	 */
	public async fetchContributionHistory(params: GithubRepositoryParams, page: GithubCommitHistoryRequest): Promise<GithubContributionHistoryWire | null> {
		const envelope = await this.graphql(GithubContributionHistoryResponseWireSchema, GITHUB_CONTRIBUTION_HISTORY_QUERY, repositoryTarget(params), {
			owner: params.owner,
			name: params.repository,
			first: page.first,
			after: page.after,
		});
		const repository = envelope.data?.repository ?? null;
		if (repository === null) {
			throw new GithubRepositoryNotFoundError(params);
		}
		return repository.defaultBranchRef?.target?.history ?? null;
	}

	/**
	 * Per-contributor weekly totals. GitHub answers 202 while it computes them
	 * (the first read, or the first after a push) and 204 for an empty repository.
	 */
	public async fetchContributorStats(params: GithubRepositoryParams): Promise<GithubContributorStatsResult> {
		const path = `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repository)}/stats/contributors`;
		const target = repositoryTarget(params);
		const response = await this.send(`${GITHUB_REST_API_URL}${path}`, { method: "GET" }, target);
		if (response.status === STATUS_ACCEPTED) {
			return { status: "computing" };
		}
		if (response.status === STATUS_NO_CONTENT) {
			return { status: "ready", stats: [] };
		}
		return { status: "ready", stats: await this.parseBody(response, GithubContributorStatsWireSchema, target) };
	}

	/**
	 * The token account's login, its own public repositories (forks left out)
	 * and the public repositories it recently contributed commits or pull
	 * requests to — each most recently pushed first, at most
	 * {@link GITHUB_DISCOVERY_PER_KIND_MAX} per kind.
	 */
	public async fetchViewerRepositories(): Promise<GithubViewerRepositoriesWire> {
		const envelope = await this.graphql(GithubViewerRepositoriesResponseWireSchema, GITHUB_VIEWER_REPOSITORIES_QUERY, GITHUB_ACCOUNT_TARGET, {
			first: GITHUB_DISCOVERY_PER_KIND_MAX,
		});
		const viewer = envelope.data?.viewer ?? null;
		if (viewer === null) {
			throw new GithubResponseError("unexpected-body", GITHUB_ACCOUNT_TARGET, "no viewer in the answer");
		}
		return viewer;
	}

	/** POSTs one GraphQL query; GraphQL-level errors become the same typed errors as HTTP ones. */
	private async graphql<T extends GithubGraphqlEnvelopeWire>(schema: z.ZodType<T>, query: string, target: GithubReadTarget, variables: GithubGraphqlVariables): Promise<T> {
		const response = await this.send(GITHUB_GRAPHQL_API_URL, { method: "POST", body: JSON.stringify({ query, variables }) }, target);
		const envelope = await this.parseBody(response, schema, target);
		const errors = envelope.errors ?? [];
		if (errors.some((error): boolean => error.type === GRAPHQL_NOT_FOUND)) {
			throw notFound(target, "GraphQL NOT_FOUND");
		}
		if (errors.some((error): boolean => error.type === GRAPHQL_RATE_LIMITED)) {
			throw this.rateLimited(target);
		}
		if (errors.length > 0) {
			throw new GithubResponseError("graphql-error", target, errors.map((error): string => `${error.type ?? "UNKNOWN"}: ${error.message}`).join("; "));
		}
		return envelope;
	}

	/** One authenticated request with the configured timeout; any non-2xx status is thrown as a typed error. */
	private async send(url: string, init: RequestInit, target: GithubReadTarget): Promise<Response> {
		const { token, requestTimeoutMs } = this.config.github;
		if (token === null) {
			// The env rules require a token whenever repositories are configured, so this is unreachable in a valid deployment.
			throw new GithubResponseError("credentials-rejected", target, "GITHUB_TOKEN is not set");
		}
		let response: Response;
		try {
			response = await this.fetchGithub(url, {
				...init,
				headers: {
					Accept: GITHUB_JSON_MEDIA_TYPE,
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
					"User-Agent": this.config.runtime.appName,
					"X-GitHub-Api-Version": GITHUB_REST_API_VERSION,
				},
				signal: AbortSignal.timeout(requestTimeoutMs),
			});
		} catch (error: unknown) {
			const cause = error instanceof Error ? error : undefined;
			const timedOut = cause?.name === TIMEOUT_ERROR_NAME;
			this.logger.warn(`GitHub request for ${describeTarget(target)} ${timedOut ? `timed out after ${String(requestTimeoutMs)} ms` : "could not be sent"}`);
			throw new GithubUnavailableError(timedOut ? "timeout" : "unreachable", cause);
		}
		if (response.ok) {
			return response;
		}
		throw this.statusError(response, target);
	}

	private statusError(response: Response, target: GithubReadTarget): Error {
		// GitHub answers an unknown SHA with 422 ("No commit found for SHA"), an unknown repository with 404.
		if (response.status === STATUS_NOT_FOUND || (response.status === STATUS_UNPROCESSABLE_ENTITY && target.kind === "commit")) {
			return notFound(target, `HTTP ${String(response.status)}`);
		}
		if (response.status === STATUS_TOO_MANY_REQUESTS || (response.status === STATUS_FORBIDDEN && isRateLimitResponse(response))) {
			return this.rateLimited(target);
		}
		if (response.status === STATUS_UNAUTHORIZED) {
			this.logger.error(`GitHub rejected GITHUB_TOKEN reading ${describeTarget(target)} — check the token has not expired or been revoked`);
			return new GithubResponseError("credentials-rejected", target, "401 Unauthorized");
		}
		return new GithubResponseError("unexpected-status", target, `HTTP ${String(response.status)}`);
	}

	private rateLimited(target: GithubReadTarget): GithubUnavailableError {
		this.logger.warn(`GitHub rate limit used up while reading ${describeTarget(target)}`);
		return new GithubUnavailableError("rate-limited");
	}

	/** Reads and validates a JSON body — a body that is not JSON, or not the expected shape, is a {@link GithubResponseError}. */
	private async parseBody<T>(response: Response, schema: z.ZodType<T>, target: GithubReadTarget): Promise<T> {
		const text = await response.text();
		let json: JsonValue;
		try {
			json = JsonValueSchema.parse(JSON.parse(text));
		} catch (error: unknown) {
			throw new GithubResponseError("unexpected-body", target, `not JSON (${error instanceof Error ? error.message : "parse failed"})`);
		}
		const parsed = schema.safeParse(json);
		if (!parsed.success) {
			throw new GithubResponseError("unexpected-body", target, parsed.error.issues.map((issue): string => `${issue.path.join(".")}: ${issue.message}`).join("; "));
		}
		return parsed.data;
	}
}

/** A 404 is about the repository or commit read; for the token's own account it means GitHub answered unexpectedly. */
function notFound(target: GithubReadTarget, detail: string): Error {
	switch (target.kind) {
		case "repository":
			return new GithubRepositoryNotFoundError(target.params);
		case "commit":
			return new GithubCommitNotFoundError(target.params);
		case "account":
			return new GithubResponseError("unexpected-status", target, detail);
	}
}

/** GitHub answers a used-up primary or secondary rate limit with 403 plus one of these headers. */
function isRateLimitResponse(response: Response): boolean {
	return response.headers.get(GITHUB_RATE_LIMIT_REMAINING_HEADER) === "0" || response.headers.has(GITHUB_RETRY_AFTER_HEADER);
}
