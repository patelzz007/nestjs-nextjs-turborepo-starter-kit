import { HttpStatus } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { DependencyUnavailableError } from "../../common/errors/app-error";
import { PrismaService } from "../../prisma/prisma.service";
import { DeepHealthResponseSchema } from "@workspace/shared";

import { HEALTH_PROBE_TIMEOUT_MS, HealthService, toModuleHealthDetails, type ModuleHealthIndicator, type RegisteredModuleHealthIndicator } from "./health.service";
import { createTestTypedConfig } from "../../../test/support/test-api-env";

function indicator(healthy: boolean | "throws" | "hangs"): ModuleHealthIndicator {
	return {
		isHealthy: async (): Promise<boolean> => {
			if (healthy === "throws") throw new Error("broker down");
			if (healthy === "hangs") return new Promise<boolean>(() => undefined);
			return healthy;
		},
	};
}

/**
 * A `$queryRaw` result that never settles — models a database connection that
 * hangs. Carries Prisma's `PrismaPromise` brand so it is a genuine stand-in.
 */
class HungQueryRawResult extends Promise<Readonly<Record<string, number>>[]> {
	public override readonly [Symbol.toStringTag] = "PrismaPromise";
}

/** Run readiness and return the typed failure, or fail the test if it succeeded. */
async function readinessFailure(service: HealthService): Promise<DependencyUnavailableError> {
	try {
		await service.readiness();
	} catch (error) {
		if (error instanceof DependencyUnavailableError) {
			return error;
		}
		throw error;
	}
	throw new Error("readiness() unexpectedly succeeded");
}

describe("HealthService", () => {
	let prisma: PrismaService;
	let queryRaw: MockInstance<PrismaService["$queryRaw"]>;

	function createService(indicators: readonly RegisteredModuleHealthIndicator[] = []): HealthService {
		return new HealthService(prisma, indicators);
	}

	beforeEach(() => {
		prisma = new PrismaService(createTestTypedConfig());
		queryRaw = vi.spyOn(prisma, "$queryRaw").mockResolvedValue([{ "?column?": 1 }]);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe("liveness", () => {
		it("reports ok without touching the database, even before startup finished", () => {
			const service = createService();

			const result = service.liveness();

			expect(result.status).toBe("ok");
			expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
			expect(queryRaw).not.toHaveBeenCalled();
		});

		it("stays ok while the instance is draining", () => {
			const service = createService();
			service.markReady();
			service.markNotReady();

			expect(service.liveness().status).toBe("ok");
		});
	});

	describe("readiness", () => {
		it("is ready when started and the database answers", async () => {
			const service = createService();
			service.markReady();

			const result = await service.readiness();

			expect(result.status).toBe("ready");
			expect(result.checks).toEqual([
				{ name: "startup", status: "up", critical: true },
				{ name: "database", status: "up", critical: true },
			]);
		});

		it("is not ready (503) before markReady()", async () => {
			const failure = await readinessFailure(createService());

			expect(failure.httpStatus).toBe(HttpStatus.SERVICE_UNAVAILABLE);
			expect(failure.details?.checks).toContainEqual({ name: "startup", status: "down", critical: true });
		});

		it("is not ready after markNotReady() (graceful shutdown)", async () => {
			const service = createService();
			service.markReady();
			service.markNotReady();

			await expect(service.readiness()).rejects.toBeInstanceOf(DependencyUnavailableError);
		});

		it("is not ready when the database query fails", async () => {
			queryRaw.mockRejectedValue(new Error("ECONNREFUSED"));
			const service = createService();
			service.markReady();

			const failure = await readinessFailure(service);

			expect(failure.details?.checks).toContainEqual({ name: "database", status: "down", critical: true });
		});

		it("is not ready when the database hangs past the probe timeout", async () => {
			vi.useFakeTimers();
			queryRaw.mockReturnValue(new HungQueryRawResult(() => undefined));
			const service = createService();
			service.markReady();

			const pending = readinessFailure(service);
			await vi.advanceTimersByTimeAsync(HEALTH_PROBE_TIMEOUT_MS);
			const failure = await pending;

			expect(failure.details?.checks).toContainEqual({ name: "database", status: "down", critical: true });
		});

		it("fails on a critical module indicator", async () => {
			const service = createService([{ name: "payments", indicator: indicator(false), critical: true }]);
			service.markReady();

			const failure = await readinessFailure(service);

			expect(failure.details?.checks).toContainEqual({ name: "payments", status: "down", critical: true });
		});

		it("reports but ignores failing non-critical indicators (no shared-broker outage)", async () => {
			const service = createService([
				{ name: "kafka", indicator: indicator("throws"), critical: false },
				{ name: "queue", indicator: indicator(true), critical: false },
			]);
			service.markReady();

			const result = await service.readiness();

			expect(result.status).toBe("ready");
			expect(result.checks).toContainEqual({ name: "kafka", status: "down", critical: false });
			expect(result.checks).toContainEqual({ name: "queue", status: "up", critical: false });
		});

		it("carries a down indicator's report (Kafka state / lastFailure) on its readiness check", async () => {
			let connected = false;
			const kafka: ModuleHealthIndicator = {
				isHealthy: async (): Promise<boolean> => Promise.resolve(connected),
				getReport: async () =>
					Promise.resolve(connected ? { state: "connected" } : { state: "connecting", lastFailure: "producer connecting: Local: Broker transport failure" }),
			};
			const service = createService([{ name: "kafka", indicator: kafka, critical: false }]);
			service.markReady();

			expect((await service.readiness()).checks).toContainEqual({
				name: "kafka",
				status: "down",
				critical: false,
				details: { state: "connecting", lastFailure: "producer connecting: Local: Broker transport failure" },
			});

			connected = true;

			expect((await service.readiness()).checks).toContainEqual({ name: "kafka", status: "up", critical: false, details: { state: "connected" } });
		});

		it("times out a hanging indicator instead of hanging the probe", async () => {
			vi.useFakeTimers();
			const service = createService([{ name: "rabbitmq", indicator: indicator("hangs"), critical: true }]);
			service.markReady();

			const pending = readinessFailure(service);
			await vi.advanceTimersByTimeAsync(HEALTH_PROBE_TIMEOUT_MS);

			expect((await pending).details?.checks).toContainEqual({ name: "rabbitmq", status: "down", critical: true });
		});
	});

	describe("legacy /health", () => {
		it("throws 503 while starting up", async () => {
			await expect(createService().healthCheck()).rejects.toBeInstanceOf(DependencyUnavailableError);
		});

		it("reports the database status once ready", async () => {
			const service = createService();
			service.markReady();

			await expect(service.healthCheck()).resolves.toMatchObject({ status: "ok", db: "connected" });
			queryRaw.mockRejectedValue(new Error("down"));
			await expect(service.healthCheck()).resolves.toMatchObject({ status: "ok", db: "disconnected" });
		});
	});

	describe("deep health", () => {
		it("includes module reports", async () => {
			const service = createService([
				{
					name: "queue",
					indicator: { isHealthy: (): Promise<boolean> => Promise.resolve(true), getReport: (): Promise<{ waiting: number }> => Promise.resolve({ waiting: 0 }) },
					critical: false,
				},
				{ name: "kafka", indicator: indicator("throws"), critical: false },
			]);
			service.markReady();

			const result = await service.deepHealthCheck();

			expect(result.modules).toEqual([
				{ name: "queue", healthy: true, details: { waiting: 0 } },
				{ name: "kafka", healthy: false, details: { error: "Health check failed" } },
			]);
		});

		it("throws 503 while starting up", async () => {
			await expect(createService().deepHealthCheck()).rejects.toBeInstanceOf(DependencyUnavailableError);
		});
	});
});

describe("toModuleHealthDetails", () => {
	/** A Prisma epoch-ms `bigint` column, as a module report might carry it. */
	const LAST_EMAIL_AT_MS = 1_786_300_000_000;

	it("sends a bigint as a number and keeps every other scalar as-is", () => {
		expect(toModuleHealthDetails({ lastEmail: BigInt(LAST_EMAIL_AT_MS), backend: "bullmq", healthy: true, failed: 0, cursor: null })).toEqual({
			lastEmail: LAST_EMAIL_AT_MS,
			backend: "bullmq",
			healthy: true,
			failed: 0,
			cursor: null,
		});
	});

	it("produces details the deep-health response contract accepts", () => {
		const details = toModuleHealthDetails({ lastEmail: BigInt(LAST_EMAIL_AT_MS) });
		const parsed = DeepHealthResponseSchema.safeParse({
			status: "ok",
			db: "connected",
			timestamp: LAST_EMAIL_AT_MS,
			filesystem: "ok",
			checks: {},
			modules: [{ name: "notifications", healthy: true, details }],
		});
		expect(parsed.success).toBe(true);
	});
});
