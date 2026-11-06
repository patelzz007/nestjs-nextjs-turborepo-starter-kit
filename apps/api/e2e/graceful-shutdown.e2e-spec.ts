import { setTimeout as delay } from "node:timers/promises";

import { BullModule, getQueueToken, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Module } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { BullMqWorkerDrainService } from "@workspace/messaging/nest";
import type { Job, Queue } from "bullmq";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { LogService } from "../src/platform/infrastructure/logging/logs.service";
import { runGracefulShutdown, type GracefulShutdownDependencies } from "../src/platform/infrastructure/lifecycle/graceful-shutdown";
import { HealthService } from "../src/platform/presentation/http/health/health.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { createE2eAppWith } from "./e2e-helpers";

/** The probe's own queue (under this run's BullMQ prefix, like every e2e queue). */
const PROBE_QUEUE = "e2e-shutdown-probe";
/** How long the probe job works after it has started: long enough for the shutdown to begin mid-job. */
const PROBE_WORK_MS = 1_500;
/** The real default is generous; a test that hangs should fail long before vitest's own timeout. */
const SHUTDOWN_TIMEOUT_MS = 20_000;
const TEST_TIMEOUT_MS = 90_000;
const WAIT = { timeout: 20_000, interval: 50 };

const ProbeJobSchema = z.object({ label: z.string() });
const LabelRowsSchema = z.array(z.object({ label: z.string() }));

/** What the probe saw, across every app instance in a test. */
interface ProbeLog {
	readonly started: string[];
	readonly finished: string[];
	readonly failed: string[];
}
const probe: ProbeLog = { started: [], finished: [], failed: [] };

/**
 * A real BullMQ processor (test-only, on its own queue) whose job uses the database BEFORE and AFTER a pause,
 * so a shutdown that closes the pool under a running job makes it fail, exactly like a production job would.
 * (No `@Injectable()`: its one dependency is named with `@Inject`, which is all Nest needs to build it.)
 */
@Processor(PROBE_QUEUE)
class ShutdownProbeProcessor extends WorkerHost {
	public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
		super();
	}

	public async process(job: Pick<Job, "data">): Promise<string> {
		const { label } = ProbeJobSchema.parse(job.data);
		await this.prisma.$queryRaw`SELECT 1`;
		probe.started.push(label);
		await delay(PROBE_WORK_MS);
		try {
			const [row] = LabelRowsSchema.parse(await this.prisma.$queryRaw`SELECT ${label}::text AS label`);
			probe.finished.push(row?.label ?? "");
			return label;
		} catch (error) {
			probe.failed.push(label);
			throw error;
		}
	}
}

/** The probe's queue and processor, added beside the real application. */
@Module({ imports: [BullModule.registerQueue({ name: PROBE_QUEUE })], providers: [ShutdownProbeProcessor] })
class ShutdownProbeModule {}

function bootInstance(): Promise<NestFastifyApplication> {
	return createE2eAppWith({ imports: [ShutdownProbeModule] });
}

function probeQueue(app: NestFastifyApplication): Queue {
	return app.get<Queue>(getQueueToken(PROBE_QUEUE));
}

/** The real shutdown sequence as SIGTERM runs it, with the process exit captured instead of taken. */
async function sigterm(app: NestFastifyApplication, drain: Pick<BullMqWorkerDrainService, "drain">): Promise<readonly number[]> {
	const exits: number[] = [];
	const deps: GracefulShutdownDependencies = {
		app,
		readiness: app.get(HealthService),
		log: app.get(LogService),
		workerDrain: drain,
		shutdownTimeoutMs: SHUTDOWN_TIMEOUT_MS,
		exit: (code: number): void => {
			exits.push(code);
		},
	};
	await runGracefulShutdown("SIGTERM", deps);
	return exits;
}

/**
 * Enhancement 4.3: a deploy (SIGTERM) while a job is running. Real Redis, real BullMQ workers, real database
 * pool, the real shutdown sequence (`runGracefulShutdown`, the one `registerGracefulShutdown` wires to SIGTERM).
 */
describe("Graceful shutdown with a job in flight (e2e, real BullMQ and Postgres)", () => {
	const open: NestFastifyApplication[] = [];

	async function boot(): Promise<NestFastifyApplication> {
		const app = await bootInstance();
		open.push(app);
		return app;
	}

	/** SIGTERM `app`; the shutdown closes it, so cleanup must not close it again. */
	function stop(app: NestFastifyApplication, drain: Pick<BullMqWorkerDrainService, "drain">): Promise<readonly number[]> {
		open.splice(open.indexOf(app), 1);
		return sigterm(app, drain);
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
		"lets the running job finish (its database work after the signal included), exits 0, and leaves a job queued during the drain to the next instance, which runs it once",
		async () => {
			const first = await boot();
			const running = await probeQueue(first).add("probe", { label: "in-flight" }, { attempts: 2, removeOnComplete: false, removeOnFail: false });
			await vi.waitFor(() => {
				expect(probe.started).toContain("in-flight");
			}, WAIT);

			const shutdown = stop(first, first.get(BullMqWorkerDrainService));
			const queuedDuringDrain = await probeQueue(first).add("probe", { label: "queued-during-drain" }, { attempts: 2, removeOnComplete: false, removeOnFail: false });
			await expect(shutdown).resolves.toStrictEqual([0]);

			expect(probe.finished).toStrictEqual(["in-flight"]);
			expect(probe.failed).toStrictEqual([]);
			expect(probe.started).not.toContain("queued-during-drain");

			const next = await boot();
			await vi.waitFor(() => {
				expect(probe.finished).toContain("queued-during-drain");
			}, WAIT);
			const queue = probeQueue(next);
			await expect(queue.getJobState(z.string().parse(running.id))).resolves.toBe("completed");
			await expect(queue.getJobState(z.string().parse(queuedDuringDrain.id))).resolves.toBe("completed");
			expect(probe.started.filter((label) => label === "queued-during-drain")).toHaveLength(1);
			expect(probe.finished).toStrictEqual(["in-flight", "queued-during-drain"]);
		},
		TEST_TIMEOUT_MS,
	);

	it(
		"control: without the drain the same job fails as the pool closes under it, and the next instance retries it exactly once",
		async () => {
			const first = await boot();
			const job = await probeQueue(first).add("probe", { label: "undrained" }, { attempts: 2, removeOnComplete: false, removeOnFail: false });
			await vi.waitFor(() => {
				expect(probe.started).toContain("undrained");
			}, WAIT);

			await expect(stop(first, { drain: (): Promise<number> => Promise.resolve(0) })).resolves.toStrictEqual([0]);
			expect(probe.failed).toStrictEqual(["undrained"]);
			expect(probe.finished).toStrictEqual([]);

			const next = await boot();
			await vi.waitFor(() => {
				expect(probe.finished).toStrictEqual(["undrained"]);
			}, WAIT);
			const retried = await probeQueue(next).getJob(z.string().parse(job.id));
			expect(retried?.attemptsMade).toBe(2);
			await expect(probeQueue(next).getJobState(z.string().parse(job.id))).resolves.toBe("completed");
			expect(probe.started).toStrictEqual(["undrained", "undrained"]);
		},
		TEST_TIMEOUT_MS,
	);
});
