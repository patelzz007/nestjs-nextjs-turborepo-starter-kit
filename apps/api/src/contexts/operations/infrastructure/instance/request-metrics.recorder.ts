// ============================================
// infrastructure/instance/request-metrics.recorder.ts — this instance's requests, minute by minute
// ============================================
// Fed by the Fastify `onResponse` hook (bootstrap/register-fastify-hooks.ts) with every answered
// request except the health probes. Memory is bounded under any load: durations are kept in
// reservoirs (a uniform sample), not in full.

import { latencyPercentiles, OPS_SLOWEST_ENDPOINT_COUNT, Reservoir, type OpsSlowEndpoint } from "@workspace/shared";

/** Durations kept per minute for the instance's percentiles. */
const MINUTE_SAMPLE_SIZE = 5_000;
/** Durations kept per endpoint per minute. */
const ENDPOINT_SAMPLE_SIZE = 200;
/** Distinct endpoints tracked per minute (a scan of random paths must not grow memory). */
const MAX_ENDPOINTS_PER_MINUTE = 500;
const SERVER_ERROR_STATUS = 500;
const CLIENT_ERROR_STATUS = 400;

/** One finished minute of requests. */
export interface MinuteRequestStats {
	readonly count: number;
	readonly serverErrors: number;
	readonly clientErrors: number;
	readonly p50Ms: number | null;
	readonly p95Ms: number | null;
	readonly p99Ms: number | null;
	readonly slowestEndpoints: readonly OpsSlowEndpoint[];
}

export const EMPTY_MINUTE: MinuteRequestStats = { count: 0, serverErrors: 0, clientErrors: 0, p50Ms: null, p95Ms: null, p99Ms: null, slowestEndpoints: [] };

export class RequestMetricsRecorder {
	private durations = new Reservoir(MINUTE_SAMPLE_SIZE);
	private endpoints = new Map<string, Reservoir>();
	private serverErrors = 0;
	private clientErrors = 0;

	/** One answered request. `endpoint` is the route template (`GET /api/v1/rewards/:id`), never the raw URL. */
	public record(endpoint: string, status: number, durationMs: number): void {
		this.durations.add(durationMs);
		if (status >= SERVER_ERROR_STATUS) {
			this.serverErrors += 1;
		} else if (status >= CLIENT_ERROR_STATUS) {
			this.clientErrors += 1;
		}
		const existing: Reservoir | undefined = this.endpoints.get(endpoint);
		if (existing !== undefined) {
			existing.add(durationMs);
		} else if (this.endpoints.size < MAX_ENDPOINTS_PER_MINUTE) {
			const reservoir = new Reservoir(ENDPOINT_SAMPLE_SIZE);
			reservoir.add(durationMs);
			this.endpoints.set(endpoint, reservoir);
		}
	}

	/** Closes the current minute: its statistics, and a fresh, empty minute starts. */
	public takeMinute(): MinuteRequestStats {
		const { p50, p95, p99 } = latencyPercentiles(this.durations.sample);
		const slowestEndpoints: OpsSlowEndpoint[] = [...this.endpoints]
			.flatMap(([endpoint, reservoir]): OpsSlowEndpoint[] => {
				const p95Ms: number | null = latencyPercentiles(reservoir.sample).p95;
				return p95Ms === null ? [] : [{ endpoint, p95Ms, count: reservoir.count }];
			})
			.sort((left, right) => right.p95Ms - left.p95Ms)
			.slice(0, OPS_SLOWEST_ENDPOINT_COUNT);
		const stats: MinuteRequestStats = {
			count: this.durations.count,
			serverErrors: this.serverErrors,
			clientErrors: this.clientErrors,
			p50Ms: p50,
			p95Ms: p95,
			p99Ms: p99,
			slowestEndpoints,
		};
		this.durations = new Reservoir(MINUTE_SAMPLE_SIZE);
		this.endpoints = new Map();
		this.serverErrors = 0;
		this.clientErrors = 0;
		return stats;
	}
}
