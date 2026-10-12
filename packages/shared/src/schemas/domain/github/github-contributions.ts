// ============================================
// github-contributions.ts - GitHub repository contributions (read-only)
// ============================================
// The API reads GitHub with its own token and answers four views: the list of
// repositories it may read, a repository summary, the commit history with line
// counts, and per-contributor totals. The list is either pinned by config
// (`GITHUB_REPOSITORIES`) or, when that is empty, discovered from the token's
// account: its own public repositories plus the public ones it contributed to.
// Clients never name a repository outside that list — an unknown one is a 404,
// so the API's token is never an open proxy to GitHub.

import { z } from "zod";

import { EpochMsSchema } from "../../api/common";

// ── Identifiers ────────────────────────────────────────────────────────────

/** GitHub's own limit on a user or organization login. */
export const GITHUB_OWNER_MAX_LENGTH = 39;
/** GitHub's own limit on a repository name. */
export const GITHUB_REPOSITORY_NAME_MAX_LENGTH = 100;

/** Runs of alphanumerics joined by single hyphens — never leading, trailing or doubled (GitHub's login rule). */
const GITHUB_OWNER_PATTERN = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;
/** Letters, digits, `.`, `_` and `-` — the characters GitHub keeps in a repository name. */
const GITHUB_REPOSITORY_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;
/** `.` and `..` match the pattern above but GitHub reserves them. */
const RESERVED_REPOSITORY_NAMES: readonly string[] = [".", ".."];

/** A GitHub user or organization login (`vercel`, `octo-org`). */
export const GithubOwnerSchema = z
	.string()
	.min(1)
	.max(GITHUB_OWNER_MAX_LENGTH)
	.regex(GITHUB_OWNER_PATTERN, "must be a GitHub user or organization name")
	.meta({ description: "GitHub user or organization", example: "octo-org" });

/** A GitHub repository name (`next.js`, `hello-world`). */
export const GithubRepositoryNameSchema = z
	.string()
	.min(1)
	.max(GITHUB_REPOSITORY_NAME_MAX_LENGTH)
	.regex(GITHUB_REPOSITORY_NAME_PATTERN, "must be a GitHub repository name")
	.refine((name: string): boolean => !RESERVED_REPOSITORY_NAMES.includes(name), { error: "must be a GitHub repository name" })
	.meta({ description: "GitHub repository name", example: "hello-world" });

/** GitHub suffixes app (bot) accounts with this, outside the normal login rule (`dependabot[bot]`). */
const GITHUB_BOT_SUFFIX = "[bot]";
const GITHUB_ACCOUNT_LOGIN_PATTERN = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$/;

/** The login of a GitHub account that wrote commits — a user, or an app's bot account (`dependabot[bot]`). */
export const GithubAccountLoginSchema = z
	.string()
	.min(1)
	.max(GITHUB_OWNER_MAX_LENGTH + GITHUB_BOT_SUFFIX.length)
	.regex(GITHUB_ACCOUNT_LOGIN_PATTERN, "must be a GitHub account login")
	.meta({ description: "GitHub account login", example: "octocat" });

/** Path params of every per-repository route: `/github/repositories/:owner/:repository/…`. */
export const GithubRepositoryParamsSchema = z
	.object({
		owner: GithubOwnerSchema,
		repository: GithubRepositoryNameSchema,
	})
	.strict();

export type GithubRepositoryParams = z.output<typeof GithubRepositoryParamsSchema>;

/** One repository the server is configured to read — its full name is `owner/repository`. */
export const GithubRepositoryRefSchema = z.object({
	owner: GithubOwnerSchema,
	repository: GithubRepositoryNameSchema,
	fullName: z.string().max(GITHUB_OWNER_MAX_LENGTH + 1 + GITHUB_REPOSITORY_NAME_MAX_LENGTH),
});

export type GithubRepositoryRef = z.output<typeof GithubRepositoryRefSchema>;

/** The `owner/repository` full name of a repository. */
export function toGithubFullName(params: GithubRepositoryParams): string {
	return `${params.owner}/${params.repository}`;
}

// ── The repositories the API may read ──────────────────────────────────────

/** Most repositories `GITHUB_REPOSITORIES` may list — every one is a separate GitHub read per cache window. */
export const GITHUB_REPOSITORIES_MAX = 20;

/** Most repositories discovery asks GitHub for, per kind (owned / contributed to), most recently pushed first. */
export const GITHUB_DISCOVERY_PER_KIND_MAX = 50;

/** Discovery reads two kinds of repositories: owned and contributed to. */
const GITHUB_DISCOVERY_KINDS = 2;

/** Most repositories the list answers with (both discovered kinds together). */
export const GITHUB_REPOSITORY_LIST_MAX = GITHUB_DISCOVERY_KINDS * GITHUB_DISCOVERY_PER_KIND_MAX;

/**
 * Where the list came from: `off` (no `GITHUB_TOKEN`), `configured`
 * (`GITHUB_REPOSITORIES`), or `discovered` from the token's account.
 */
export const GithubRepositorySourceSchema = z.enum(["off", "configured", "discovered"]);
export type GithubRepositorySource = z.output<typeof GithubRepositorySourceSchema>;

/** How the account relates to a discovered repository; `configured` for a pinned one. */
export const GithubRepositoryRelationshipSchema = z.enum(["configured", "owned", "contributed"]);
export type GithubRepositoryRelationship = z.output<typeof GithubRepositoryRelationshipSchema>;

export const GithubRepositoryListItemSchema = GithubRepositoryRefSchema.extend({
	relationship: GithubRepositoryRelationshipSchema,
	/** Last push; `null` when unknown (pinned repositories are listed without asking GitHub). */
	pushedAt: EpochMsSchema.nullable(),
});

export type GithubRepositoryListItem = z.output<typeof GithubRepositoryListItemSchema>;

/** Response body (ADR 022): open object — clients tolerate fields added later. */
export const GithubRepositoryListSchema = z.object({
	source: GithubRepositorySourceSchema,
	/** The token's GitHub login when the list was discovered from it, otherwise `null`. */
	account: GithubAccountLoginSchema.nullable(),
	repositories: z.array(GithubRepositoryListItemSchema).max(GITHUB_REPOSITORY_LIST_MAX),
});

export type GithubRepositoryList = z.output<typeof GithubRepositoryListSchema>;

// ── Repository summary ─────────────────────────────────────────────────────

/** Most languages a summary lists — GitHub orders them by size, the long tail is dropped. */
export const GITHUB_SUMMARY_LANGUAGES_MAX = 10;

const PERCENT_MAX = 100;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/** One language of a repository and its share of the code, by bytes. */
export const GithubLanguageShareSchema = z.object({
	name: z.string().min(1).max(GITHUB_REPOSITORY_NAME_MAX_LENGTH),
	/** GitHub's colour for the language (`#3178c6`), `null` when GitHub has none. */
	color: z.string().regex(HEX_COLOR_PATTERN).nullable(),
	bytes: z.number().int().nonnegative(),
	/** Share of the listed languages' bytes, 0–100, one decimal. */
	percent: z.number().min(0).max(PERCENT_MAX),
});

export type GithubLanguageShare = z.output<typeof GithubLanguageShareSchema>;

export const GithubRepositorySummarySchema = z.object({
	owner: GithubOwnerSchema,
	repository: GithubRepositoryNameSchema,
	fullName: z.string(),
	description: z.string().nullable(),
	htmlUrl: z.url(),
	/** `null` for an empty repository (no commits yet). */
	defaultBranch: z.string().nullable(),
	primaryLanguage: z.string().nullable(),
	stars: z.number().int().nonnegative(),
	forks: z.number().int().nonnegative(),
	watchers: z.number().int().nonnegative(),
	openIssues: z.number().int().nonnegative(),
	/** Commits on the default branch; `0` for an empty repository. */
	totalCommits: z.number().int().nonnegative(),
	pushedAt: EpochMsSchema.nullable(),
	languages: z.array(GithubLanguageShareSchema).max(GITHUB_SUMMARY_LANGUAGES_MAX),
});

export type GithubRepositorySummary = z.output<typeof GithubRepositorySummarySchema>;

// ── Commit history ─────────────────────────────────────────────────────────

export const GITHUB_COMMIT_PAGE_DEFAULT_LIMIT = 20;
/** GitHub's GraphQL `history(first:)` accepts at most 100; 50 keeps one page cheap to compute. */
export const GITHUB_COMMIT_PAGE_MAX_LIMIT = 50;
/** GitHub's history cursors are short (`<sha> <offset>`); anything longer is not one. */
export const GITHUB_COMMIT_CURSOR_MAX_LENGTH = 200;

/** Query string of the commit history: an opaque cursor from the previous page and the page size. */
export const GithubCommitHistoryQuerySchema = z
	.object({
		cursor: z.string().trim().min(1).max(GITHUB_COMMIT_CURSOR_MAX_LENGTH).optional().describe("`nextCursor` of the previous page; omit for the newest commits"),
		limit: z.coerce
			.number()
			.int()
			.min(1)
			.max(GITHUB_COMMIT_PAGE_MAX_LIMIT)
			.optional()
			.default(GITHUB_COMMIT_PAGE_DEFAULT_LIMIT)
			.describe(`Commits per page (1-${String(GITHUB_COMMIT_PAGE_MAX_LIMIT)})`),
	})
	.strict();

export type GithubCommitHistoryQuery = z.output<typeof GithubCommitHistoryQuerySchema>;

/** The whole commit-history input: the repository path params plus the query string. */
export const GithubCommitHistoryInputSchema = z.intersection(GithubRepositoryParamsSchema, GithubCommitHistoryQuerySchema);

export type GithubCommitHistoryInput = z.input<typeof GithubCommitHistoryInputSchema>;

/** A full git object id: 40 lowercase hex characters. */
const GIT_SHA_LENGTH = 40;
const GIT_SHA_PATTERN = /^[0-9a-f]+$/;

/** A full commit id (`a1b2…`, 40 lowercase hex characters) — the only form a commit is addressed by. */
export const GithubCommitShaSchema = z
	.string()
	.length(GIT_SHA_LENGTH)
	.regex(GIT_SHA_PATTERN, "must be a full commit SHA")
	.meta({ description: "Full commit SHA (40 lowercase hex characters)", example: "4f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39" });

/** Path params of one commit: `/github/repositories/:owner/:repository/commits/:sha`. */
export const GithubCommitParamsSchema = z
	.object({
		owner: GithubOwnerSchema,
		repository: GithubRepositoryNameSchema,
		sha: GithubCommitShaSchema,
	})
	.strict();

export type GithubCommitParams = z.output<typeof GithubCommitParamsSchema>;

/** Who wrote a commit: the git author name, and the GitHub account when the email maps to one. */
export const GithubCommitAuthorSchema = z.object({
	name: z.string(),
	login: GithubAccountLoginSchema.nullable(),
	avatarUrl: z.url().nullable(),
});

export type GithubCommitAuthor = z.output<typeof GithubCommitAuthorSchema>;

export const GithubCommitSchema = z.object({
	sha: GithubCommitShaSchema,
	shortSha: z.string().min(1).max(GIT_SHA_LENGTH).regex(GIT_SHA_PATTERN),
	/** The first line of the commit message. */
	headline: z.string(),
	htmlUrl: z.url(),
	committedAt: EpochMsSchema,
	author: GithubCommitAuthorSchema,
	additions: z.number().int().nonnegative(),
	deletions: z.number().int().nonnegative(),
	/** `null` when GitHub could not count the files (very large commits). */
	changedFiles: z.number().int().nonnegative().nullable(),
});

export type GithubCommit = z.output<typeof GithubCommitSchema>;

export const GithubCommitPageSchema = z.object({
	items: z.array(GithubCommitSchema).max(GITHUB_COMMIT_PAGE_MAX_LIMIT),
	/** Pass back as `cursor` for the next (older) page; `null` on the last page. */
	nextCursor: z.string().max(GITHUB_COMMIT_CURSOR_MAX_LENGTH).nullable(),
	/** Commits on the default branch. */
	totalCommits: z.number().int().nonnegative(),
});

export type GithubCommitPage = z.output<typeof GithubCommitPageSchema>;

// ── One commit, with its diff ──────────────────────────────────────────────

/** Most changed files one commit answers with — GitHub's own page size for a commit's files. */
export const GITHUB_COMMIT_FILES_MAX = 100;
/** Most parents listed — a merge has two; an octopus merge may have more. */
export const GITHUB_COMMIT_PARENTS_MAX = 8;
/** Longest commit message kept; anything beyond is cut (GitHub still has it all). */
export const GITHUB_COMMIT_MESSAGE_MAX_LENGTH = 10_000;
/** Longest path git and GitHub keep for a file. */
export const GITHUB_FILE_PATH_MAX_LENGTH = 4_096;
/** Longest diff of ONE file sent; a longer one is answered `too-large`, so one huge file cannot crowd out the rest. */
export const GITHUB_FILE_PATCH_MAX_LENGTH = 20_000;
/** Longest the diffs of one commit may be together; files past the budget are answered `too-large`. */
export const GITHUB_COMMIT_DIFF_MAX_LENGTH = 200_000;

/** What happened to a file in a commit, in GitHub's words. */
export const GithubCommitFileStatusSchema = z.enum(["added", "removed", "modified", "renamed", "copied", "changed", "unchanged"]);
export type GithubCommitFileStatus = z.output<typeof GithubCommitFileStatusSchema>;

/**
 * A file's diff: the unified `patch` (hunks only, no `diff --git` header), or
 * why there is none — `too-large` past this API's limits
 * ({@link GITHUB_FILE_PATCH_MAX_LENGTH}, {@link GITHUB_COMMIT_DIFF_MAX_LENGTH}),
 * `unavailable` when GitHub sends no text diff (a binary file, a rename without
 * changes, or past GitHub's own limits).
 */
export const GithubCommitFileDiffSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("patch"), patch: z.string().min(1).max(GITHUB_FILE_PATCH_MAX_LENGTH) }),
	z.object({ kind: z.literal("too-large") }),
	z.object({ kind: z.literal("unavailable") }),
]);

export type GithubCommitFileDiff = z.output<typeof GithubCommitFileDiffSchema>;

export const GithubCommitFileSchema = z.object({
	/** The file's path after the commit. */
	path: z.string().min(1).max(GITHUB_FILE_PATH_MAX_LENGTH),
	/** Its path before a rename or copy; `null` otherwise. */
	previousPath: z.string().min(1).max(GITHUB_FILE_PATH_MAX_LENGTH).nullable(),
	status: GithubCommitFileStatusSchema,
	additions: z.number().int().nonnegative(),
	deletions: z.number().int().nonnegative(),
	diff: GithubCommitFileDiffSchema,
});

export type GithubCommitFile = z.output<typeof GithubCommitFileSchema>;

/** A parent commit, by id. */
export const GithubCommitParentSchema = z.object({
	sha: GithubCommitShaSchema,
	shortSha: z.string().min(1).max(GIT_SHA_LENGTH).regex(GIT_SHA_PATTERN),
});

export type GithubCommitParent = z.output<typeof GithubCommitParentSchema>;

/**
 * One commit as its own page shows it: everything the history row has, plus
 * the whole message, its parents and every changed file with its diff.
 * `additions` / `deletions` count the whole commit; `changedFiles` is `null`
 * when the commit changed more files than listed (`filesTruncated`).
 */
export const GithubCommitDetailSchema = GithubCommitSchema.extend({
	/** The whole commit message — the headline, then the body. */
	message: z.string().max(GITHUB_COMMIT_MESSAGE_MAX_LENGTH),
	parents: z.array(GithubCommitParentSchema).max(GITHUB_COMMIT_PARENTS_MAX),
	files: z.array(GithubCommitFileSchema).max(GITHUB_COMMIT_FILES_MAX),
	/** `true` when the commit changed more files than {@link GITHUB_COMMIT_FILES_MAX}; the rest are on GitHub. */
	filesTruncated: z.boolean(),
});

export type GithubCommitDetail = z.output<typeof GithubCommitDetailSchema>;

// ── Contributors ───────────────────────────────────────────────────────────

/** GitHub's statistics endpoint reports the top 100 contributors only. */
export const GITHUB_CONTRIBUTORS_MAX = 100;

export const GithubContributorSchema = z.object({
	login: GithubAccountLoginSchema,
	avatarUrl: z.url().nullable(),
	htmlUrl: z.url(),
	commits: z.number().int().nonnegative(),
	additions: z.number().int().nonnegative(),
	deletions: z.number().int().nonnegative(),
});

export type GithubContributor = z.output<typeof GithubContributorSchema>;

/**
 * GitHub computes contributor statistics in the background: the first read
 * of a repository (or the first after a push) answers `computing`, and the
 * client asks again a little later. `ready` lists contributors by commits,
 * most first.
 */
export const GithubContributorStatsSchema = z.discriminatedUnion("status", [
	z.object({ status: z.literal("computing") }),
	z.object({ status: z.literal("ready"), contributors: z.array(GithubContributorSchema).max(GITHUB_CONTRIBUTORS_MAX) }),
]);

export type GithubContributorStats = z.output<typeof GithubContributorStatsSchema>;
