// ============================================
// github-api.client.ts - The contributions reads, with the server's token
// ============================================
// ADR 045's read-only views of the configured repositories, made with the
// API's own `GITHUB_TOKEN`. Sending, timeouts, error translation and parsing
// are the shared `GithubHttpTransport`'s; callers get validated GitHub shapes,
// and the mapping to our contract lives in `github.mappers.ts`.

import { HttpStatus, Injectable } from "@nestjs/common";
import { GITHUB_COMMIT_FILES_MAX, GITHUB_DISCOVERY_PER_KIND_MAX, type GithubCommitParams, type GithubRepositoryParams } from "@workspace/shared";
import type { z } from "zod";

import { TypedConfigService } from "../../../../config/typed-config.service";
import { GITHUB_LINK_HEADER, GITHUB_REST_API_URL } from "./github.constants";
import {
	commitTarget,
	GITHUB_ACCOUNT_TARGET,
	GithubRepositoryNotFoundError,
	GithubResponseError,
	repositoryTarget,
	type GithubReadTarget,
} from "../../application/errors/github.errors";
import { GithubHttpTransport, type GithubCredential, type GithubGraphqlVariables } from "./github-http.transport";
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

/** The statuses GitHub answers with that this client branches on (`Response.status` is a plain number). */
const STATUS_ACCEPTED: number = HttpStatus.ACCEPTED;
const STATUS_NO_CONTENT: number = HttpStatus.NO_CONTENT;

/** How the `Link` header names the page after this one. */
const NEXT_PAGE_RELATION = 'rel="next"';

@Injectable()
export class GithubApiClient {
	public constructor(
		private readonly config: TypedConfigService,
		private readonly transport: GithubHttpTransport,
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

	/** The server's read-only token. The env rules require one whenever repositories are configured, so a missing one is unreachable in a valid deployment. */
	private serverCredential(target: GithubReadTarget): GithubCredential {
		const { token } = this.config.github;
		if (token === null) {
			throw new GithubResponseError("credentials-rejected", target, "GITHUB_TOKEN is not set");
		}
		return { source: "server", token };
	}

	private async graphql<T extends GithubGraphqlEnvelopeWire>(schema: z.ZodType<T>, query: string, target: GithubReadTarget, variables: GithubGraphqlVariables): Promise<T> {
		return this.transport.graphql(this.serverCredential(target), schema, query, target, variables);
	}

	private async send(url: string, init: RequestInit, target: GithubReadTarget): Promise<Response> {
		return this.transport.send(this.serverCredential(target), url, init, target);
	}

	private async parseBody<T>(response: Response, schema: z.ZodType<T>, target: GithubReadTarget): Promise<T> {
		return this.transport.parseBody(response, schema, target);
	}
}
