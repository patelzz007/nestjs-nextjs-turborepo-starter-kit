import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { TestingModuleBuilder } from "@nestjs/testing";
import {
	API_VERSION_PREFIX,
	GithubAccountStatusSchema,
	GithubCommentSchema,
	GithubMergeResultSchema,
	GithubPullRequestPageSchema,
	IDEMPOTENCY_KEY_HEADER,
	JsonValueSchema,
} from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { seedGithubAccountLinks } from "../prisma/seed/github-account-links";
import { GITHUB_FETCH, type GithubFetch } from "../src/modules/github/github-http.transport";
import { GITHUB_TOKEN_EXPIRATION_HEADER } from "../src/modules/github/pull-requests/github-pull-request.client";
import { restoreGithubAccountLinks, snapshotGithubAccountLinks, type GithubAccountLinkSnapshot } from "./support/github-account-link-snapshots";
import { createE2eApp, login, markSeedUserEmailVerified, mutationHeaders, parseSuccessEnvelope, uniqueClientIp, type InjectResponse, type LoginResult } from "./e2e-helpers";

/**
 * GitHub pull requests with an admin's own token (ADR 052) against the real
 * AppModule, Postgres + RLS and the audit trail — GitHub itself is faked at
 * the one HTTP boundary (`GITHUB_FETCH`). Admin-only; the token is checked
 * with GitHub, stored encrypted, never answered back, redacted from the audit
 * trail, and wiped on unlink; each admin sees only their own link.
 */

const ACCOUNT_URL = `${API_VERSION_PREFIX}/github/account`;
const LIST_URL = `${API_VERSION_PREFIX}/github/pull-requests`;
const ADMIN_EMAIL = "admin@example.com";
const SUPER_ADMIN_EMAIL = "superadmin@example.com";
const MANAGER_EMAIL = "manager@example.com";
const TOKEN = "github_pat_11E2ETEST0000000000000_e2e_only_token_value";
const REFUSED_TOKEN = "github_pat_11E2ETEST0000000000000_refused_by_github";

const COMMENTS_URL = `${API_VERSION_PREFIX}/github/pull-requests/octocat/hello-world/7/comments`;
const REVIEWS_URL = `${API_VERSION_PREFIX}/github/pull-requests/octocat/hello-world/7/reviews`;

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_CONFLICT = 409;
const HTTP_UNPROCESSABLE = 422;
const HTTP_UNAUTHORIZED = 401;

const GITHUB_USER = { id: 583231, login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/583231" };

const SEARCH_ANSWER = {
	data: {
		search: {
			issueCount: 1,
			pageInfo: { hasNextPage: false, endCursor: null },
			nodes: [
				{
					__typename: "PullRequest",
					number: 7,
					title: "Fix the thing",
					state: "OPEN",
					isDraft: false,
					createdAt: "2026-10-01T08:00:00Z",
					updatedAt: "2026-10-02T09:30:00Z",
					url: "https://github.com/octocat/hello-world/pull/7",
					reviewDecision: null,
					repository: { name: "hello-world", owner: { login: "octocat" } },
					author: { login: "hubot", avatarUrl: "https://avatars.githubusercontent.com/hubot" },
					comments: { totalCount: 0 },
					labels: { nodes: [] },
				},
			],
		},
	},
};

/** GitHub's REST answer to a posted comment. */
const COMMENT_ANSWER = {
	id: 6186769145,
	node_id: "IC_e2e",
	user: { login: "octocat", avatar_url: "https://avatars.githubusercontent.com/octocat" },
	body: "Looks good.",
	created_at: "2026-10-15T08:00:00Z",
	html_url: "https://github.com/octocat/hello-world/pull/7#issuecomment-1",
};

/** GitHub refusing an approval of the token owner's own pull request (REST 422). */
const OWN_APPROVAL_REFUSED = { message: "Unprocessable Entity", errors: ["Can not approve your own pull request"] };

/** A pull request whose repository the e2e token may read but not write. */
const READ_ONLY_COMMENTS_PATH = "/repos/octocat/read-only/issues/7/comments";

/** A key no earlier run has used (the ledger keeps keys for a day). */
function idempotencyKey(purpose: string): string {
	return `${purpose}-${randomUUID()}`;
}

/** How many comments the fake GitHub has been asked to post, and the merge writes it saw ("METHOD path"). */
const githubWrites: { comments: number; merges: string[] } = { comments: 0, merges: [] };

/** The head commit the fake pull request #7 is at. */
const MERGE_HEAD_SHA = "4f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39";

/** The repository's merge settings and pull request #7's merge state, as GraphQL answers them. */
const MERGE_STATE_ANSWER = {
	data: {
		repository: {
			mergeCommitAllowed: true,
			squashMergeAllowed: true,
			rebaseMergeAllowed: false,
			deleteBranchOnMerge: false,
			viewerDefaultMergeMethod: "SQUASH",
			pullRequest: { mergeable: "MERGEABLE", mergeStateStatus: "CLEAN", headRefOid: MERGE_HEAD_SHA, headRefName: "feature/e2e", isCrossRepository: false },
		},
	},
};

/** GitHub, as far as this suite needs it: who a token is, one search answer, and the two writes. */
const FAKE_GITHUB: GithubFetch = (url: string, init: RequestInit): Promise<Response> => {
	const authorization = new Headers(init.headers).get("authorization");
	if (authorization === `Bearer ${REFUSED_TOKEN}`) {
		return Promise.resolve(new Response("{}", { status: HTTP_UNAUTHORIZED }));
	}
	if (url.endsWith("/user")) {
		return Promise.resolve(Response.json(GITHUB_USER, { headers: { [GITHUB_TOKEN_EXPIRATION_HEADER]: "2026-12-31 00:00:00 UTC" } }));
	}
	if (url.endsWith(READ_ONLY_COMMENTS_PATH)) {
		return Promise.resolve(Response.json({ message: "Resource not accessible by personal access token" }, { status: HTTP_FORBIDDEN }));
	}
	if (url.endsWith("/issues/7/comments")) {
		githubWrites.comments += 1;
		return Promise.resolve(Response.json(COMMENT_ANSWER, { status: HTTP_CREATED }));
	}
	if (url.endsWith("/pulls/7/merge") || url.includes("/git/refs/heads/")) {
		githubWrites.merges.push(`${init.method ?? "GET"} ${new URL(url).pathname}`);
		return Promise.resolve(
			url.endsWith("/merge") ? Response.json({ sha: "a".repeat(40), merged: true, message: "Pull Request successfully merged" }) : new Response(null, { status: 204 }),
		);
	}
	if (url.endsWith("/graphql") && z.string().parse(init.body).includes("PullRequestMergeability")) {
		return Promise.resolve(Response.json(MERGE_STATE_ANSWER));
	}
	if (url.endsWith("/pulls/7/reviews")) {
		return Promise.resolve(Response.json(OWN_APPROVAL_REFUSED, { status: HTTP_UNPROCESSABLE }));
	}
	return Promise.resolve(Response.json(SEARCH_ANSWER));
};

const StoredLinkSchema = z.object({ tokenCiphertext: z.string(), isDeleted: z.boolean(), githubLogin: z.string() });
const AuditBodySchema = z.object({ requestBody: JsonValueSchema.nullable() });

describe("GitHub pull requests (e2e, real Postgres + RLS + audit trail)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let admin: LoginResult;
	let superAdmin: LoginResult;
	let manager: LoginResult;
	let adminId: string;
	let superAdminId: string;
	/** The two link rows exactly as they were before this suite ran (a developer's own link included), restored afterwards. */
	let linksBefore: readonly GithubAccountLinkSnapshot[] = [];

	async function userId(email: string): Promise<string> {
		const result = await pool.query<{ id: string }>("SELECT id FROM public.users WHERE email = $1", [email]);
		const id = result.rows.at(0)?.id;
		if (id === undefined) {
			throw new Error(`Seed user missing: ${email} — run pnpm db:seed`);
		}
		return id;
	}

	function headers(session: LoginResult): Record<string, string> {
		return { cookie: `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`, "x-forwarded-for": uniqueClientIp() };
	}

	async function storedLink(id: string): Promise<z.output<typeof StoredLinkSchema> | null> {
		const result = await pool.query(
			'SELECT token_ciphertext AS "tokenCiphertext", is_deleted AS "isDeleted", github_login AS "githubLogin" FROM public.github_account_links WHERE user_id = $1',
			[id],
		);
		return StoredLinkSchema.nullable().parse(result.rows.at(0) ?? null);
	}

	async function auditedRequestBody(response: InjectResponse): Promise<z.output<typeof AuditBodySchema>["requestBody"]> {
		const result = await pool.query('SELECT request_body AS "requestBody" FROM public.audit_logs WHERE correlation_id = $1', [response.headers["x-correlation-id"]]);
		return AuditBodySchema.parse(result.rows.at(0)).requestBody;
	}

	async function link(session: LoginResult, token: string): Promise<InjectResponse> {
		return app.inject({ method: "PUT", url: ACCOUNT_URL, headers: mutationHeaders(headers(session)), payload: { personalAccessToken: token } });
	}

	beforeAll(async () => {
		app = await createE2eApp((builder: TestingModuleBuilder): TestingModuleBuilder => builder.overrideProvider(GITHUB_FETCH).useValue(FAKE_GITHUB));
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		adminId = await userId(ADMIN_EMAIL);
		superAdminId = await userId(SUPER_ADMIN_EMAIL);
		linksBefore = await snapshotGithubAccountLinks(pool, [adminId, superAdminId]);
		// This suite's starting point, whatever links the database had: the seed's demo links (the SuperAdmin unlinked).
		await seedGithubAccountLinks({ adminId, superAdminId }, Date.now(), { replaceRealLinks: true });
		for (const email of [ADMIN_EMAIL, SUPER_ADMIN_EMAIL, MANAGER_EMAIL]) {
			await markSeedUserEmailVerified(pool, email);
		}
		admin = await login(app, ADMIN_EMAIL, "Admin@123");
		superAdmin = await login(app, SUPER_ADMIN_EMAIL, "SuperAdmin@123");
		manager = await login(app, MANAGER_EMAIL, "Manager@123");
	});

	afterAll(async () => {
		// Put back exactly what was there before, so running the suite never replaces a developer's own link.
		await restoreGithubAccountLinks(pool, linksBefore);
		await pool.end();
		await app.close();
	});

	it("refuses roles without GitHub pull requests (a Manager)", async () => {
		const response = await app.inject({ method: "GET", url: ACCOUNT_URL, headers: headers(manager) });

		expect(response.statusCode, response.body).toBe(HTTP_FORBIDDEN);
	});

	it("refuses a token GitHub does not accept, storing nothing new", async () => {
		const before = await storedLink(adminId);

		const response = await link(admin, REFUSED_TOKEN);

		expect(response.statusCode, response.body).toBe(HTTP_BAD_REQUEST);
		expect(response.json()).toMatchObject({ error: { code: "GITHUB_TOKEN_INVALID" } });
		expect(await storedLink(adminId)).toEqual(before);
	});

	it("links a token: answers the account, stores it encrypted, and never writes it to the audit trail", async () => {
		const response = await link(admin, TOKEN);

		expect(response.statusCode, response.body).toBe(HTTP_OK);
		expect(parseSuccessEnvelope(response, GithubAccountStatusSchema).data).toMatchObject({
			status: "linked",
			login: "octocat",
			health: "active",
			tokenExpiresAt: Date.parse("2026-12-31T00:00:00Z"),
		});
		expect(response.body).not.toContain(TOKEN);
		const stored = await storedLink(adminId);
		expect(stored).toMatchObject({ githubLogin: "octocat", isDeleted: false });
		expect(stored?.tokenCiphertext).not.toContain(TOKEN);
		expect(await auditedRequestBody(response)).toEqual({ personalAccessToken: "[REDACTED]" });
	});

	it("shows each admin only their own link", async () => {
		const response = await app.inject({ method: "GET", url: ACCOUNT_URL, headers: headers(superAdmin) });

		expect(parseSuccessEnvelope(response, GithubAccountStatusSchema).data).toEqual({ status: "unlinked" });
	});

	it("lists pull requests with the linked token", async () => {
		const response = await app.inject({ method: "GET", url: LIST_URL, query: { filter: "yours", state: "open" }, headers: headers(admin) });

		expect(response.statusCode, response.body).toBe(HTTP_OK);
		expect(parseSuccessEnvelope(response, GithubPullRequestPageSchema).data.items.map((item) => item.title)).toEqual(["Fix the thing"]);
	});

	it("asks an admin without a link to link one before listing", async () => {
		const response = await app.inject({ method: "GET", url: LIST_URL, headers: headers(superAdmin) });

		expect(response.statusCode, response.body).toBe(HTTP_CONFLICT);
		expect(response.json()).toMatchObject({ error: { code: "GITHUB_ACCOUNT_NOT_LINKED" } });
	});

	it("refuses a comment without an Idempotency-Key, before anything reaches GitHub", async () => {
		const before = githubWrites.comments;

		const response = await app.inject({ method: "POST", url: COMMENTS_URL, headers: mutationHeaders(headers(admin)), payload: { body: "Looks good." } });

		expect(response.statusCode, response.body).toBe(HTTP_BAD_REQUEST);
		expect(response.json()).toMatchObject({ error: { code: "IDEMPOTENCY_KEY_REQUIRED" } });
		expect(githubWrites.comments).toBe(before);
	});

	it("comments as the linked account once per key: a retry answers the first result without posting again", async () => {
		const before = githubWrites.comments;
		const key = idempotencyKey("e2e-comment");
		const send = (): Promise<InjectResponse> =>
			app.inject({
				method: "POST",
				url: COMMENTS_URL,
				headers: { ...mutationHeaders(headers(admin)), [IDEMPOTENCY_KEY_HEADER]: key },
				payload: { body: "Looks good." },
			});

		const first = await send();
		const retry = await send();

		expect(first.statusCode, first.body).toBe(HTTP_CREATED);
		expect(parseSuccessEnvelope(first, GithubCommentSchema).data).toMatchObject({ id: "IC_e2e", body: "Looks good." });
		expect(retry.statusCode, retry.body).toBe(HTTP_CREATED);
		expect(parseSuccessEnvelope(retry, GithubCommentSchema).data.id).toBe("IC_e2e");
		expect(githubWrites.comments).toBe(before + 1);
	});

	it("says which permission the token lacks when GitHub forbids it to write", async () => {
		const response = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/github/pull-requests/octocat/read-only/7/comments`,
			headers: { ...mutationHeaders(headers(admin)), [IDEMPOTENCY_KEY_HEADER]: idempotencyKey("e2e-comment-read-only") },
			payload: { body: "Hi" },
		});

		expect(response.statusCode, response.body).toBe(HTTP_CONFLICT);
		expect(response.json()).toMatchObject({
			error: {
				code: "GITHUB_WRITE_REJECTED",
				message: `Your GitHub token can't write to octocat/read-only. Give it "Pull requests: Read and write" access to that repository on GitHub, then try again.`,
			},
		});
	});

	it("refuses a blank comment with the shared schema", async () => {
		const response = await app.inject({
			method: "POST",
			url: COMMENTS_URL,
			headers: { ...mutationHeaders(headers(admin)), [IDEMPOTENCY_KEY_HEADER]: idempotencyKey("e2e-comment-blank") },
			payload: { body: "   " },
		});

		expect(response.statusCode, response.body).toBe(HTTP_BAD_REQUEST);
	});

	it("passes GitHub's reason on when it refuses a review", async () => {
		const response = await app.inject({
			method: "POST",
			url: REVIEWS_URL,
			headers: { ...mutationHeaders(headers(admin)), [IDEMPOTENCY_KEY_HEADER]: idempotencyKey("e2e-review-0001") },
			payload: { event: "approve" },
		});

		expect(response.statusCode, response.body).toBe(HTTP_CONFLICT);
		expect(response.json()).toMatchObject({ error: { code: "GITHUB_WRITE_REJECTED", message: "GitHub refused this: Can not approve your own pull request" } });
	});

	it("merges as the linked account once per key, pinned to the head commit, then deletes the branch", async () => {
		const key = idempotencyKey("e2e-merge");
		const send = (): Promise<InjectResponse> =>
			app.inject({
				method: "POST",
				url: `${API_VERSION_PREFIX}/github/pull-requests/octocat/hello-world/7/merge`,
				headers: { ...mutationHeaders(headers(admin)), [IDEMPOTENCY_KEY_HEADER]: key },
				payload: { method: "squash", expectedHeadSha: MERGE_HEAD_SHA, commitTitle: "Add the e2e (#7)", deleteBranch: true },
			});
		githubWrites.merges = [];

		const first = await send();
		const retry = await send();

		expect(first.statusCode, first.body).toBe(HTTP_CREATED);
		expect(parseSuccessEnvelope(first, GithubMergeResultSchema).data).toEqual({ sha: "a".repeat(40), branch: { outcome: "deleted" } });
		expect(retry.statusCode, retry.body).toBe(HTTP_CREATED);
		expect(githubWrites.merges).toEqual(["PUT /repos/octocat/hello-world/pulls/7/merge", "DELETE /repos/octocat/hello-world/git/refs/heads/feature/e2e"]);
	});

	it("refuses comments from roles without GitHub pull requests (a Manager)", async () => {
		const response = await app.inject({
			method: "POST",
			url: COMMENTS_URL,
			headers: { ...mutationHeaders(headers(manager)), [IDEMPOTENCY_KEY_HEADER]: idempotencyKey("e2e-comment-manager") },
			payload: { body: "Hi" },
		});

		expect(response.statusCode, response.body).toBe(HTTP_FORBIDDEN);
	});

	it("unlinks: the token is wiped from the row", async () => {
		const response = await app.inject({ method: "DELETE", url: ACCOUNT_URL, headers: mutationHeaders(headers(admin)) });

		expect(parseSuccessEnvelope(response, GithubAccountStatusSchema).data).toEqual({ status: "unlinked" });
		expect(await storedLink(adminId)).toMatchObject({ isDeleted: true, tokenCiphertext: "" });
	});
});
