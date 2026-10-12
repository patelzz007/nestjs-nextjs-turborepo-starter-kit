import { describe, expect, it } from "vitest";

import {
	GITHUB_COMMIT_FILES_MAX,
	GITHUB_COMMIT_PAGE_DEFAULT_LIMIT,
	GITHUB_FILE_PATCH_MAX_LENGTH,
	GITHUB_COMMIT_PAGE_MAX_LIMIT,
	GithubAccountLoginSchema,
	GithubCommitDetailSchema,
	GithubCommitFileDiffSchema,
	GithubCommitHistoryInputSchema,
	GithubCommitHistoryQuerySchema,
	GithubCommitParamsSchema,
	GithubCommitSchema,
	GithubContributorStatsSchema,
	GithubOwnerSchema,
	GithubRepositoryListSchema,
	GithubRepositoryNameSchema,
	GithubRepositoryParamsSchema,
	toGithubFullName,
} from "./github-contributions";

const SHA = "0123456789abcdef0123456789abcdef01234567";

describe("GithubOwnerSchema", () => {
	it.each(["octocat", "octo-org", "a", "A1-b2", "x".repeat(39)])("accepts %j", (owner: string) => {
		expect(GithubOwnerSchema.safeParse(owner).success).toBe(true);
	});

	it.each(["", "-octo", "octo-", "octo--org", "octo_org", "octo.org", "octo org", "x".repeat(40), "dependabot[bot]"])("rejects %j", (owner: string) => {
		expect(GithubOwnerSchema.safeParse(owner).success).toBe(false);
	});
});

describe("GithubAccountLoginSchema", () => {
	it.each(["octocat", "dependabot[bot]", "github-actions[bot]"])("accepts %j (users and bot accounts)", (login: string) => {
		expect(GithubAccountLoginSchema.safeParse(login).success).toBe(true);
	});

	it.each(["[bot]", "octo[bot]x", "-x[bot]", "octo cat"])("rejects %j", (login: string) => {
		expect(GithubAccountLoginSchema.safeParse(login).success).toBe(false);
	});
});

describe("GithubRepositoryNameSchema", () => {
	it.each(["hello-world", "next.js", "my_repo", ".github", "a".repeat(100)])("accepts %j", (name: string) => {
		expect(GithubRepositoryNameSchema.safeParse(name).success).toBe(true);
	});

	it.each(["", ".", "..", "hello world", "hello/world", "a".repeat(101)])("rejects %j", (name: string) => {
		expect(GithubRepositoryNameSchema.safeParse(name).success).toBe(false);
	});
});

describe("GithubRepositoryParamsSchema", () => {
	it("refuses keys other than owner and repository", () => {
		expect(GithubRepositoryParamsSchema.safeParse({ owner: "octo-org", repository: "hello-world", extra: "x" }).success).toBe(false);
	});
});

describe("toGithubFullName", () => {
	it("joins owner and repository with a slash", () => {
		expect(toGithubFullName({ owner: "octo-org", repository: "hello-world" })).toBe("octo-org/hello-world");
	});
});

describe("GithubCommitHistoryQuerySchema", () => {
	it("defaults the page size and leaves the cursor out", () => {
		expect(GithubCommitHistoryQuerySchema.parse({})).toEqual({ limit: GITHUB_COMMIT_PAGE_DEFAULT_LIMIT });
	});

	it("coerces the page size from the query string", () => {
		expect(GithubCommitHistoryQuerySchema.parse({ limit: "5", cursor: `${SHA} 19` })).toEqual({ limit: 5, cursor: `${SHA} 19` });
	});

	it.each(["0", String(GITHUB_COMMIT_PAGE_MAX_LIMIT + 1), "2.5", "many"])("rejects limit=%j", (limit: string) => {
		expect(GithubCommitHistoryQuerySchema.safeParse({ limit }).success).toBe(false);
	});

	it("rejects an empty or oversized cursor", () => {
		expect(GithubCommitHistoryQuerySchema.safeParse({ cursor: "  " }).success).toBe(false);
		expect(GithubCommitHistoryQuerySchema.safeParse({ cursor: "c".repeat(201) }).success).toBe(false);
	});

	it("combines with the path params into the contract input", () => {
		expect(GithubCommitHistoryInputSchema.parse({ owner: "octo-org", repository: "hello-world", limit: "10" })).toEqual({
			owner: "octo-org",
			repository: "hello-world",
			limit: 10,
		});
	});
});

describe("GithubCommitSchema", () => {
	const commit = {
		sha: SHA,
		shortSha: "0123456",
		headline: "feat: x",
		htmlUrl: `https://github.com/octo-org/hello-world/commit/${SHA}`,
		committedAt: 1_800_000_000_000,
		author: { name: "Octo Cat", login: "octocat", avatarUrl: null },
		additions: 1,
		deletions: 0,
		changedFiles: null,
	};

	it("accepts a full commit", () => {
		expect(GithubCommitSchema.safeParse(commit).success).toBe(true);
	});

	it.each([
		["a short sha", { sha: "0123456" }],
		["an uppercase sha", { sha: SHA.toUpperCase() }],
		["negative additions", { additions: -1 }],
	])("rejects %s", (_label: string, overrides: object) => {
		expect(GithubCommitSchema.safeParse({ ...commit, ...overrides }).success).toBe(false);
	});
});

describe("GithubContributorStatsSchema", () => {
	it("accepts `computing` and `ready` with contributors", () => {
		expect(GithubContributorStatsSchema.safeParse({ status: "computing" }).success).toBe(true);
		expect(
			GithubContributorStatsSchema.safeParse({
				status: "ready",
				contributors: [{ login: "octocat", avatarUrl: null, htmlUrl: "https://github.com/octocat", commits: 3, additions: 10, deletions: 2 }],
			}).success,
		).toBe(true);
	});

	it("requires contributors once ready", () => {
		expect(GithubContributorStatsSchema.safeParse({ status: "ready" }).success).toBe(false);
	});
});

describe("GithubRepositoryListSchema", () => {
	const item = { owner: "patelzz007", repository: "site", fullName: "patelzz007/site", relationship: "owned", pushedAt: 1_800_000_000_000 };

	it("accepts a discovered list naming its account", () => {
		expect(GithubRepositoryListSchema.safeParse({ source: "discovered", account: "patelzz007", repositories: [item] }).success).toBe(true);
	});

	it("accepts a pinned list with no account and unknown push times", () => {
		expect(
			GithubRepositoryListSchema.safeParse({ source: "configured", account: null, repositories: [{ ...item, relationship: "configured", pushedAt: null }] }).success,
		).toBe(true);
	});

	it.each([
		["an unknown source", { source: "guessed", account: null, repositories: [] }],
		["an unknown relationship", { source: "discovered", account: "patelzz007", repositories: [{ ...item, relationship: "starred" }] }],
		["more than 100 repositories", { source: "discovered", account: "patelzz007", repositories: Array.from({ length: 101 }, () => item) }],
	])("rejects %s", (_label: string, list: object) => {
		expect(GithubRepositoryListSchema.safeParse(list).success).toBe(false);
	});
});

describe("GithubCommitParamsSchema", () => {
	const repository = { owner: "octo-org", repository: "hello-world" };

	it("accepts a full lowercase SHA", () => {
		expect(GithubCommitParamsSchema.safeParse({ ...repository, sha: SHA }).success).toBe(true);
	});

	it.each([
		["a short SHA", SHA.slice(0, 7)],
		["an uppercase SHA", SHA.toUpperCase()],
		["a branch name", "main".padEnd(40, "x")],
		["a path", `../${SHA.slice(3)}`],
	])("rejects %s", (_label: string, sha: string) => {
		expect(GithubCommitParamsSchema.safeParse({ ...repository, sha }).success).toBe(false);
	});

	it("rejects unknown keys", () => {
		expect(GithubCommitParamsSchema.safeParse({ ...repository, sha: SHA, ref: "main" }).success).toBe(false);
	});
});

describe("GithubCommitFileDiffSchema", () => {
	it.each([{ kind: "patch", patch: "@@ -1 +1 @@\n-a\n+b" }, { kind: "too-large" }, { kind: "unavailable" }])("accepts %j", (diff: object) => {
		expect(GithubCommitFileDiffSchema.safeParse(diff).success).toBe(true);
	});

	it.each([
		["a patch without text", { kind: "patch", patch: "" }],
		["a patch past the per-file limit", { kind: "patch", patch: "+".repeat(GITHUB_FILE_PATCH_MAX_LENGTH + 1) }],
		["an unknown kind", { kind: "binary" }],
	])("rejects %s", (_label: string, diff: object) => {
		expect(GithubCommitFileDiffSchema.safeParse(diff).success).toBe(false);
	});
});

describe("GithubCommitDetailSchema", () => {
	const file = { path: "src/app.ts", previousPath: null, status: "modified", additions: 1, deletions: 1, diff: { kind: "unavailable" } };
	const detail = {
		sha: SHA,
		shortSha: SHA.slice(0, 7),
		headline: "feat: x",
		htmlUrl: `https://github.com/octo-org/hello-world/commit/${SHA}`,
		committedAt: 1_800_000_000_000,
		author: { name: "Octo Cat", login: "octocat", avatarUrl: null },
		additions: 1,
		deletions: 1,
		changedFiles: 1,
		message: "feat: x\n\nWhy.",
		parents: [{ sha: SHA, shortSha: SHA.slice(0, 7) }],
		files: [file],
		filesTruncated: false,
	};

	it("accepts a commit with its files", () => {
		expect(GithubCommitDetailSchema.safeParse(detail).success).toBe(true);
	});

	it.each([
		["an unknown file status", { ...detail, files: [{ ...file, status: "moved" }] }],
		["an empty path", { ...detail, files: [{ ...file, path: "" }] }],
		["more files than one page", { ...detail, files: Array.from({ length: GITHUB_COMMIT_FILES_MAX + 1 }, () => file) }],
		["a parent that is not a SHA", { ...detail, parents: [{ sha: "main", shortSha: "main" }] }],
	])("rejects %s", (_label: string, candidate: object) => {
		expect(GithubCommitDetailSchema.safeParse(candidate).success).toBe(false);
	});
});
