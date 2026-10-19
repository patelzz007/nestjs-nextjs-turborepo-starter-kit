import { Logger } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { epochMs } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { UserInvalidationTrigger } from "../../../../authorization/public-api";
import type { AuthorizationChange, AuthorizationChangeFeedPort } from "../../../application/ports/authorization-change-feed.port";
import { AuthorizationChangeSweep } from "../../../application/services/authorization-change-sweep";
import { AUTHORIZATION_CHANGE_SWEEP_SCHEDULER_ID, AuthorizationChangeSweepScheduler } from "../authorization-change-sweep.scheduler";

/** TEST-ONLY feed whose next read is controlled by the test: resolve, reject, or hold until released. */
class ControlledFeed implements AuthorizationChangeFeedPort {
	public reads = 0;
	public next: () => Promise<readonly AuthorizationChange[]> = (): Promise<readonly AuthorizationChange[]> => Promise.resolve([]);

	public changedWithin(): Promise<readonly AuthorizationChange[]> {
		this.reads += 1;
		return this.next();
	}
}

class NoopSessionCache {
	public invalidateUsers(): Promise<void> {
		return Promise.resolve();
	}
}

class NoopAuthorizationCache {
	public invalidateUsersOnThisInstance(_userIds: readonly string[], _trigger: UserInvalidationTrigger): void {
		// Dropping nothing: these tests observe the scheduler, not the caches.
	}
}

function setup(): { scheduler: AuthorizationChangeSweepScheduler; registry: SchedulerRegistry; feed: ControlledFeed } {
	const feed = new ControlledFeed();
	const registry = new SchedulerRegistry();
	const sweep = new AuthorizationChangeSweep(feed, new NoopSessionCache(), new NoopAuthorizationCache());
	return { scheduler: new AuthorizationChangeSweepScheduler(registry, sweep), registry, feed };
}

describe("AuthorizationChangeSweepScheduler", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("registers one in-process interval on every instance and removes it on shutdown", () => {
		const { scheduler, registry } = setup();

		scheduler.onModuleInit();
		expect(registry.doesExist("interval", AUTHORIZATION_CHANGE_SWEEP_SCHEDULER_ID)).toBe(true);

		scheduler.onApplicationShutdown();
		expect(registry.doesExist("interval", AUTHORIZATION_CHANGE_SWEEP_SCHEDULER_ID)).toBe(false);
	});

	it("runs one sweep and reports what it dropped", async () => {
		const { scheduler, feed } = setup();
		feed.next = (): Promise<readonly AuthorizationChange[]> => Promise.resolve([{ userId: "user-1", changedAt: epochMs(1_786_300_000_000) }]);

		await expect(scheduler.runOnce()).resolves.toEqual({ inWindow: 1, invalidated: 1 });
	});

	it("logs a failed sweep and resolves, so the next tick retries and the timer never dies", async () => {
		const errors = vi.spyOn(Logger.prototype, "error").mockImplementation((): void => undefined);
		const { scheduler, feed } = setup();
		feed.next = (): Promise<readonly AuthorizationChange[]> => Promise.reject(new Error("database unavailable"));

		await expect(scheduler.runOnce()).resolves.toBeNull();

		expect(errors).toHaveBeenCalledWith({ event: "identity.authorization_change_sweep_failed", error: "database unavailable" });
		feed.next = (): Promise<readonly AuthorizationChange[]> => Promise.resolve([]);
		await expect(scheduler.runOnce()).resolves.toEqual({ inWindow: 0, invalidated: 0 });
	});

	it("skips a tick while the previous sweep is still running instead of overlapping it", async () => {
		const { scheduler, feed } = setup();
		let release: (changes: readonly AuthorizationChange[]) => void = (): void => undefined;
		feed.next = (): Promise<readonly AuthorizationChange[]> =>
			new Promise<readonly AuthorizationChange[]>((resolve): void => {
				release = resolve;
			});

		const first: Promise<object | null> = scheduler.runOnce();
		await expect(scheduler.runOnce()).resolves.toBeNull();
		release([]);

		await expect(first).resolves.toEqual({ inWindow: 0, invalidated: 0 });
		expect(feed.reads).toBe(1);
	});
});
