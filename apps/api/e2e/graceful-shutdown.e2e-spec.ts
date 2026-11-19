import { setTimeout as delay } from "node:timers/promises";

import { BullModule, getQueueToken, Processor, WorkerHost } from "@nestjs/bullmq";
import { Controller, Get, Inject, Module, Sse, type MessageEvent } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Job, Queue } from "bullmq";
import { interval, map, type Observable } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { LogService } from "../src/platform/infrastructure/logging/logs.service";
import { runGracefulShutdown, type GracefulShutdownDependencies } from "../src/platform/infrastructure/lifecycle/graceful-shutdown";
import { HealthService } from "../src/platform/presentation/http/health/health.service";
import { Public } from "../src/platform/presentation/http/security/decorators/public.decorator";
import { ZodResponse } from "../src/platform/presentation/http/validation/decorators/zod-response.decorators";
import { PrismaService } from "../src/prisma/prisma.service";
import { createE2eAppWith } from "./e2e-helpers";

/** The probe's own queue (under this run's BullMQ prefix, like every e2e queue). */
const PROBE_QUEUE = "e2e-shutdown-probe";
/** The probe's own unversioned route. */
const PROBE_ROUTE = "e2e-shutdown-probe";
/** How long the probe job, and the probe request, work after they started: long enough for the shutdown to begin mid-way. */
const PROBE_WORK_MS = 1_500;
/** The real default is generous; a test that hangs should fail long before vitest's own timeout. */
const SHUTDOWN_TIMEOUT_MS = 20_000;
const TEST_TIMEOUT_MS = 90_000;
const WAIT = { timeout: 20_000, interval: 50 };
const LOOPBACK = "127.0.0.1";
const OK = 200;
/** Fastify's default `keepAliveTimeout`: how long an idle keep-alive socket would hold a closing server open. */
const FASTIFY_KEEP_ALIVE_TIMEOUT_MS = 72_000;
/** The probe stream's keep-alive frame interval, like the API's own event streams: it never completes by itself. */
const PROBE_STREAM_PING_MS = 200;
const EVENT_STREAM = "text/event-stream";

const ProbeJobSchema = z.object({ label: z.string() });
const LabelRowsSchema = z.array(z.object({ label: z.string() }));
const ProbeResponseSchema = z.object({ label: z.string() });

/** What the probes saw, across every app instance in a test. */
interface ProbeLog {
	readonly started: string[];
	readonly finished: string[];
	readonly failed: string[];
}
const probe: ProbeLog = { started: [], finished: [], failed: [] };

/** Uses the database BEFORE and AFTER a pause, so a shutdown that closes the pool under it makes it fail. */
async function databaseWorkAcrossThePause(prisma: PrismaService, label: string): Promise<string> {
	await prisma.$queryRaw`SELECT 1`;
	probe.started.push(label);
	await delay(PROBE_WORK_MS);
	try {
		const [row] = LabelRowsSchema.parse(await prisma.$queryRaw`SELECT ${label}::text AS label`);
		probe.finished.push(row?.label ?? "");
		return label;
	} catch (error) {
		probe.failed.push(label);
		throw error;
	}
}

/**
 * A real BullMQ processor (test-only, on its own queue) whose job uses the database across a pause, exactly like a
 * production job would. (No `@Injectable()`: its one dependency is named with `@Inject`, which is all Nest needs.)
 */
@Processor(PROBE_QUEUE)
class ShutdownProbeProcessor extends WorkerHost {
	public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
		super();
	}

	public process(job: Pick<Job, "data">): Promise<string> {
		return databaseWorkAcrossThePause(this.prisma, ProbeJobSchema.parse(job.data).label);
	}
}

/**
 * A real HTTP route (test-only) whose request uses the database across a pause, and a never-ending event stream.
 * Decorators are applied programmatically, as the other HTTP specs do: the methods' first, then the class's.
 */
class ShutdownProbeController {
	public constructor(private readonly prisma: PrismaService) {}

	public async probe(): Promise<{ readonly label: string }> {
		return { label: await databaseWorkAcrossThePause(this.prisma, "request") };
	}

	/** Like every event stream of the API, it only ends when the client or the server ends it. */
	public events(): Observable<MessageEvent> {
		return interval(PROBE_STREAM_PING_MS).pipe(map((): MessageEvent => ({ type: "ping", data: "" })));
	}
}

function descriptorOf(prototype: object, name: string): PropertyDescriptor {
	const descriptor: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(prototype, name);
	if (descriptor === undefined) {
		throw new Error(`${name} is not a method`);
	}
	return descriptor;
}

const probePrototype: object = ShutdownProbeController.prototype;
Public()(probePrototype, "probe", descriptorOf(probePrototype, "probe"));
Get()(probePrototype, "probe", descriptorOf(probePrototype, "probe"));
ZodResponse(ProbeResponseSchema, { description: "The label the request read back after its pause" })(probePrototype, "probe", descriptorOf(probePrototype, "probe"));
Public()(probePrototype, "events", descriptorOf(probePrototype, "events"));
Sse("events")(probePrototype, "events", descriptorOf(probePrototype, "events"));
Inject(PrismaService)(ShutdownProbeController, undefined, 0);
Controller(PROBE_ROUTE)(ShutdownProbeController);

/** The probe's queue, processor and route, added beside the real application. */
@Module({ imports: [BullModule.registerQueue({ name: PROBE_QUEUE })], providers: [ShutdownProbeProcessor], controllers: [ShutdownProbeController] })
class ShutdownProbeModule {}

function bootInstance(): Promise<NestFastifyApplication> {
	return createE2eAppWith({ imports: [ShutdownProbeModule] });
}

function probeQueue(app: NestFastifyApplication): Queue {
	return app.get<Queue>(getQueueToken(PROBE_QUEUE));
}

/** The real shutdown sequence as SIGTERM runs it, with the process exit captured instead of taken. */
async function sigterm(app: NestFastifyApplication): Promise<readonly number[]> {
	const exits: number[] = [];
	const deps: GracefulShutdownDependencies = {
		app,
		readiness: app.get(HealthService),
		log: app.get(LogService),
		shutdownTimeoutMs: SHUTDOWN_TIMEOUT_MS,
		exit: (code: number): void => {
			exits.push(code);
		},
	};
	await runGracefulShutdown("SIGTERM", deps);
	return exits;
}

/**
 * ADR 095 (enhancement 4.3): `app.close()` finishes the work in progress — a running job, an in-flight request —
 * before it closes the connections that work uses. Real Redis, real BullMQ workers, a real listening HTTP server,
 * the real database pool.
 */
describe("Graceful shutdown with work in flight (e2e, real BullMQ, HTTP and Postgres)", () => {
	const open: NestFastifyApplication[] = [];

	async function boot(): Promise<NestFastifyApplication> {
		const app = await bootInstance();
		open.push(app);
		return app;
	}

	/** The test closes `app` itself, so cleanup must not close it again. */
	function release(app: NestFastifyApplication): NestFastifyApplication {
		open.splice(open.indexOf(app), 1);
		return app;
	}

	afterEach(async () => {
		for (const app of open.splice(0)) {
			await app.close();
		}
		probe.started.length = 0;
		probe.finished.length = 0;
		probe.failed.length = 0;
	});

	it(
		"on SIGTERM lets the running job finish (its database work after the signal included), exits 0, and leaves a job queued during shutdown to the next instance, which runs it once",
		async () => {
			const first = await boot();
			const running = await probeQueue(first).add("probe", { label: "in-flight" }, { attempts: 2, removeOnComplete: false, removeOnFail: false });
			await vi.waitFor(() => {
				expect(probe.started).toContain("in-flight");
			}, WAIT);

			const shutdown = sigterm(release(first));
			const queuedDuringShutdown = await probeQueue(first).add("probe", { label: "queued-during-shutdown" }, { attempts: 2, removeOnComplete: false, removeOnFail: false });
			await expect(shutdown).resolves.toStrictEqual([0]);

			expect(probe.finished).toStrictEqual(["in-flight"]);
			expect(probe.failed).toStrictEqual([]);
			expect(probe.started).not.toContain("queued-during-shutdown");

			const next = await boot();
			const queue = probeQueue(next);
			// The probe logs "finished" inside `process()`; BullMQ records the job completed only after it returns.
			await vi.waitFor(async () => {
				await expect(queue.getJobState(z.string().parse(queuedDuringShutdown.id))).resolves.toBe("completed");
			}, WAIT);
			await expect(queue.getJobState(z.string().parse(running.id))).resolves.toBe("completed");
			expect(probe.started.filter((label) => label === "queued-during-shutdown")).toHaveLength(1);
			expect(probe.finished).toStrictEqual(["in-flight", "queued-during-shutdown"]);
		},
		TEST_TIMEOUT_MS,
	);

	it(
		"app.close() alone (no signal handler, no separate drain) lets the running job finish on its first attempt",
		async () => {
			const first = await boot();
			const job = await probeQueue(first).add("probe", { label: "closed-under-it" }, { attempts: 2, removeOnComplete: false, removeOnFail: false });
			await vi.waitFor(() => {
				expect(probe.started).toContain("closed-under-it");
			}, WAIT);

			await release(first).close();
			expect(probe.finished).toStrictEqual(["closed-under-it"]);
			expect(probe.failed).toStrictEqual([]);

			const queue = probeQueue(await boot());
			await expect(queue.getJobState(z.string().parse(job.id))).resolves.toBe("completed");
			const finished = await queue.getJob(z.string().parse(job.id));
			expect(finished?.attemptsMade).toBe(1);
			expect(probe.started).toStrictEqual(["closed-under-it"]);
		},
		TEST_TIMEOUT_MS,
	);

	it(
		"app.close() lets an in-flight HTTP request finish its database work and answer, then ends its connection at once",
		async () => {
			const app = await boot();
			await app.listen(0, LOOPBACK);
			const answer = fetch(`${await app.getUrl()}/${PROBE_ROUTE}`);
			await vi.waitFor(() => {
				expect(probe.started).toContain("request");
			}, WAIT);

			const closeStartedAt = performance.now();
			await release(app).close();
			const closeTookMs = performance.now() - closeStartedAt;
			const response = await answer;

			expect(response.status).toBe(OK);
			expect(response.headers.get("connection")).toBe("close");
			expect(probe.finished).toStrictEqual(["request"]);
			expect(probe.failed).toStrictEqual([]);
			// The keep-alive socket did not hold the closing server open.
			expect(closeTookMs).toBeLessThan(FASTIFY_KEEP_ALIVE_TIMEOUT_MS);
		},
		TEST_TIMEOUT_MS,
	);

	it(
		"app.close() ends an open event stream, so a listening client never holds the server open",
		async () => {
			const app = await boot();
			await app.listen(0, LOOPBACK);
			const response = await fetch(`${await app.getUrl()}/${PROBE_ROUTE}/events`, { headers: { accept: EVENT_STREAM } });
			expect(response.status).toBe(OK);
			const reader = response.body?.getReader();
			if (reader === undefined) {
				throw new Error("the event stream has no body");
			}
			await reader.read();

			const closeStartedAt = performance.now();
			await release(app).close();
			const closeTookMs = performance.now() - closeStartedAt;

			let ended = false;
			while (!ended) {
				ended = (await reader.read()).done;
			}
			expect(ended).toBe(true);
			expect(closeTookMs).toBeLessThan(FASTIFY_KEEP_ALIVE_TIMEOUT_MS);
		},
		TEST_TIMEOUT_MS,
	);
});
