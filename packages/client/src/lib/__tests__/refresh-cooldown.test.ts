// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRefreshCooldown, type RefreshCall, type RefreshResult } from "../use-api";

const COOLDOWN_MS = 30_000;

function refreshMock(results: RefreshResult[]): ReturnType<typeof vi.fn<RefreshCall>> {
	const mock = vi.fn<RefreshCall>();
	for (const result of results) {
		mock.mockImplementationOnce(() => Promise.resolve(result));
	}
	return mock;
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("createRefreshCooldown", () => {
	it("returns true when the underlying refresh succeeds", async () => {
		const underlying = refreshMock(["ok"]);
		const onRefresh = createRefreshCooldown(underlying);

		await expect(onRefresh()).resolves.toBe(true);
		expect(underlying).toHaveBeenCalledTimes(1);
	});

	it("returns false on a transient failure and short-circuits follow-ups within the cooldown window", async () => {
		const underlying = refreshMock(["transient", "ok"]);
		const onRefresh = createRefreshCooldown(underlying);

		await expect(onRefresh()).resolves.toBe(false);
		await expect(onRefresh()).resolves.toBe(false);
		expect(underlying).toHaveBeenCalledTimes(1);
	});

	it("allows a fresh attempt after the cooldown window expires", async () => {
		const underlying = refreshMock(["transient", "ok"]);
		const onRefresh = createRefreshCooldown(underlying, COOLDOWN_MS);

		await expect(onRefresh()).resolves.toBe(false);
		expect(underlying).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(COOLDOWN_MS + 1);
		await expect(onRefresh()).resolves.toBe(true);
		expect(underlying).toHaveBeenCalledTimes(2);
	});

	it("does not throttle after an expired-session failure (session is dead, not unreachable)", async () => {
		const underlying = refreshMock(["expired", "ok"]);
		const onRefresh = createRefreshCooldown(underlying);

		await expect(onRefresh()).resolves.toBe(false);
		// No cooldown is armed for `expired` — the next 401 is a fresh attempt.
		await expect(onRefresh()).resolves.toBe(true);
		expect(underlying).toHaveBeenCalledTimes(2);
	});

	it("resets the failure timestamp after a success", async () => {
		const underlying = refreshMock(["transient", "ok", "transient"]);
		const onRefresh = createRefreshCooldown(underlying, COOLDOWN_MS);

		await expect(onRefresh()).resolves.toBe(false);
		await vi.advanceTimersByTimeAsync(COOLDOWN_MS + 1);
		await expect(onRefresh()).resolves.toBe(true);
		// Success resets the window: a new transient failure arms a fresh cooldown.
		await expect(onRefresh()).resolves.toBe(false);
		expect(underlying).toHaveBeenCalledTimes(3);
	});
});
