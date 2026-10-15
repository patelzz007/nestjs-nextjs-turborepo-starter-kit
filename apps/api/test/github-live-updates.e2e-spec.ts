import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { TestingModuleBuilder } from "@nestjs/testing";
import { API_VERSION_PREFIX, GithubLiveUpdatesStatusSchema } from "@workspace/shared";
import { Pool } from "pg";
import { filter, firstValueFrom, timeout } from "rxjs";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getApiConfig } from "../src/config/api-config";
import { TypedConfigService } from "../src/config/typed-config.service";
import { GITHUB_FETCH, type GithubFetch } from "../src/modules/github/github-http.transport";
import { GithubPullRequestChangesHub, type GithubChangeSignal } from "../src/modules/github/live-updates/github-pull-request-changes.hub";
import { githubWebhookSignature } from "../src/modules/github/live-updates/github-webhook-signature";
import { GITHUB_TOKEN_EXPIRATION_HEADER } from "../src/modules/github/pull-requests/github-pull-request.client";
import { createE2eApp, login, markSeedUserEmailVerified, mutationHeaders, parseSuccessEnvelope, uniqueClientIp, type InjectResponse, type LoginResult } from "./e2e-helpers";
import { restoreGithubAccountLinks, snapshotGithubAccountLinks, type GithubAccountLinkSnapshot } from "./support/github-account-link-snapshots";

// Live pull-request updates (ADR 052) against the real AppModule, Postgres
// (RLS, LISTEN/NOTIFY) and the audit trail — GitHub faked at its one HTTP
// boundary. Turning a repository on registers a webhook with the admin's own
// token; a signed delivery is recorded once and announced to every API
// instance through pg_notify; turning it off deletes the webhook.

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const SECRET = "e2e-webhook-secret-0123456789abcdef0123";
const WEBHOOK_URL = "https://api.example.com/api/v1/github/webhook";
const TOKEN = "github_pat_11E2ETEST0000000000000_e2e_live_updates";
/** A repository no developer has: this suite's own rows are its own. */
const OWNER = "e2e-live-org";
const REPOSITORY = `repo-${randomUUID().slice(0, 8)}`;
const LIVE_UPDATES = `${API_VERSION_PREFIX}/github/live-updates/${OWNER}/${REPOSITORY}`;
const HOOK_ID = 4_242;
const NOTIFY_WAIT_MS = 5_000;

const github = { hooksCreated: 0, hooksDeleted: 0 };

const FAKE_GITHUB: GithubFetch = (url: string, init: RequestInit): Promise<Response> => {
	const { pathname } = new URL(url);
	const method = init.method ?? "GET";
	if (pathname === "/user") {
		return Promise.resolve(
			Response.json(
				{ id: 583231, login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/583231" },
				{ headers: { [GITHUB_TOKEN_EXPIRATION_HEADER]: "2026-12-31 00:00:00 UTC" } },
			),
		);
	}
	if (pathname.endsWith("/hooks") && method === "GET") {
		return Promise.resolve(Response.json([]));
	}
	if (pathname.endsWith("/hooks") && method === "POST") {
		github.hooksCreated += 1;
		return Promise.resolve(Response.json({ id: HOOK_ID, config: { url: WEBHOOK_URL } }, { status: 201 }));
	}
	if (pathname.endsWith(`/hooks/${String(HOOK_ID)}`) && method === "DELETE") {
		github.hooksDeleted += 1;
		return Promise.resolve(new Response(null, { status: 204 }));
	}
	return Promise.resolve(Response.json({ message: "Not Found" }, { status: 404 }));
};

const SubscriptionRowSchema = z.object({ githubHookId: z.string(), isDeleted: z.boolean() });

describe("GitHub live updates (e2e, real Postgres + LISTEN/NOTIFY)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let admin: LoginResult;
	let adminId: string;
	let linksBefore: readonly GithubAccountLinkSnapshot[] = [];
	const deliveryIds: string[] = [];

	function cookie(session: LoginResult): Record<string, string> {
		return { cookie: `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`, "x-forwarded-for": uniqueClientIp() };
	}

	function deliver(event: string, payload: object, options: { readonly secret?: string; readonly deliveryId?: string } = {}): Promise<InjectResponse> {
		const body = Buffer.from(JSON.stringify(payload));
		const deliveryId = options.deliveryId ?? randomUUID();
		deliveryIds.push(deliveryId);
		return app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/github/webhook`,
			headers: {
				"content-type": "application/json",
				"x-github-event": event,
				"x-github-delivery": deliveryId,
				"x-hub-signature-256": githubWebhookSignature(options.secret ?? SECRET, body),
				"x-forwarded-for": uniqueClientIp(),
			},
			payload: body,
		});
	}

	async function subscription(): Promise<z.output<typeof SubscriptionRowSchema> | null> {
		const result = await pool.query(
			'SELECT github_hook_id::text AS "githubHookId", is_deleted AS "isDeleted" FROM public.github_webhook_subscriptions WHERE owner = $1 AND repository = $2',
			[OWNER, REPOSITORY],
		);
		return SubscriptionRowSchema.nullable().parse(result.rows.at(0) ?? null);
	}

	beforeAll(async () => {
		const base = getApiConfig();
		const config = new TypedConfigService({ ...base, github: { ...base.github, webhook: { url: WEBHOOK_URL, secret: SECRET } } });
		app = await createE2eApp((builder: TestingModuleBuilder): TestingModuleBuilder =>
			builder.overrideProvider(GITHUB_FETCH).useValue(FAKE_GITHUB).overrideProvider(TypedConfigService).useValue(config),
		);
		pool = new Pool({ connectionString: DATABASE_URL });
		const result = await pool.query<{ id: string }>("SELECT id FROM public.users WHERE email = $1", ["admin@example.com"]);
		adminId = z.string().parse(result.rows.at(0)?.id);
		linksBefore = await snapshotGithubAccountLinks(pool, [adminId]);
		await markSeedUserEmailVerified(pool, "admin@example.com");
		admin = await login(app, "admin@example.com", "Admin@123");
		const linked = await app.inject({
			method: "PUT",
			url: `${API_VERSION_PREFIX}/github/account`,
			headers: mutationHeaders(cookie(admin)),
			payload: { personalAccessToken: TOKEN },
		});
		expect(linked.statusCode, linked.body).toBe(200);
	});

	afterAll(async () => {
		await restoreGithubAccountLinks(pool, linksBefore);
		await pool.query("DELETE FROM public.github_webhook_deliveries WHERE delivery_id = ANY($1::text[])", [deliveryIds]);
		await pool.end();
		await app.close();
	});

	it("turns a repository's live updates on with the admin's token, once", async () => {
		expect(parseSuccessEnvelope(await app.inject({ method: "GET", url: LIVE_UPDATES, headers: cookie(admin) }), GithubLiveUpdatesStatusSchema).data).toEqual({
			status: "disabled",
		});

		const first = await app.inject({ method: "PUT", url: LIVE_UPDATES, headers: mutationHeaders(cookie(admin)) });
		const again = await app.inject({ method: "PUT", url: LIVE_UPDATES, headers: mutationHeaders(cookie(admin)) });

		expect(parseSuccessEnvelope(first, GithubLiveUpdatesStatusSchema).data).toMatchObject({ status: "enabled" });
		expect(parseSuccessEnvelope(again, GithubLiveUpdatesStatusSchema).data).toMatchObject({ status: "enabled" });
		expect(github.hooksCreated).toBe(1);
		expect(await subscription()).toEqual({ githubHookId: String(HOOK_ID), isDeleted: false });
	});

	it("records a signed delivery once and announces it to every instance through Postgres", async () => {
		const hub = app.get(GithubPullRequestChangesHub);
		const announced = firstValueFrom(
			hub.observe().pipe(
				filter((signal: GithubChangeSignal): boolean => signal.kind === "change" && signal.change.repository === REPOSITORY),
				timeout(NOTIFY_WAIT_MS),
			),
		);
		const deliveryId = randomUUID();
		const payload = { action: "opened", repository: { name: REPOSITORY, owner: { login: OWNER } }, pull_request: { number: 7 } };

		const first = await deliver("pull_request", payload, { deliveryId });
		const redelivered = await deliver("pull_request", payload, { deliveryId });

		expect(first.statusCode, first.body).toBe(200);
		expect(JSON.parse(first.body)).toMatchObject({ data: { received: true, outcome: "recorded" } });
		expect(JSON.parse(redelivered.body)).toMatchObject({ data: { received: true, outcome: "duplicate" } });
		await expect(announced).resolves.toEqual({ kind: "change", change: { owner: OWNER, repository: REPOSITORY, number: 7 } });
	});

	it("refuses a delivery signed with another secret, recording nothing", async () => {
		const deliveryId = randomUUID();

		const forged = await deliver(
			"pull_request",
			{ repository: { name: REPOSITORY, owner: { login: OWNER } }, pull_request: { number: 1 } },
			{ secret: "not-the-secret-0123456789abcdef01234", deliveryId },
		);

		expect(forged.statusCode).toBe(403);
		const recorded = await pool.query("SELECT 1 FROM public.github_webhook_deliveries WHERE delivery_id = $1", [deliveryId]);
		expect(recorded.rowCount).toBe(0);
	});

	it("answers GitHub's ping", async () => {
		const ping = await deliver("ping", { zen: "Design for failure." });

		expect(JSON.parse(ping.body)).toMatchObject({ data: { received: true, outcome: "ping" } });
	});

	it("opens no stream for a repository the admin's token cannot see", async () => {
		const stream = await app.inject({ method: "GET", url: `${LIVE_UPDATES}/events`, headers: cookie(admin) });

		expect(stream.statusCode).toBe(404);
	});

	it("turns live updates off: the webhook is deleted on GitHub and the row soft-deleted", async () => {
		const off = await app.inject({ method: "DELETE", url: LIVE_UPDATES, headers: mutationHeaders(cookie(admin)) });

		expect(parseSuccessEnvelope(off, GithubLiveUpdatesStatusSchema).data).toEqual({ status: "disabled" });
		expect(github.hooksDeleted).toBe(1);
		expect(await subscription()).toEqual({ githubHookId: String(HOOK_ID), isDeleted: true });
	});
});
