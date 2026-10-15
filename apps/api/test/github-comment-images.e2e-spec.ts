import { createHash, randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { TestingModuleBuilder } from "@nestjs/testing";
import {
	API_VERSION_PREFIX,
	CreateFileUploadUrlResponseSchema,
	FileDetailResponseSchema,
	GithubCommentPictureSchema,
	GithubCommentSchema,
	IDEMPOTENCY_KEY_HEADER,
	type FileRecord,
} from "@workspace/shared";
import { Pool } from "pg";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GITHUB_FETCH, type GithubFetch } from "../src/modules/github/github-http.transport";
import { GITHUB_TOKEN_EXPIRATION_HEADER } from "../src/modules/github/pull-requests/github-pull-request.client";
import { createE2eApp, login, markSeedUserEmailVerified, mutationHeaders, parseSuccessEnvelope, uniqueClientIp, type InjectResponse, type LoginResult } from "./e2e-helpers";
import { AVATAR_PNG_BYTES } from "./support/avatar-png-fixture";
import { restoreGithubAccountLinks, snapshotGithubAccountLinks, type GithubAccountLinkSnapshot } from "./support/github-account-link-snapshots";

// A picture attached to a GitHub comment from the app (ADR 052): uploaded through
// the file pipeline (private — a staging copy); attaching answers where it will
// be, and it is committed to the repository's comment-assets branch with the
// admin's own token only when a comment linking it is posted — the upload is
// then deleted. Pictures GitHub shows only to signed-in readers are served to
// the app at lasting addresses of the API, read with the caller's own token.
// GitHub itself is faked at its one HTTP boundary.

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const FILES = `${API_VERSION_PREFIX}/files`;
const PULL_REQUEST = `${API_VERSION_PREFIX}/github/pull-requests/octocat/hello-world/7`;
const PICTURES = `${PULL_REQUEST}/pictures`;
const TOKEN = "github_pat_11E2ETEST0000000000000_e2e_pictures_token";
const POLL_ATTEMPTS = 100;
const POLL_INTERVAL_MS = 100;
const PNG_BYTES: Buffer = AVATAR_PNG_BYTES;
const CHECKSUM: string = createHash("sha256").update(PNG_BYTES).digest("hex");
const TicketSchema = CreateFileUploadUrlResponseSchema.extend({ fields: z.object({ key: z.string(), token: z.string() }).strict() });
const GitBodySchema = z.object({ content: z.string().optional(), encoding: z.string().optional(), query: z.string().optional() }).loose();
/** An upload to a private repository shown in comment {@link UPLOAD_NODE}, and GitHub's signed link to it there. */
const UPLOAD_ID = "cb5fe4d3-85fb-4d1e-807a-1771925051be";
const UPLOAD_NODE = "IC_kwDOe2ePictures";
const SIGNED_UPLOAD = `https://private-user-images.githubusercontent.com/583231/1-${UPLOAD_ID}.png?jwt=e2e`;

/** What the fake GitHub was asked, oldest first: "METHOD path", for a blob its bytes, and whether a token came with it. */
const githubRequests: { readonly call: string; readonly blob: Buffer | null; readonly authorized: boolean }[] = [];
/** Files committed to the fake comment-assets branch. */
const committedPaths = new Set<string>();

/** The fake's answer to one GraphQL query, told apart by its operation name. */
function graphqlAnswer(query: string): Response {
	if (query.includes("query BranchHead")) {
		// The comment-assets branch does not exist until the first picture starts it.
		return Response.json({ data: { repository: { ref: committedPaths.size === 0 ? null : { target: { oid: "head" } } } } });
	}
	if (query.includes("query FileExists")) {
		return Response.json({ data: { repository: { object: committedPaths.size === 0 ? null : { __typename: "Blob" } } } });
	}
	if (query.includes("query NodeBodyHtml")) {
		return Response.json({ data: { node: { bodyHTML: `<p><img src="${SIGNED_UPLOAD}" alt="shot"></p>` } } });
	}
	return Response.json({ data: null, errors: [{ type: "NOT_FOUND", message: "unexpected query" }] });
}

const FAKE_GITHUB: GithubFetch = (url: string, init: RequestInit): Promise<Response> => {
	const { hostname, pathname } = new URL(url);
	const body = init.body === undefined || init.body === null ? null : GitBodySchema.parse(JSON.parse(z.string().parse(init.body)));
	githubRequests.push({
		call: `${init.method ?? "GET"} ${hostname === "api.github.com" ? "" : hostname}${pathname}`,
		blob: body?.encoding === "base64" && body.content !== undefined ? Buffer.from(body.content, "base64") : null,
		authorized: new Headers(init.headers).has("authorization"),
	});
	if (hostname === "private-user-images.githubusercontent.com") {
		return Promise.resolve(new Response(new Uint8Array(PNG_BYTES), { status: 200 }));
	}
	if (pathname === "/user") {
		return Promise.resolve(
			Response.json(
				{ id: 583231, login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/583231" },
				{ headers: { [GITHUB_TOKEN_EXPIRATION_HEADER]: "2026-12-31 00:00:00 UTC" } },
			),
		);
	}
	if (pathname === "/graphql") {
		return Promise.resolve(graphqlAnswer(body?.query ?? ""));
	}
	if (pathname.endsWith("/git/refs")) {
		committedPaths.add("first");
		return Promise.resolve(Response.json({ ref: "refs/heads/github-comment-assets" }, { status: 201 }));
	}
	if (pathname.includes("/git/")) {
		return Promise.resolve(Response.json({ sha: randomUUID().replaceAll("-", "") }, { status: 201 }));
	}
	if (pathname.includes("/contents/") && init.method === "PUT") {
		committedPaths.add(pathname);
		return Promise.resolve(Response.json({ content: { path: pathname } }, { status: 201 }));
	}
	if (pathname.includes("/contents/")) {
		return Promise.resolve(new Response(new Uint8Array(PNG_BYTES), { status: 200 }));
	}
	if (pathname.endsWith("/issues/7/comments")) {
		return Promise.resolve(
			Response.json(
				{
					id: 1,
					node_id: `IC_${randomUUID().slice(0, 8)}`,
					user: null,
					body: "posted",
					created_at: "2026-10-15T08:00:00Z",
					html_url: "https://github.com/octocat/hello-world/pull/7#issuecomment-1",
				},
				{ status: 201 },
			),
		);
	}
	return Promise.resolve(Response.json({ message: "Not Found" }, { status: 404 }));
};

describe("GitHub comment pictures kept in the repository (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let admin: LoginResult;
	let manager: LoginResult;
	let adminId: string;
	let managerId: string;
	let linksBefore: readonly GithubAccountLinkSnapshot[] = [];

	async function send(options: {
		method: "GET" | "POST" | "PUT";
		url: string;
		headers?: Record<string, string>;
		payload?: Buffer | Record<string, string | number>;
	}): Promise<InjectResponse> {
		return app.inject({ ...options, headers: { ...options.headers, "x-forwarded-for": uniqueClientIp() } });
	}

	function cookie(session: LoginResult): string {
		return `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`;
	}

	async function userIdOf(email: string): Promise<string> {
		const result = await pool.query<{ id: string }>("SELECT id FROM public.users WHERE email = $1", [email]);
		return z.string().parse(result.rows.at(0)?.id);
	}

	function requestTicket(session: LoginResult, userId: string): Promise<InjectResponse> {
		return send({
			method: "POST",
			url: `${FILES}/upload-url`,
			headers: mutationHeaders({ cookie: cookie(session) }),
			payload: { category: "GITHUB_COMMENT_IMAGE", userId, fileName: "screenshot.png", mimeType: "image/png", sizeBytes: PNG_BYTES.length, checksumSha256: CHECKSUM },
		});
	}

	/** Upload → complete → READY, as the app does it. */
	async function uploadPicture(session: LoginResult, userId: string): Promise<FileRecord> {
		const ticket = TicketSchema.parse(parseSuccessEnvelope(await requestTicket(session, userId), CreateFileUploadUrlResponseSchema).data);
		const boundary = `----comment-picture-${randomUUID()}`;
		const body = Buffer.concat([
			...Object.entries(ticket.fields).map(([name, value]) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)),
			Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="screenshot.png"\r\nContent-Type: image/png\r\n\r\n`),
			PNG_BYTES,
			Buffer.from(`\r\n--${boundary}--\r\n`),
		]);
		const upload = await send({
			method: "POST",
			url: new URL(ticket.uploadUrl).pathname,
			headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
			payload: body,
		});
		expect(upload.statusCode, upload.body).toBe(201);
		const completed = await send({
			method: "POST",
			url: `${FILES}/${ticket.fileId}/complete`,
			headers: mutationHeaders({ cookie: cookie(session) }),
			payload: { checksumSha256: CHECKSUM },
		});
		expect(completed.statusCode, completed.body).toBe(201);
		let file: FileRecord = parseSuccessEnvelope(completed, z.object({ file: FileDetailResponseSchema.shape.file })).data.file;
		for (let attempt = 0; attempt < POLL_ATTEMPTS && file.status !== "READY"; attempt += 1) {
			await new Promise<void>((resolve: () => void): void => {
				setTimeout(resolve, POLL_INTERVAL_MS);
			});
			file = parseSuccessEnvelope(await send({ method: "GET", url: `${FILES}/${ticket.fileId}`, headers: { cookie: cookie(session) } }), FileDetailResponseSchema).data.file;
		}
		return file;
	}

	function attach(session: LoginResult, fileId: string): Promise<InjectResponse> {
		return send({
			method: "POST",
			url: PICTURES,
			headers: { ...mutationHeaders({ cookie: cookie(session) }), [IDEMPOTENCY_KEY_HEADER]: `picture-${randomUUID()}` },
			payload: { fileId },
		});
	}

	function comment(session: LoginResult, body: string): Promise<InjectResponse> {
		return send({
			method: "POST",
			url: `${PULL_REQUEST}/comments`,
			headers: { ...mutationHeaders({ cookie: cookie(session) }), [IDEMPOTENCY_KEY_HEADER]: `comment-${randomUUID()}` },
			payload: { body },
		});
	}

	async function storedStatus(fileId: string): Promise<{ status: string; isDeleted: boolean } | undefined> {
		const stored = await pool.query<{ status: string; isDeleted: boolean }>('SELECT status, is_deleted AS "isDeleted" FROM public.stored_files WHERE id = $1', [fileId]);
		return stored.rows.at(0);
	}

	beforeAll(async () => {
		app = await createE2eApp((builder: TestingModuleBuilder): TestingModuleBuilder => builder.overrideProvider(GITHUB_FETCH).useValue(FAKE_GITHUB));
		pool = new Pool({ connectionString: DATABASE_URL });
		adminId = await userIdOf("admin@example.com");
		managerId = await userIdOf("manager@example.com");
		linksBefore = await snapshotGithubAccountLinks(pool, [adminId]);
		for (const email of ["admin@example.com", "manager@example.com"]) {
			await markSeedUserEmailVerified(pool, email);
		}
		admin = await login(app, "admin@example.com", "Admin@123");
		manager = await login(app, "manager@example.com", "Manager@123");
		const linked = await send({
			method: "PUT",
			url: `${API_VERSION_PREFIX}/github/account`,
			headers: mutationHeaders({ cookie: cookie(admin) }),
			payload: { personalAccessToken: TOKEN },
		});
		expect(linked.statusCode, linked.body).toBe(200);
	});

	afterAll(async () => {
		// Put back exactly what was there before, so running the suite never replaces a developer's own link.
		await restoreGithubAccountLinks(pool, linksBefore);
		await pool.end();
		await app.close();
	});

	it("keeps the upload private: it is only a staging copy", async () => {
		const file = await uploadPicture(admin, adminId);

		expect(file).toMatchObject({ status: "READY", category: "GITHUB_COMMENT_IMAGE", visibility: "PRIVATE", publicUrl: null });
	});

	it("answers where an attached picture will be, and commits nothing until a comment linking it is posted", async () => {
		const file = await uploadPicture(admin, adminId);
		githubRequests.length = 0;

		const response = await attach(admin, file.id);

		expect(response.statusCode, response.body).toBe(201);
		expect(parseSuccessEnvelope(response, GithubCommentPictureSchema).data).toEqual({
			url: `https://github.com/octocat/hello-world/raw/github-comment-assets/pull-requests/7/${file.id}.png`,
			path: `pull-requests/7/${file.id}.png`,
		});
		expect(githubRequests).toEqual([]);
		expect(await storedStatus(file.id)).toEqual({ status: "READY", isDeleted: false });
	});

	it("never commits a picture taken out of the draft: the comment posts, the upload is left for the sweep", async () => {
		const file = await uploadPicture(admin, adminId);
		expect((await attach(admin, file.id)).statusCode).toBe(201);
		githubRequests.length = 0;

		const posted = await comment(admin, "Changed my mind about the screenshot.");

		expect(posted.statusCode, posted.body).toBe(201);
		expect(githubRequests.map((request) => request.call)).toEqual(["POST /repos/octocat/hello-world/issues/7/comments"]);
		expect(await storedStatus(file.id)).toEqual({ status: "READY", isDeleted: false });
	});

	it("commits a linked picture when the comment is posted — before the comment — then deletes the upload; a second comment linking it commits nothing", async () => {
		const file = await uploadPicture(admin, adminId);
		const { url } = parseSuccessEnvelope(await attach(admin, file.id), GithubCommentPictureSchema).data;
		githubRequests.length = 0;
		committedPaths.clear();

		const first = await comment(admin, `Before and after:\n\n![screenshot](${url})`);

		expect(first.statusCode, first.body).toBe(201);
		expect(parseSuccessEnvelope(first, GithubCommentSchema).data.body).toBe("posted");
		expect(githubRequests.map((request) => request.call)).toEqual([
			"POST /graphql",
			"POST /repos/octocat/hello-world/git/blobs",
			"POST /repos/octocat/hello-world/git/trees",
			"POST /repos/octocat/hello-world/git/commits",
			"POST /repos/octocat/hello-world/git/refs",
			"POST /repos/octocat/hello-world/issues/7/comments",
		]);
		expect(githubRequests.at(1)?.blob?.equals(PNG_BYTES)).toBe(true);
		expect(await storedStatus(file.id)).toEqual({ status: "DELETED", isDeleted: true });

		githubRequests.length = 0;
		const second = await comment(admin, `Same picture again: ![screenshot](${url})`);

		expect(second.statusCode, second.body).toBe(201);
		expect(githubRequests.map((request) => request.call)).toEqual(["POST /graphql", "POST /repos/octocat/hello-world/issues/7/comments"]);
	});

	it("refuses a comment linking a picture that is gone and was never committed — nothing is posted", async () => {
		committedPaths.clear();
		githubRequests.length = 0;

		const refused = await comment(admin, `![gone](https://github.com/octocat/hello-world/raw/github-comment-assets/pull-requests/7/${randomUUID()}.png)`);

		expect(refused.statusCode, refused.body).toBe(409);
		expect(refused.json()).toMatchObject({ error: { code: "GITHUB_PICTURE_UNAVAILABLE" } });
		expect(githubRequests.map((request) => request.call)).toEqual(["POST /graphql"]);
	});

	it("serves a repository picture at its lasting address to a signed-in admin, read with their token — and to nobody signed out", async () => {
		const address = `${API_VERSION_PREFIX}/github/pictures/file?${new URLSearchParams({ owner: "octocat", repository: "hello-world", ref: "github-comment-assets", path: "pull-requests/7/a.png" }).toString()}`;

		const served = await send({ method: "GET", url: address, headers: { cookie: cookie(admin) } });
		const signedOut = await send({ method: "GET", url: address });

		expect(served.statusCode, served.body).toBe(200);
		expect(served.headers["content-type"]).toBe("image/png");
		expect(served.headers["x-content-type-options"]).toBe("nosniff");
		expect(served.headers["cache-control"]).toBe("private, max-age=3600");
		expect(served.rawPayload.equals(PNG_BYTES)).toBe(true);
		expect(signedOut.statusCode).toBe(401);
	});

	it("serves an upload to a private repository through GitHub's fresh signed link — never sending the token there", async () => {
		githubRequests.length = 0;

		const served = await send({ method: "GET", url: `${API_VERSION_PREFIX}/github/pictures/uploads/${UPLOAD_ID}?node=${UPLOAD_NODE}`, headers: { cookie: cookie(admin) } });

		expect(served.statusCode, served.body).toBe(200);
		expect(served.rawPayload.equals(PNG_BYTES)).toBe(true);
		expect(githubRequests.map(({ call, authorized }) => [call, authorized])).toEqual([
			["POST /graphql", true],
			[`GET private-user-images.githubusercontent.com/583231/1-${UPLOAD_ID}.png`, false],
		]);
	});

	it("serves no picture to someone who may not read pull requests", async () => {
		const served = await send({ method: "GET", url: `${API_VERSION_PREFIX}/github/pictures/uploads/${UPLOAD_ID}?node=${UPLOAD_NODE}`, headers: { cookie: cookie(manager) } });

		expect(served.statusCode).toBe(403);
	});

	it("refuses to attach a picture for someone who may not comment on pull requests", async () => {
		const file = await uploadPicture(admin, adminId);

		expect((await attach(manager, file.id)).statusCode).toBe(403);
	});

	it("refuses an upload for someone else, and someone who may not comment on pull requests", async () => {
		expect((await requestTicket(admin, managerId)).statusCode).toBe(403);
		expect((await requestTicket(manager, managerId)).statusCode).toBe(403);
	});
});
