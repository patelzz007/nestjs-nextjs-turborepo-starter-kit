// ============================================
// github.wire-schemas.ts - What GitHub answers, validated at the boundary
// ============================================
// GitHub is a third party: every body is parsed with these schemas before any
// field is used. Objects strip what we do not read, so GitHub adding fields
// never breaks the integration; a missing or mistyped field we DO read is a
// 502 (`GithubResponseError`), never a silent `undefined`.

import { z } from "zod";

// ── GraphQL envelope ──────────────────────────────────────────────────────

/** One GraphQL error. `type` is GitHub's machine-readable kind (`NOT_FOUND`, `RATE_LIMITED`, …). */
export const GithubGraphqlErrorWireSchema = z.object({
	type: z.string().optional(),
	message: z.string(),
});

export type GithubGraphqlErrorWire = z.output<typeof GithubGraphqlErrorWireSchema>;

const GraphqlErrorsWireSchema = z.array(GithubGraphqlErrorWireSchema);

/** The part of every GraphQL envelope the client checks before reading `data`. */
export interface GithubGraphqlEnvelopeWire {
	readonly errors?: readonly GithubGraphqlErrorWire[] | undefined;
}

// ── Repository summary (GraphQL) ──────────────────────────────────────────

const TotalCountWireSchema = z.object({ totalCount: z.number().int().nonnegative() });

export const GithubRepositorySummaryNodeWireSchema = z.object({
	description: z.string().nullable(),
	url: z.url(),
	stargazerCount: z.number().int().nonnegative(),
	forkCount: z.number().int().nonnegative(),
	watchers: TotalCountWireSchema,
	issues: TotalCountWireSchema,
	primaryLanguage: z.object({ name: z.string() }).nullable(),
	pushedAt: z.iso.datetime({ offset: true }).nullable(),
	/** `null` for an empty repository; `target.history` is present because the query asks for it on `Commit`. */
	defaultBranchRef: z
		.object({
			name: z.string(),
			target: z.object({ history: TotalCountWireSchema.optional() }).nullable(),
		})
		.nullable(),
	languages: z.object({
		edges: z.array(
			z.object({
				size: z.number().int().nonnegative(),
				node: z.object({ name: z.string(), color: z.string().nullable() }),
			}),
		),
	}),
});

export type GithubRepositorySummaryNodeWire = z.output<typeof GithubRepositorySummaryNodeWireSchema>;

export const GithubRepositorySummaryResponseWireSchema = z.object({
	data: z.object({ repository: GithubRepositorySummaryNodeWireSchema.nullable() }).nullish(),
	errors: GraphqlErrorsWireSchema.optional(),
});

export type GithubRepositorySummaryResponseWire = z.output<typeof GithubRepositorySummaryResponseWireSchema>;

// ── Commit history (GraphQL) ───────────────────────────────────────────────

export const GithubCommitNodeWireSchema = z.object({
	oid: z.string(),
	abbreviatedOid: z.string(),
	messageHeadline: z.string(),
	url: z.url(),
	committedDate: z.iso.datetime({ offset: true }),
	additions: z.number().int().nonnegative(),
	deletions: z.number().int().nonnegative(),
	changedFilesIfAvailable: z.number().int().nonnegative().nullable(),
	author: z
		.object({
			name: z.string().nullable(),
			user: z.object({ login: z.string(), avatarUrl: z.url() }).nullable(),
		})
		.nullable(),
});

export type GithubCommitNodeWire = z.output<typeof GithubCommitNodeWireSchema>;

export const GithubCommitHistoryWireSchema = z.object({
	totalCount: z.number().int().nonnegative(),
	pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
	nodes: z.array(GithubCommitNodeWireSchema),
});

export type GithubCommitHistoryWire = z.output<typeof GithubCommitHistoryWireSchema>;

export const GithubCommitHistoryResponseWireSchema = z.object({
	data: z
		.object({
			repository: z
				.object({
					defaultBranchRef: z.object({ target: z.object({ history: GithubCommitHistoryWireSchema.optional() }).nullable() }).nullable(),
				})
				.nullable(),
		})
		.nullish(),
	errors: GraphqlErrorsWireSchema.optional(),
});

export type GithubCommitHistoryResponseWire = z.output<typeof GithubCommitHistoryResponseWireSchema>;

// ── The token account's repositories (GraphQL) ──────────────────────────────

export const GithubRepositoryNodeWireSchema = z.object({
	name: z.string(),
	owner: z.object({ login: z.string() }),
	pushedAt: z.iso.datetime({ offset: true }).nullable(),
});

export type GithubRepositoryNodeWire = z.output<typeof GithubRepositoryNodeWireSchema>;

export const GithubViewerRepositoriesWireSchema = z.object({
	login: z.string(),
	repositories: z.object({ nodes: z.array(GithubRepositoryNodeWireSchema) }),
	repositoriesContributedTo: z.object({ nodes: z.array(GithubRepositoryNodeWireSchema) }),
});

export type GithubViewerRepositoriesWire = z.output<typeof GithubViewerRepositoriesWireSchema>;

export const GithubViewerRepositoriesResponseWireSchema = z.object({
	data: z.object({ viewer: GithubViewerRepositoriesWireSchema.nullable() }).nullish(),
	errors: GraphqlErrorsWireSchema.optional(),
});

// ── Contributor statistics (REST) ──────────────────────────────────────────

/** One week of one contributor: `a` lines added, `d` lines deleted, `c` commits. */
const ContributorWeekWireSchema = z.object({
	a: z.number().int().nonnegative(),
	d: z.number().int().nonnegative(),
	c: z.number().int().nonnegative(),
});

export const GithubContributorStatWireSchema = z.object({
	/** `null` for commits whose author has no GitHub account any more. */
	author: z.object({ login: z.string(), avatar_url: z.url().nullable(), html_url: z.url() }).nullable(),
	total: z.number().int().nonnegative(),
	weeks: z.array(ContributorWeekWireSchema),
});

export type GithubContributorStatWire = z.output<typeof GithubContributorStatWireSchema>;

export const GithubContributorStatsWireSchema = z.array(GithubContributorStatWireSchema);
