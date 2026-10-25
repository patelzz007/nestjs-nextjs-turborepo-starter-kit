import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NETWORK_TEST_SAMPLES, type LatencyProbe } from "../network-quality";
import { NetworkQualityMonitor } from "../network-quality-monitor";

/** Requests per test: the warm-up and the timed samples. */
const REQUESTS_PER_TEST = NETWORK_TEST_SAMPLES + 1;
const INTERVAL_MS = 60_000;

/** A probe whose every request is answered at once; `calls` counts them. */
function instantProbe(): { readonly probe: LatencyProbe; readonly calls: () => number } {
	let calls = 0;
	return {
		probe: async (): Promise<void> => {
			calls += 1;
			await Promise.resolve();
		},
		calls: (): number => calls,
	};
}

function monitorWith(probe: LatencyProbe, online = true): NetworkQualityMonitor {
	return new NetworkQualityMonitor({ probe, now: (): number => Date.now(), clock: (): number => Date.now(), intervalMs: INTERVAL_MS, online });
}

/** Lets every pending promise and timer due now run. */
async function settle(): Promise<void> {
	await vi.advanceTimersByTimeAsync(0);
}

describe("NetworkQualityMonitor", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("measures nothing until started, then tests right away", async () => {
		const network = instantProbe();
		const monitor = monitorWith(network.probe);
		await settle();
		expect(network.calls()).toBe(0);
		expect(monitor.getSnapshot()).toEqual({ reading: { status: "measuring" }, testing: false });

		monitor.start();
		expect(monitor.getSnapshot().testing).toBe(true);
		await settle();
		expect(network.calls()).toBe(REQUESTS_PER_TEST);
		expect(monitor.getSnapshot()).toMatchObject({ reading: { status: "measured", quality: { strength: "strong", lossPercent: 0 } }, testing: false });
		monitor.stop();
	});

	it("tells subscribers about every change, and stops telling them once they unsubscribe", async () => {
		const monitor = monitorWith(instantProbe().probe);
		const listener = vi.fn();
		const unsubscribe = monitor.subscribe(listener);
		monitor.start();
		await settle();
		// The test started (testing), then finished (measured).
		expect(listener).toHaveBeenCalledTimes(2);
		unsubscribe();
		monitor.testNow();
		await settle();
		expect(listener).toHaveBeenCalledTimes(2);
		monitor.stop();
	});

	it("re-tests every interval while in view, never out of view, and at once when back in view with an old result", async () => {
		const network = instantProbe();
		const monitor = monitorWith(network.probe);
		monitor.start();
		await settle();
		await vi.advanceTimersByTimeAsync(INTERVAL_MS);
		expect(network.calls()).toBe(REQUESTS_PER_TEST * 2);

		monitor.setVisible(false);
		await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3);
		expect(network.calls()).toBe(REQUESTS_PER_TEST * 2);

		monitor.setVisible(true);
		await settle();
		expect(network.calls()).toBe(REQUESTS_PER_TEST * 3);
		monitor.stop();
	});

	it("does not re-test when it comes back into view with a fresh result", async () => {
		const network = instantProbe();
		const monitor = monitorWith(network.probe);
		monitor.start();
		await settle();
		monitor.setVisible(false);
		monitor.setVisible(true);
		await settle();
		expect(network.calls()).toBe(REQUESTS_PER_TEST);
		monitor.stop();
	});

	it("is offline while the device is, cancels the running test, and measures afresh once it is back", async () => {
		const signals: AbortSignal[] = [];
		const probe: LatencyProbe = (signal: AbortSignal): Promise<void> => {
			signals.push(signal);
			return new Promise<void>((resolve: () => void): void => {
				setTimeout(resolve, 10);
			});
		};
		const monitor = monitorWith(probe);
		monitor.start();
		monitor.setOnline(false);
		expect(signals.at(0)?.aborted).toBe(true);
		expect(monitor.getSnapshot()).toEqual({ reading: { status: "offline" }, testing: false });
		monitor.testNow();
		expect(monitor.getSnapshot().testing).toBe(false);

		await vi.advanceTimersByTimeAsync(100);
		monitor.setOnline(true);
		expect(monitor.getSnapshot()).toEqual({ reading: { status: "measuring" }, testing: true });
		await vi.advanceTimersByTimeAsync(100);
		expect(monitor.getSnapshot().reading.status).toBe("measured");
		monitor.stop();
	});

	it("does not test while created offline", async () => {
		const network = instantProbe();
		const monitor = monitorWith(network.probe, false);
		monitor.start();
		await settle();
		expect(network.calls()).toBe(0);
		expect(monitor.getSnapshot().reading).toEqual({ status: "offline" });
		monitor.stop();
	});

	it("starts no second test while one runs, and stopping cancels it", async () => {
		const signals: AbortSignal[] = [];
		const probe: LatencyProbe = (signal: AbortSignal): Promise<void> => {
			signals.push(signal);
			return new Promise<void>((): void => {
				// Never answered: the test stays running.
			});
		};
		const monitor = monitorWith(probe);
		monitor.start();
		monitor.testNow();
		await settle();
		expect(signals).toHaveLength(1);
		monitor.stop();
		expect(signals.at(0)?.aborted).toBe(true);
		expect(monitor.getSnapshot().testing).toBe(false);
		await vi.advanceTimersByTimeAsync(INTERVAL_MS * 2);
		expect(signals).toHaveLength(1);
	});

	it("is unreachable when no request is answered", async () => {
		const monitor = monitorWith((): Promise<void> => Promise.reject(new Error("503")));
		monitor.start();
		await settle();
		expect(monitor.getSnapshot().reading).toMatchObject({ status: "unreachable" });
		monitor.stop();
	});
});
