import { createHmac, randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import {
	apiPath,
	DOCS_SYNC_REPORT_PATH,
	DocsSyncOverviewSchema,
	DocsSyncRunDetailSchema,
	DocsSyncRunSummarySchema,
	epochMs,
	NOTION_WEBHOOK_PATH,
	type DocsSyncRunReport,
} from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import {
	createE2eApp,
	grantSeedUsersFullSession,
	login,
	mutationHeaders,
	parsePaginatedEnvelope,
	parseSuccessEnvelope,
	uniqueClientIp,
	type InjectResponse,
	type LoginResult,
} from "./e2e-helpers";
import { TEST_API_SECRETS } from "./support/test-api-env";

/**
 * Docs publishing over real HTTP, real signature checks and real Postgres under RLS (ADR 084). The handshake before a
 * secret exists is covered by the handler's spec: this server has a secret.
 */

const WEBHOOK_URL = apiPath(NOTION_WEBHOOK_PATH);
const REPORT_URL = apiPath(DOCS_SYNC_REPORT_PATH);
const ADMIN_URL = apiPath("/admin/docs-publishing");
const NOTION_SECRET = z.string().parse(TEST_API_SECRETS.NOTION_WEBHOOK_SECRET);
const REPORT_TOKEN = z.string().parse(TEST_API_SECRETS.DOCS_SYNC_REPORT_TOKEN);
const NotionAnswerSchema = z.object({ data: z.object({ received: z.literal(true), outcome: z.string() }) });

function report(overrides: Partial<DocsSyncRunReport> = {}): DocsSyncRunReport {
	return {
		runId: randomUUID(),
		source: "NOTION",
		trigger: "SCHEDULE",
		status: "SUCCEEDED",
		converterVersion: 1,
		pagesProcessed: 1,
		pagesUnchanged: 2,
		pagesRemoved: 0,
		pagesHeldBack: 0,
		warnings: 0,
		heldBack: [],
		errorSummary: null,
		pullRequestUrl: null,
		commitSha: null,
		startedAt: epochMs(1_800_000_000_000),
		finishedAt: epochMs(1_800_000_042_000),
		...overrides,
	};
}

describe("Docs publishing (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let superAdmin: LoginResult;
	let customer: LoginResult;
	const runIds: string[] = [];

	function deliver(body: string, signature: string | null): Promise<InjectResponse> {
		const headers: Record<string, string> = {
			"content-type": "application/json",
			"x-forwarded-for": uniqueClientIp(),
			...(signature === null ? {} : { "x-notion-signature": signature }),
		};
		return app.inject({ method: "POST", url: WEBHOOK_URL, headers, payload: body });
	}

	function sign(body: string): string {
		return `sha256=${createHmac("sha256", NOTION_SECRET).update(body).digest("hex")}`;
	}

	function sendReport(payload: DocsSyncRunReport, token: string | null = REPORT_TOKEN): Promise<InjectResponse> {
		runIds.push(payload.runId);
		const headers: Record<string, string> = {
			"content-type": "application/json",
			"x-forwarded-for": uniqueClientIp(),
			...(token === null ? {} : { authorization: `Bearer ${token}` }),
		};
		return app.inject({ method: "POST", url: REPORT_URL, headers, payload: JSON.stringify(payload) });
	}

	function adminGet(path: string, session: LoginResult = superAdmin): Promise<InjectResponse> {
		return app.inject({ method: "GET", url: `${ADMIN_URL}${path}`, headers: { authorization: `Bearer ${session.accessToken}` } });
	}

	function adminWriteHeaders(): Record<string, string> {
		return mutationHeaders({ authorization: `Bearer ${superAdmin.accessToken}`, "content-type": "application/json" });
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		await grantSeedUsersFullSession(pool, ["superadmin@example.com", "alice.johnson@example.com"]);
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123", "admin");
		customer = await login(app, "alice.johnson@example.com", "Alice@123");
	});

	afterAll(async () => {
		await pool.query('DELETE FROM public."DocsSyncRun" WHERE "runId" = ANY($1::text[])', [runIds]);
		await pool.end();
		await app.close();
	});

	describe("the Notion webhook", () => {
		it("accepts a signed event, and logs it", async () => {
			const id = randomUUID();
			const body = JSON.stringify({ id, type: "comment.created" });

			const response = await deliver(body, sign(body));

			expect(response.statusCode).toBe(200);
			expect(NotionAnswerSchema.parse(response.json()).data.outcome).toBe("ignored");
			const logged = await pool.query<{ outcome: string }>('SELECT outcome FROM public."ReceivedWebhook" WHERE provider = \'NOTION\' AND "providerDeliveryId" = $1', [id]);
			expect(logged.rows).toEqual([{ outcome: "IGNORED" }]);
		});

		it("answers a retry of the same event as a duplicate", async () => {
			const body = JSON.stringify({ id: randomUUID(), type: "page.content_updated" });

			await deliver(body, sign(body));
			const retry = await deliver(body, sign(body));

			expect(NotionAnswerSchema.parse(retry.json()).data.outcome).toBe("duplicate");
		});

		it("refuses a request with no signature, and one with the wrong signature", async () => {
			const body = JSON.stringify({ id: randomUUID(), type: "page.created" });

			expect((await deliver(body, null)).statusCode).toBe(403);
			expect((await deliver(body, `sha256=${"0".repeat(64)}`)).statusCode).toBe(403);
		});

		it("refuses an unsigned handshake once a secret is set", async () => {
			expect((await deliver('{"verification_token":"secret_forged"}', null)).statusCode).toBe(403);
		});
	});

	describe("sync reports", () => {
		it("refuses a report with no token or the wrong one", async () => {
			expect((await sendReport(report(), null)).statusCode).toBe(401);
			expect((await sendReport(report(), "wrong")).statusCode).toBe(401);
		});

		it("refuses a report of the wrong shape", async () => {
			const response = await app.inject({
				method: "POST",
				url: REPORT_URL,
				headers: { "content-type": "application/json", authorization: `Bearer ${REPORT_TOKEN}`, "x-forwarded-for": uniqueClientIp() },
				payload: JSON.stringify({ runId: "x" }),
			});

			expect(response.statusCode).toBe(400);
		});

		it("records a run, and a repeat replaces it", async () => {
			const run = report({ status: "PARTIAL" });

			expect((await sendReport(run)).statusCode).toBe(200);
			expect((await sendReport({ ...run, pullRequestUrl: "https://github.com/acme/kit/pull/9" })).statusCode).toBe(200);

			const rows = await pool.query<{ pullRequestUrl: string }>('SELECT "pullRequestUrl" FROM public."DocsSyncRun" WHERE "runId" = $1', [run.runId]);
			expect(rows.rows).toEqual([{ pullRequestUrl: "https://github.com/acme/kit/pull/9" }]);
		});
	});

	describe("the console", () => {
		it("shows a report's run, with its held-back pages", async () => {
			const run = report({
				status: "PARTIAL",
				pagesHeldBack: 1,
				heldBack: [{ sourceId: "page-1", title: "Rewards", slug: "rewards", sourceUrl: null, issues: [{ blockId: "b1", blockType: "embed", reason: "Why.", fix: "How." }] }],
			});
			await sendReport(run);

			const list = parsePaginatedEnvelope(await adminGet("/runs?limit=100"), DocsSyncRunSummarySchema);
			const row = list.data.find((item) => item.runId === run.runId);
			if (row === undefined) {
				throw new Error("The run is not in the list");
			}
			const detail = parseSuccessEnvelope(await adminGet(`/runs/${row.id}`), DocsSyncRunDetailSchema);

			expect(detail.data.heldBack).toEqual(run.heldBack);
		});

		it("says what is set up", async () => {
			const overview = parseSuccessEnvelope(await adminGet("/overview"), DocsSyncOverviewSchema);

			expect(overview.data).toMatchObject({ webhookConfigured: true, reportingConfigured: true, dispatchConfigured: false });
		});

		it("answers 404 for a run that does not exist", async () => {
			expect((await adminGet(`/runs/${randomUUID()}`)).statusCode).toBe(404);
		});

		it("answers 503, naming what is missing, when this server cannot start a sync", async () => {
			const response = await app.inject({ method: "POST", url: `${ADMIN_URL}/sync`, headers: adminWriteHeaders(), payload: "{}" });

			expect(response.statusCode).toBe(503);
		});

		it("answers 404 when no token is waiting", async () => {
			const response = await app.inject({ method: "POST", url: `${ADMIN_URL}/webhook-handshake/reveal`, headers: adminWriteHeaders(), payload: "{}" });

			expect(response.statusCode).toBe(404);
		});

		it("refuses a customer", async () => {
			expect((await adminGet("/overview", customer)).statusCode).toBe(403);
		});

		it("refuses the signed-out", async () => {
			expect((await app.inject({ method: "GET", url: `${ADMIN_URL}/overview` })).statusCode).toBe(401);
		});
	});
});
