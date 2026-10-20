import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAINTENANCE_SCHEDULER_RETRY_MS, MAINTENANCE_SCHEDULER_TIMEOUT_MS, MaintenanceSchedulerRegistry } from "../maintenance-scheduler.registry";
import { fakeMaintenanceQueue } from "./fake-maintenance-queue";

const EVERY_MS = 60_000;

function definition(schedulerId: string): { queueName: string; schedulerId: string; everyMs: number; jobName: string; data: object } {
	return { queueName: `queue-${schedulerId}`, schedulerId, everyMs: EVERY_MS, jobName: "tick", data: {} };
}

describe("MaintenanceSchedulerRegistry", () => {
	beforeEach(() => {
		vi.spyOn(Logger.prototype, "log").mockImplementation((): void => undefined);
		vi.spyOn(Logger.prototype, "warn").mockImplementation((): void => undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("is not ready before the first attempt, and registers every added scheduler together", async () => {
		const registry = new MaintenanceSchedulerRegistry();
		const first = fakeMaintenanceQueue();
		const second = fakeMaintenanceQueue();
		registry.add(first, definition("a"));
		registry.add(second, definition("b"));

		await expect(registry.isHealthy()).resolves.toBe(false);
		expect(first.upsertJobScheduler).not.toHaveBeenCalled();

		await registry.registerAll();

		expect(first.upsertJobScheduler).toHaveBeenCalledWith("a", { every: EVERY_MS }, expect.objectContaining({ name: "tick" }));
		expect(second.upsertJobScheduler).toHaveBeenCalledWith("b", { every: EVERY_MS }, expect.objectContaining({ name: "tick" }));
		expect(registry.currentState).toBe("registered");
		await expect(registry.isHealthy()).resolves.toBe(true);
		await expect(registry.getReport()).resolves.toEqual({ state: "registered", schedulers: 2, failed: "" });
	});

	it("reports a failed scheduler, stays ready, and retries until it registers", async () => {
		vi.useFakeTimers();
		const registry = new MaintenanceSchedulerRegistry();
		const healthy = fakeMaintenanceQueue();
		const flaky = fakeMaintenanceQueue();
		flaky.upsertJobScheduler.mockRejectedValueOnce(new Error("redis down"));
		registry.add(healthy, definition("healthy"));
		registry.add(flaky, definition("flaky"));

		await registry.registerAll();

		expect(registry.currentState).toBe("retrying");
		await expect(registry.isHealthy()).resolves.toBe(true);
		await expect(registry.getReport()).resolves.toMatchObject({ state: "retrying", failed: "flaky" });

		await vi.advanceTimersByTimeAsync(MAINTENANCE_SCHEDULER_RETRY_MS);

		expect(registry.currentState).toBe("registered");
		expect(flaky.upsertJobScheduler).toHaveBeenCalledTimes(2);
		registry.onApplicationShutdown();
	});

	it("stops waiting after the timeout and counts every scheduler as not yet registered", async () => {
		vi.useFakeTimers();
		const registry = new MaintenanceSchedulerRegistry();
		const hung = fakeMaintenanceQueue();
		hung.upsertJobScheduler.mockReturnValue(new Promise(() => undefined));
		registry.add(hung, definition("hung"));

		const attempt = registry.registerAll();
		await vi.advanceTimersByTimeAsync(MAINTENANCE_SCHEDULER_TIMEOUT_MS);
		await attempt;

		expect(registry.currentState).toBe("retrying");
		await expect(registry.getReport()).resolves.toMatchObject({ failed: "hung" });
		registry.onApplicationShutdown();
	});

	it("is ready at once when no module added a scheduler (BullMQ off)", async () => {
		const registry = new MaintenanceSchedulerRegistry();
		await registry.registerAll();
		expect(registry.currentState).toBe("registered");
	});
});
