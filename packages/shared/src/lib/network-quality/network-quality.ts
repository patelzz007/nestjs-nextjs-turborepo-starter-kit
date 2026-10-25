/**
 * How good the connection to the API is, measured the way speedtest.net
 * measures "ping": a short burst of tiny requests, timed one after another.
 *
 * - **Ping** is the median round trip of the burst, so one slow outlier does
 *   not decide the reading.
 * - **Jitter** is the mean change between consecutive round trips: how steady
 *   the connection is. A connection with a low ping and a high jitter still
 *   feels uneven.
 * - **Packet loss** is the share of requests that got no answer in time.
 *
 * The first request of a burst is a warm-up and is not counted: after a
 * minute idle the browser or the OS has usually closed the connection, so that
 * request also pays for DNS, TCP and TLS, which is not the latency the user
 * feels on the next click.
 *
 * Pure, with the probe and the clock passed in, so the web apps, the mobile
 * app and the tests share one implementation and one set of thresholds.
 */

/** The API route the probe calls (`GET /health/ping`, HealthController). Unversioned, like every health route. */
export const HEALTH_PING_ROUTE = "health/ping";

/** The probe's URL on an API origin: `https://api.example.com` → `https://api.example.com/health/ping`. */
export function healthPingUrl(apiBaseUrl: string): string {
	return new URL(`/${HEALTH_PING_ROUTE}`, apiBaseUrl).toString();
}

/** Green, yellow, red. */
export type NetworkStrength = "strong" | "moderate" | "weak";

/** One finished test with at least one answer. Every figure is rounded to a whole number. */
export interface MeasuredNetworkQuality {
	readonly kind: "measured";
	readonly pingMs: number;
	readonly jitterMs: number;
	/** 0–100. */
	readonly lossPercent: number;
	readonly strength: NetworkStrength;
}

/** The result of one test: measured, or no request was answered at all. */
export type NetworkQuality = MeasuredNetworkQuality | { readonly kind: "unreachable" };

/**
 * Where "strong" ends and "moderate" begins. A round trip under 100 ms is what
 * people perceive as instant (the classic response-time limit for a direct
 * reaction); jitter under 30 ms keeps that from wobbling. Packet loss of any
 * kind means retransmissions, so a lossy connection is never "strong".
 */
export const STRONG_MAX_PING_MS = 100;
export const STRONG_MAX_JITTER_MS = 30;

/**
 * Where "moderate" ends and "weak" begins. Past 300 ms a round trip is
 * noticeable on every click (ITU-T G.114 puts the one-way limit for
 * interactive use at 150 ms; 300 ms is that there and back). Losing half the
 * requests or more is weak whatever the timing.
 */
export const MODERATE_MAX_PING_MS = 300;
export const MODERATE_MAX_JITTER_MS = 100;
export const WEAK_MIN_LOSS_PERCENT = 50;

/** Requests per test after the warm-up: enough for a median and a jitter, few enough to cost nothing. */
export const NETWORK_TEST_SAMPLES = 4;

/** A request unanswered after this long counts as lost. */
export const NETWORK_SAMPLE_TIMEOUT_MS = 5_000;

/** How often an open, visible app re-tests. Each test is five tiny requests, so a minute keeps the cost negligible. */
export const NETWORK_TEST_INTERVAL_MS = 60_000;

const PERCENT = 100;
const HALF = 2;

/** One request of a test: its round trip, or `null` when it was lost. */
export type LatencySample = number | null;

/** The grade of a measured connection: the worst of what its ping, jitter and loss say. */
export function networkStrengthOf(pingMs: number, jitterMs: number, lossPercent: number): NetworkStrength {
	if (pingMs > MODERATE_MAX_PING_MS || jitterMs > MODERATE_MAX_JITTER_MS || lossPercent >= WEAK_MIN_LOSS_PERCENT) {
		return "weak";
	}
	if (pingMs > STRONG_MAX_PING_MS || jitterMs > STRONG_MAX_JITTER_MS || lossPercent > 0) {
		return "moderate";
	}
	return "strong";
}

function median(values: readonly number[]): number {
	const sorted = [...values].sort((a: number, b: number): number => a - b);
	const middle = Math.floor(sorted.length / HALF);
	const upper = sorted.at(middle) ?? 0;
	return sorted.length % HALF === 0 ? ((sorted.at(middle - 1) ?? upper) + upper) / HALF : upper;
}

/** The mean absolute change between consecutive round trips (0 for fewer than two). */
function meanSuccessiveDifference(values: readonly number[]): number {
	const changes = values.slice(1).map((value: number, index: number): number => Math.abs(value - (values.at(index) ?? value)));
	return changes.length === 0 ? 0 : changes.reduce((sum: number, change: number): number => sum + change, 0) / changes.length;
}

/** Ping, jitter, loss and strength of a test's samples (the warm-up already left out). */
export function summarizeLatency(samples: readonly LatencySample[]): NetworkQuality {
	const answered = samples.filter((sample: LatencySample): sample is number => sample !== null);
	if (answered.length === 0) {
		return { kind: "unreachable" };
	}
	const pingMs = Math.round(median(answered));
	const jitterMs = Math.round(meanSuccessiveDifference(answered));
	const lossPercent = Math.round(((samples.length - answered.length) / samples.length) * PERCENT);
	return { kind: "measured", pingMs, jitterMs, lossPercent, strength: networkStrengthOf(pingMs, jitterMs, lossPercent) };
}

/** Sends one request; resolves when the full answer arrived, rejects when it failed or `signal` aborted it. */
export type LatencyProbe = (signal: AbortSignal) => Promise<void>;

export interface MeasureNetworkQualityOptions {
	readonly probe: LatencyProbe;
	/** A monotonic clock in ms (`performance.now`). */
	readonly now: () => number;
	/** Cancels the test: the request in flight is aborted and no further request is sent. */
	readonly signal?: AbortSignal;
	readonly samples?: number;
	readonly timeoutMs?: number;
}

/** Times one request: its round trip, or `null` when it failed, timed out or the test was cancelled. */
async function timeSample({ probe, now, signal, timeoutMs = NETWORK_SAMPLE_TIMEOUT_MS }: MeasureNetworkQualityOptions): Promise<LatencySample> {
	const controller = new AbortController();
	const abort = (): void => {
		controller.abort();
	};
	const timer = setTimeout(abort, timeoutMs);
	signal?.addEventListener("abort", abort);
	const startedAt = now();
	try {
		await probe(controller.signal);
		return now() - startedAt;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
		signal?.removeEventListener("abort", abort);
	}
}

/** Runs one test: a warm-up request, then `samples` timed requests, one after another. */
export async function measureNetworkQuality(options: MeasureNetworkQualityOptions): Promise<NetworkQuality> {
	const { signal, samples = NETWORK_TEST_SAMPLES } = options;
	await timeSample(options);
	const results: LatencySample[] = [];
	while (results.length < samples && signal?.aborted !== true) {
		results.push(await timeSample(options));
	}
	return summarizeLatency(results);
}

/** A finished test and when it finished (epoch ms). */
export interface TimedNetworkQuality {
	readonly quality: NetworkQuality;
	readonly measuredAtMs: number;
}

/**
 * What a connection indicator shows. `offline` comes from the device itself
 * (the browser's `navigator.onLine`, the phone's network state) and wins over
 * any earlier test; `measuring` is the moment before the first test finishes.
 */
export type NetworkQualityReading =
	| { readonly status: "measuring" }
	| { readonly status: "offline" }
	| { readonly status: "unreachable"; readonly measuredAtMs: number }
	| { readonly status: "measured"; readonly quality: MeasuredNetworkQuality; readonly measuredAtMs: number };

export function networkQualityReadingOf(online: boolean, latest: TimedNetworkQuality | null): NetworkQualityReading {
	if (!online) {
		return { status: "offline" };
	}
	if (latest === null) {
		return { status: "measuring" };
	}
	const { quality, measuredAtMs } = latest;
	return quality.kind === "unreachable" ? { status: "unreachable", measuredAtMs } : { status: "measured", quality, measuredAtMs };
}
