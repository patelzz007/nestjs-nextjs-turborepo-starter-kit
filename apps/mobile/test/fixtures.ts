// API payloads as the API sends them (plain JSON), valid against the shared
// response schemas — the api-client parses every one of them in the tests.

import type { DataValue } from "@workspace/shared";

import { FULL_ACCESS_TOKEN, REFRESH_TOKEN } from "./jwt";

export const NOW_MS = 1_791_504_000_000;

const HOUR_MS = 3_600_000;

interface UserOverrides {
	/** A real UUID, for requests whose schema checks the user id (an upload for yourself). */
	readonly id?: string;
	readonly twoFactorEnabled?: boolean;
	readonly fullName?: string;
	readonly isEmailVerified?: boolean;
}

export function userJson(overrides: UserOverrides = {}): DataValue {
	return {
		id: overrides.id ?? "user-1",
		email: "member@example.com",
		fullName: overrides.fullName ?? "Alex Morgan",
		isActive: true,
		isSuperAdmin: false,
		isEmailVerified: overrides.isEmailVerified ?? true,
		twoFactorEnabled: overrides.twoFactorEnabled ?? false,
		hasAdminAccess: false,
		tokenVersion: 1,
		roles: [],
		createdAt: 0,
		updatedAt: 0,
		isDeleted: false,
		deletedAt: null,
	};
}

/** `GET /session`: who the access token belongs to and when it expires (epoch ms, or `null`). */
export function sessionStatusJson(expiresAt: number | null): DataValue {
	return { userId: "user-1", email: "member@example.com", fullName: "Alex Morgan", expiresAt, checkedAt: NOW_MS };
}

/** `POST /auth/login` for client type mobile: the user plus the tokens in the body (ADR 029). */
export function mobileLoginJson(accessToken: string = FULL_ACCESS_TOKEN, refreshToken: string = REFRESH_TOKEN): DataValue {
	return { user: userJson(), tokenTransport: "body", accessToken, refreshToken };
}

export function profileJson(version = 3, fullName = "Alex Morgan"): DataValue {
	return { id: "6f1c3b8e-6a64-4b4e-9b7a-2f1f0a6f8d21", email: "member@example.com", fullName, avatar: null, version, createdAt: 0, updatedAt: 0 };
}

interface SessionJsonOverrides {
	readonly id: string;
	readonly label: string;
	readonly isCurrent?: boolean;
	readonly clientType?: "web" | "admin" | "merchant" | "mobile";
}

export function sessionJson(overrides: SessionJsonOverrides): DataValue {
	const isMobile = overrides.clientType === "mobile";
	return {
		id: overrides.id,
		label: overrides.label,
		isCurrent: overrides.isCurrent ?? false,
		clientType: overrides.clientType ?? "web",
		browserName: isMobile ? null : "Chrome",
		browserVersion: isMobile ? null : "141.0.0.0",
		osName: isMobile ? "iOS" : "macOS",
		osVersion: isMobile ? "26.0" : "16.1",
		deviceType: isMobile ? "MOBILE" : "DESKTOP",
		deviceModel: isMobile ? "iPhone 15 Pro" : null,
		deviceName: isMobile ? "Alex’s iPhone" : null,
		appVersion: isMobile ? "1.0.0" : null,
		signInMethod: "PASSWORD_TOTP",
		ipAddress: "203.0.113.24",
		lastIpAddress: "198.51.100.7",
		location: null,
		createdAt: NOW_MS - 2 * HOUR_MS,
		lastActiveAt: NOW_MS - HOUR_MS,
		expiresAt: NOW_MS + 24 * HOUR_MS,
	};
}

export function twoFactorSetupJson(): DataValue {
	return {
		secret: "JBSWY3DPEHPK3PXP",
		qrCodeDataUrl: "data:image/png;base64,iVBORw0KGgo=",
		otpAuthUrl: "otpauth://totp/Starter:member%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Starter",
		// Ten distinct codes from the backup-code alphabet (no 0/O, 1/I/L).
		backupCodes: ["S", "T", "U", "V", "W", "X", "Y", "Z", "2", "3"].map((last: string): string => `ABCDEFGHJKMNPQR${last}`),
	};
}

// ── GitHub contributions ───────────────────────────────────────────────────

/** `GET /github/repositories`: repositories pinned by `GITHUB_REPOSITORIES` (`owner/repository` full names). */
export function githubRepositoriesJson(fullNames: readonly string[] = ["octo-org/hello-world"]): DataValue {
	return {
		source: fullNames.length === 0 ? "off" : "configured",
		account: null,
		repositories: fullNames.map((fullName: string): DataValue => {
			const [owner = "", repository = ""] = fullName.split("/");
			return { owner, repository, fullName, relationship: "configured", pushedAt: null };
		}),
	};
}

/** `GET /github/repositories` discovered from `account`: its own repositories, then the ones it contributed to, each pushed a day before the previous. */
export function githubDiscoveredRepositoriesJson(account: string, owned: readonly string[], contributed: readonly string[] = []): DataValue {
	const items = [
		...owned.map((fullName: string) => ({ fullName, relationship: "owned" })),
		...contributed.map((fullName: string) => ({ fullName, relationship: "contributed" })),
	];
	return {
		source: "discovered",
		account,
		repositories: items.map(({ fullName, relationship }, index: number): DataValue => {
			const [owner = "", repository = ""] = fullName.split("/");
			return { owner, repository, fullName, relationship, pushedAt: NOW_MS - (index + 1) * 24 * HOUR_MS };
		}),
	};
}

/** `GET /github/repositories/:owner/:repository`. */
export function githubSummaryJson(fullName = "octo-org/hello-world"): DataValue {
	const [owner = "", repository = ""] = fullName.split("/");
	return {
		owner,
		repository,
		fullName,
		description: "A hello world repository",
		htmlUrl: `https://github.com/${fullName}`,
		defaultBranch: "main",
		primaryLanguage: "TypeScript",
		stars: 1204,
		forks: 7,
		watchers: 5,
		openIssues: 3,
		totalCommits: 128,
		pushedAt: NOW_MS - 2 * HOUR_MS,
		languages: [
			{ name: "TypeScript", color: "#3178c6", bytes: 750, percent: 75 },
			{ name: "CSS", color: "#663399", bytes: 250, percent: 25 },
		],
	};
}

interface GithubCommitJsonOverrides {
	readonly index: number;
	readonly headline?: string;
}

/** One commit; `index` makes its sha (and so its key) unique. */
export function githubCommitJson({ index, headline }: GithubCommitJsonOverrides): DataValue {
	const sha = index.toString(16).padStart(40, "0");
	return {
		sha,
		shortSha: sha.slice(0, 7),
		headline: headline ?? `Commit ${String(index)}`,
		htmlUrl: `https://github.com/octo-org/hello-world/commit/${sha}`,
		committedAt: NOW_MS - HOUR_MS,
		author: { name: "Octo Cat", login: "octocat", avatarUrl: null },
		additions: 120,
		deletions: 30,
		changedFiles: 4,
	};
}

/** The diff of `src/app.ts` in {@link githubCommitDetailJson}: one hunk, one line changed, one added. */
export const GITHUB_COMMIT_PATCH = '@@ -1,3 +1,4 @@ export function app() {\n import { a } from "./a";\n-const b = 1;\n+const b = 2;\n+const c = 3;\n export default a;';

/** `GET /github/repositories/:owner/:repository/commits/:sha` for commit `index` of {@link githubCommitJson}: a modified file, a renamed one and a binary one. */
export function githubCommitDetailJson(index: number, overrides: Readonly<Record<string, DataValue>> = {}): DataValue {
	const parent = (index + 1).toString(16).padStart(40, "0");
	return {
		...githubCommitDetailBase(index),
		message: "feat: add contributions\n\nShows each commit's changed files.",
		parents: [{ sha: parent, shortSha: parent.slice(0, 7) }],
		files: [
			{ path: "src/app.ts", previousPath: null, status: "modified", additions: 2, deletions: 1, diff: { kind: "patch", patch: GITHUB_COMMIT_PATCH } },
			{ path: "src/new-name.ts", previousPath: "src/old-name.ts", status: "renamed", additions: 0, deletions: 0, diff: { kind: "unavailable" } },
			{ path: "assets/logo.png", previousPath: null, status: "added", additions: 0, deletions: 0, diff: { kind: "unavailable" } },
		],
		filesTruncated: false,
		changedFiles: 3,
		additions: 2,
		deletions: 1,
		...overrides,
	};
}

function githubCommitDetailBase(index: number): Readonly<Record<string, DataValue>> {
	const sha = index.toString(16).padStart(40, "0");
	return {
		sha,
		shortSha: sha.slice(0, 7),
		headline: "feat: add contributions",
		htmlUrl: `https://github.com/octo-org/hello-world/commit/${sha}`,
		committedAt: NOW_MS - HOUR_MS,
		author: { name: "Octo Cat", login: "octocat", avatarUrl: null },
	};
}

/** `GET /github/repositories/:owner/:repository/commits`. */
export function githubCommitPageJson(items: readonly DataValue[], nextCursor: string | null = null): DataValue {
	return { items: [...items], nextCursor, totalCommits: 128 };
}

/** `GET /github/repositories/:owner/:repository/contributors`: from GitHub's statistics unless `basis` says otherwise. */
export function githubContributorsJson(logins: readonly string[] = ["octocat"], basis: DataValue = { kind: "statistics" }): DataValue {
	return {
		status: "ready",
		basis,
		contributors: logins.map((login: string, index: number): DataValue => ({
			login,
			avatarUrl: null,
			htmlUrl: `https://github.com/${login}`,
			commits: logins.length - index,
			additions: 1000,
			deletions: 250,
		})),
	};
}

// ── GitHub pull requests (ADR 052) ─────────────────────────────────────────

/** `GET /github/account` with a working token linked as octocat (no expiry). */
export function githubAccountLinkedJson(health: "active" | "rejected" = "active"): Readonly<Record<string, DataValue>> {
	return { status: "linked", login: "octocat", avatarUrl: null, health, linkedAt: NOW_MS - HOUR_MS, tokenExpiresAt: null };
}

/** Pull request `number` of octo-org/hello-world, open, by octocat. */
export function githubPullRequestJson(number: number, overrides: Readonly<Record<string, DataValue>> = {}): Readonly<Record<string, DataValue>> {
	return {
		owner: "octo-org",
		repository: "hello-world",
		number,
		title: `Pull request ${String(number)}`,
		state: "open",
		isDraft: false,
		author: { login: "octocat", avatarUrl: null },
		createdAt: NOW_MS - HOUR_MS,
		updatedAt: NOW_MS - HOUR_MS,
		commentCount: 2,
		reviewDecision: null,
		labels: [{ name: "bug", color: "d73a4a" }],
		htmlUrl: `https://github.com/octo-org/hello-world/pull/${String(number)}`,
		...overrides,
	};
}

/** `GET /github/pull-requests`. */
export function githubPullRequestPageJson(items: readonly DataValue[], nextCursor: string | null = null): DataValue {
	return { items: [...items], nextCursor, totalCount: items.length };
}

/** A comment by `login`, never edited unless `lastEditedAt` says so. */
export function githubCommentJson(id: string, body: string, overrides: Readonly<Record<string, DataValue>> = {}): Readonly<Record<string, DataValue>> {
	return {
		id,
		author: { login: "hubot", avatarUrl: null },
		body,
		images: [],
		reactions: [],
		reactionSubject: { type: "issueComment", commentId: "6186769145" },
		createdAt: NOW_MS - HOUR_MS,
		lastEditedAt: null,
		viewerCanUpdate: false,
		viewerDidAuthor: false,
		htmlUrl: `https://github.com/octo-org/hello-world/pull/42#issuecomment-${id}`,
		...overrides,
	};
}

/** `GET /github/pull-requests/octo-org/hello-world/42`: three commits from `feature/login` into `main`, a comment and a label event. */
export function githubPullRequestDetailJson(overrides: Readonly<Record<string, DataValue>> = {}): DataValue {
	return {
		...githubPullRequestJson(42, { title: "Add the login screen", reviewDecision: "reviewRequired" }),
		id: "PR_kwDOtest42",
		body: "Adds **the login screen**.",
		bodyImages: [],
		reactions: [],
		bodyLastEditedAt: NOW_MS - HOUR_MS,
		baseRef: "main",
		headRef: "feature/login",
		headOwner: null,
		additions: 120,
		deletions: 30,
		changedFiles: 2,
		commitCount: 3,
		requestedReviewers: [{ login: "monalisa", avatarUrl: null }],
		mergedAt: null,
		closedAt: null,
		viewerDidAuthor: true,
		viewerCanUpdate: true,
		timeline: {
			items: [
				{ type: "comment", comment: githubCommentJson("IC_first", "Looks good to me.") },
				{ type: "event", kind: "labeled", actor: { login: "octocat", avatarUrl: null }, createdAt: NOW_MS - HOUR_MS, detail: "bug" },
			],
			nextCursor: null,
		},
		...overrides,
	};
}

/** A line comment on `src/app.ts`, right side, line 2 (`const b = 2;` in {@link GITHUB_COMMIT_PATCH}). */
export function githubReviewThreadJson(id: string, overrides: Readonly<Record<string, DataValue>> = {}): DataValue {
	return {
		id,
		path: "src/app.ts",
		line: 2,
		originalLine: 2,
		side: "right",
		isResolved: false,
		isOutdated: false,
		comments: [
			{
				...githubCommentJson(`RC_${id}`, `Why two? (${id})`),
				path: "src/app.ts",
				line: 2,
				originalLine: 2,
				diffHunk: GITHUB_COMMIT_PATCH,
			},
		],
		...overrides,
	};
}

/** `GET …/files`: one modified file (`src/app.ts` unless `path` says otherwise) with {@link GITHUB_COMMIT_PATCH}. */
export function githubPullRequestFilesJson(nextPage: number | null = null, path = "src/app.ts"): DataValue {
	return {
		files: [{ path, previousPath: null, status: "modified", additions: 2, deletions: 1, diff: { kind: "patch", patch: GITHUB_COMMIT_PATCH } }],
		nextPage,
		headSha: "a".repeat(40),
	};
}

/** `GET …/42/status`: checks passed, no conflicts, and merging by any method, squash suggested. */
export function githubPullRequestStatusJson(overrides: Readonly<Record<string, DataValue>> = {}, merge: Readonly<Record<string, DataValue>> = {}): DataValue {
	return {
		checks: { kind: "summary", state: "success", successful: 3, failed: 0, pending: 0, skipped: 1 },
		mergeability: "mergeable",
		merge: {
			headSha: "a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0",
			state: "clean",
			methods: ["merge", "squash", "rebase"],
			defaultMethod: "squash",
			headBranch: "feature/login",
			canDeleteHeadBranch: true,
			deletesBranchOnMerge: false,
			...merge,
		},
		...overrides,
	};
}
