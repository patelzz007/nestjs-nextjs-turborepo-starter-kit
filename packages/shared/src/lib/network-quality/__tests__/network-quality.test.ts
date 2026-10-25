import { afterEach, describe, expect, it, vi } from "vitest";

import {
	healthPingUrl,
	measureNetworkQuality,
	MODERATE_MAX_JITTER_MS,
	MODERATE_MAX_PING_MS,
	NETWORK_SAMPLE_TIMEOUT_MS,
	NETWORK_TEST_SAMPLES,
	networkQualityReadingOf,
	networkStrengthOf,
	STRONG_MAX_JITTER_MS,
	STRONG_MAX_PING_MS,
	summarizeLatency,
	WEAK_MIN_LOSS_PERCENT,
	type LatencyProbe,
	type LatencySample,
	type MeasuredNetworkQuality,
} from "../network-quality";

const MEASURED_AT_MS = 1_791_504_000_000;

/** A clock that only the probe moves: each request takes the next of `roundTrips` (ms), or fails where it is `null`. */
function scriptedNetwork(roundTrips: readonly LatencySample[]): { readonly probe: LatencyProbe; readonly now: () => number; readonly calls: () => number } {
	let time = 0;
	let calls = 0;
	const probe: LatencyProbe = async (): Promise<void> => {
		const roundTrip: LatencySample | undefined = roundTrips.at(calls);
		calls += 1;
		await Promise.resolve();
		if (roundTrip === null) {
			throw new Error("connection reset");
		}
		time += roundTrip ?? 0;
	};
	return { probe, now: (): number => time, calls: (): number => calls };
}

describe("healthPingUrl", () => {
	it("puts the unversioned ping route on the API origin", () => {
		expect(healthPingUrl("https://api.example.com")).toBe("https://api.example.com/health/ping");
		expect(healthPingUrl("http://10.0.0.9:8080/")).toBe("http://10.0.0.9:8080/health/ping");
	});
});

describe("networkStrengthOf", () => {
	it("is strong while ping and jitter stay inside the strong limits and nothing is lost", () => {
		expect(networkStrengthOf(STRONG_MAX_PING_MS, STRONG_MAX_JITTER_MS, 0)).toBe("strong");
	});

	it("is moderate just past a strong limit, or with any loss", () => {
		expect(networkStrengthOf(STRONG_MAX_PING_MS + 1, 0, 0)).toBe("moderate");
		expect(networkStrengthOf(0, STRONG_MAX_JITTER_MS + 1, 0)).toBe("moderate");
		expect(networkStrengthOf(0, 0, 1)).toBe("moderate");
		expect(networkStrengthOf(MODERATE_MAX_PING_MS, MODERATE_MAX_JITTER_MS, WEAK_MIN_LOSS_PERCENT - 1)).toBe("moderate");
	});

	it("is weak past a moderate limit, or when half the requests or more were lost", () => {
		expect(networkStrengthOf(MODERATE_MAX_PING_MS + 1, 0, 0)).toBe("weak");
		expect(networkStrengthOf(0, MODERATE_MAX_JITTER_MS + 1, 0)).toBe("weak");
		expect(networkStrengthOf(0, 0, WEAK_MIN_LOSS_PERCENT)).toBe("weak");
	});
});

describe("summarizeLatency", () => {
	it("reports the median ping and the mean change between consecutive round trips", () => {
		expect(summarizeLatency([40, 44, 38, 300])).toEqual({ kind: "measured", pingMs: 42, jitterMs: 91, lossPercent: 0, strength: "moderate" });
		expect(summarizeLatency([20, 22, 21])).toEqual({ kind: "measured", pingMs: 21, jitterMs: 2, lossPercent: 0, strength: "strong" });
	});

	it("leaves lost requests out of ping and jitter and counts them as loss", () => {
		const samples: LatencySample[] = [30, null, 32, 31];
		expect(summarizeLatency(samples)).toEqual({ kind: "measured", pingMs: 31, jitterMs: 2, lossPercent: 25, strength: "moderate" });
	});

	it("has no jitter with a single answer", () => {
		expect(summarizeLatency([55])).toMatchObject({ pingMs: 55, jitterMs: 0 });
	});

	it("is unreachable when nothing answered", () => {
		expect(summarizeLatency([null, null])).toEqual({ kind: "unreachable" });
		expect(summarizeLatency([])).toEqual({ kind: "unreachable" });
	});
});

describe("measureNetworkQuality", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("sends a warm-up request it does not count, then the timed samples one after another", async () => {
		// The warm-up pays for the handshake (900 ms); the four samples that follow do not.
		const network = scriptedNetwork([900, 40, 42, 44, 46]);
		const quality = await measureNetworkQuality(network);
		expect(network.calls()).toBe(NETWORK_TEST_SAMPLES + 1);
		expect(quality).toEqual({ kind: "measured", pingMs: 43, jitterMs: 2, lossPercent: 0, strength: "strong" });
	});

	it("counts a failed request as lost", async () => {
		const quality = await measureNetworkQuality(scriptedNetwork([10, 20, null, 20, 20]));
		expect(quality).toEqual({ kind: "measured", pingMs: 20, jitterMs: 0, lossPercent: 25, strength: "moderate" });
	});

	it("aborts a request that is not answered in time and counts it as lost", async () => {
		vi.useFakeTimers();
		const aborted: boolean[] = [];
		const probe: LatencyProbe = (signal: AbortSignal): Promise<void> =>
			new Promise<void>((_resolve: () => void, reject: (reason: Error) => void): void => {
				signal.addEventListener("abort", (): void => {
					aborted.push(true);
					reject(new Error("aborted"));
				});
			});
		const test = measureNetworkQuality({ probe, now: (): number => Date.now(), samples: 1 });
		await vi.advanceTimersByTimeAsync(NETWORK_SAMPLE_TIMEOUT_MS * 2);
		await expect(test).resolves.toEqual({ kind: "unreachable" });
		expect(aborted).toEqual([true, true]);
	});

	it("stops sending when the test is cancelled, and aborts the request in flight", async () => {
		const controller = new AbortController();
		const signals: AbortSignal[] = [];
		const probe: LatencyProbe = (signal: AbortSignal): Promise<void> => {
			signals.push(signal);
			if (signals.length === 2) {
				controller.abort();
			}
			return Promise.resolve();
		};
		await measureNetworkQuality({ probe, now: (): number => 0, signal: controller.signal });
		expect(signals).toHaveLength(2);
		expect(signals.at(1)?.aborted).toBe(true);
	});
});

describe("networkQualityReadingOf", () => {
	const measured: MeasuredNetworkQuality = { kind: "measured", pingMs: 40, jitterMs: 2, lossPercent: 0, strength: "strong" };

	it("is offline whenever the device says so, whatever the last test found", () => {
		expect(networkQualityReadingOf(false, { quality: measured, measuredAtMs: MEASURED_AT_MS })).toEqual({ status: "offline" });
	});

	it("is measuring until the first test finishes", () => {
		expect(networkQualityReadingOf(true, null)).toEqual({ status: "measuring" });
	});

	it("carries the last test's figures and when it ran", () => {
		expect(networkQualityReadingOf(true, { quality: measured, measuredAtMs: MEASURED_AT_MS })).toEqual({
			status: "measured",
			quality: measured,
			measuredAtMs: MEASURED_AT_MS,
		});
		expect(networkQualityReadingOf(true, { quality: { kind: "unreachable" }, measuredAtMs: MEASURED_AT_MS })).toEqual({ status: "unreachable", measuredAtMs: MEASURED_AT_MS });
	});
});
