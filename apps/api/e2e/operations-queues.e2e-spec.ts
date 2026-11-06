import { getQueueToken, WorkerHost } from "@nestjs/bullmq";
import { DiscoveryService } from "@nestjs/core";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { MONITORED_WORKER_OPTIONS } from "@workspace/messaging/nest";
import { API_VERSION_PREFIX, ApiErrorResponseSchema, OpsFailedJobListSchema, OpsQueueListSchema, QUEUE_NAMES, QueueNameSchema } from "@workspace/shared";
import type { Queue } from "bullmq";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createE2eApp, grantSeedUsersFullSession, login, mutationHeaders, uniqueClientIp, type InjectResponse, type LoginResult } from "./e2e-helpers";

const WAIT = { timeout: 20_000, interval: 100 };
const REASON = "Payload fixed upstream; run it again (e2e)";
/** A value inside the malformed job's data: it must never reach the screen. */
const PRIVATE_VALUE = "e2e-private-job-value";
const QUEUE = QUEUE_NAMES.rewardsAutoPublish;
const DataSchema = z.object({ data: z.looseObject({}) });
const WorkerHostSchema = z.instanceof(WorkerHost);
const AuditRowSchema = z.object({
	method: z.string(),
	endpoint: z.string(),
	responseStatus: z.number().nullable(),
	requestParams: z.looseObject({}).nullable(),
	requestBody: z.looseObject({}).nullable(),
});

/**
 * Enhancement 4.4: the operations console's Queues screen over real BullMQ queues and real processors. A
 * malformed job on `rewards.auto-publish` fails for real (its processor rejects the payload), then is listed,
 * retried and discarded through the API, each change audited with its reason.
 */
describe("Background job queues in the operations console (e2e, real BullMQ)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let superAdmin: LoginResult;
	let customer: LoginResult;

	function queue(): Queue {
		return app.get<Queue>(getQueueToken(QUEUE));
	}

	function call(method: "GET" | "POST", path: string, session: LoginResult, payload?: object): Promise<InjectResponse> {
		return app.inject({
			method,
			url: `${API_VERSION_PREFIX}${path}`,
			headers:
				method === "GET"
					? { authorization: `Bearer ${session.accessToken}`, "x-forwarded-for": uniqueClientIp() }
					: mutationHeaders({ authorization: `Bearer ${session.accessToken}`, "x-forwarded-for": uniqueClientIp() }),
			...(payload === undefined ? {} : { payload }),
		});
	}

	async function failedJob(): Promise<string> {
		const job = await queue().add("malformed", { bogus: PRIVATE_VALUE }, { attempts: 1, removeOnFail: false });
		const id = z.string().parse(job.id);
		await vi.waitFor(async () => {
			await expect(queue().getJobState(id)).resolves.toBe("failed");
		}, WAIT);
		return id;
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		await grantSeedUsersFullSession(pool, ["superadmin@example.com", "alice.johnson@example.com"]);
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123", "admin");
		customer = await login(app, "alice.johnson@example.com", "Alice@123");
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	it("runs every production worker with BullMQ's per-minute metrics on (what the failure rate reads)", () => {
		const hosts = app
			.get(DiscoveryService)
			.getProviders()
			.flatMap((wrapper): WorkerHost[] => {
				// Nest types a provider's instance loosely: keep only the BullMQ processors.
				const host = WorkerHostSchema.safeParse(wrapper.instance);
				return host.success ? [host.data] : [];
			});
		expect(hosts.length).toBeGreaterThan(0);
		for (const host of hosts) {
			expect({ queue: host.worker.name, metrics: host.worker.opts.metrics }).toStrictEqual({ queue: host.worker.name, metrics: MONITORED_WORKER_OPTIONS.metrics });
		}
	});

	it("lists every queue with its depth and the last hour's failures, and a queue's failed jobs without their data", async () => {
		const jobId = await failedJob();

		const list = await call("GET", "/admin/operations/queues", superAdmin);
		expect(list.statusCode).toBe(200);
		const queues = OpsQueueListSchema.parse(DataSchema.parse(list.json()).data);
		expect(queues.available).toBe(true);
		expect(queues.queues.map((entry) => entry.name).sort()).toStrictEqual([...QueueNameSchema.options].sort());
		const autoPublish = queues.queues.find((entry) => entry.name === QUEUE);
		expect(autoPublish?.failed).toBeGreaterThanOrEqual(1);
		expect(autoPublish?.failedLastHour).toBeGreaterThanOrEqual(1);
		expect(autoPublish?.failureRatePercent).not.toBeNull();

		const failed = await call("GET", `/admin/operations/queues/${QUEUE}/failed`, superAdmin);
		expect(failed.statusCode).toBe(200);
		const body = DataSchema.parse(failed.json()).data;
		const jobs = OpsFailedJobListSchema.parse(body);
		const listed = jobs.jobs.find((job) => job.id === jobId);
		expect(listed).toMatchObject({ name: "malformed", attemptsMade: 1, maxAttempts: 1 });
		expect(listed?.failedReason).toMatch(/.+/u);
		expect(JSON.stringify(body)).not.toContain(PRIVATE_VALUE);
	});

	it("retries a failed job with a reason (audited), and refuses one that isn't failed or a request without a reason", async () => {
		const jobId = await failedJob();
		const path = `/admin/operations/queues/${QUEUE}/jobs/${jobId}/retry`;

		expect((await call("POST", path, superAdmin, {})).statusCode).toBe(400);

		const retried = await call("POST", path, superAdmin, { reason: REASON });
		expect(retried.statusCode).toBe(201);
		// Run again for real: the payload is still malformed, so it fails again, with its attempts reset.
		await vi.waitFor(async () => {
			const job = await queue().getJob(jobId);
			expect({ state: await job?.getState(), attemptsMade: job?.attemptsMade, processed: (job?.processedOn ?? 0) > 0 }).toStrictEqual({
				state: "failed",
				attemptsMade: 1,
				processed: true,
			});
		}, WAIT);

		const correlationId = z.string().parse(retried.headers["x-correlation-id"]);
		await vi.waitFor(async () => {
			const rows = z
				.array(AuditRowSchema)
				.parse(
					(await pool.query(`SELECT method, endpoint, "responseStatus", "requestParams", "requestBody" FROM public."AuditLog" WHERE "correlationId" = $1`, [correlationId]))
						.rows,
				);
			// The route template, with the real queue and job in the request's parameters.
			expect(rows).toMatchObject([{ method: "POST", responseStatus: 201, requestParams: { params: { queueName: QUEUE, jobId } }, requestBody: { reason: REASON } }]);
			expect(rows.at(0)?.endpoint).toContain("/admin/operations/queues/:queueName/jobs/:jobId/retry");
		}, WAIT);

		const missing = await call("POST", `/admin/operations/queues/${QUEUE}/jobs/no-such-job/retry`, superAdmin, { reason: REASON });
		expect(missing.statusCode).toBe(404);
		expect(ApiErrorResponseSchema.parse(missing.json()).error.code).toBe("OPS_QUEUE_JOB_NOT_FOUND");
	});

	it("discards a failed job for good, and only staff with the permission reach any of it", async () => {
		const jobId = await failedJob();
		const path = `/admin/operations/queues/${QUEUE}/jobs/${jobId}/discard`;

		expect((await call("POST", path, customer, { reason: REASON })).statusCode).toBeGreaterThanOrEqual(401);
		expect((await call("GET", "/admin/operations/queues", customer)).statusCode).toBeGreaterThanOrEqual(401);
		await expect(queue().getJobState(jobId)).resolves.toBe("failed");

		expect((await call("POST", path, superAdmin, { reason: REASON })).statusCode).toBe(201);
		await expect(queue().getJob(jobId)).resolves.toBeUndefined();
		expect((await call("POST", path, superAdmin, { reason: REASON })).statusCode).toBe(404);
	});
});
