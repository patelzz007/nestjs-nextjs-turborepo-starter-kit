// ============================================
// application/services/instance-reporter.ts — this process reporting itself as an instance
// ============================================
// Every 10 s: a heartbeat with its live numbers (to the live store). Once a minute: its finished
// minute to the history. On a clean shutdown it leaves the list, so only a crash shows Down.
// Single Responsibility: it only reports; the sampling and the recording are injected collaborators.

import { API_VERSION, epochMs, type EpochMs, type OpsInstanceLive, type OpsInstanceService, type OpsSlowEndpoint } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { bucketStartOf } from "../../domain/policies/history-window.policy";
import { rollUp } from "../../domain/policies/metric-rollup.policy";
import type { OperationsScope } from "../operations-scope";
import type { OpsLiveStore } from "../ports/ops-live-store.port";
import { OPS_INSTANCE_RECORD_OPERATION } from "../ports/operations.tokens";

/** One process sample (see `ProcessMetricsSampler`). */
export interface InstanceSample {
	readonly cpuPercent: number;
	readonly rssBytes: number;
	readonly heapUsedBytes: number;
	readonly heapTotalBytes: number;
	readonly eventLoopLagP99Ms: number;
	readonly gcPauseMs: number;
	readonly activeHandles: number;
}

/** One finished minute of requests (see `RequestMetricsRecorder`). */
export interface InstanceMinuteRequests {
	readonly count: number;
	readonly serverErrors: number;
	readonly clientErrors: number;
	readonly p50Ms: number | null;
	readonly p95Ms: number | null;
	readonly p99Ms: number | null;
	readonly slowestEndpoints: readonly OpsSlowEndpoint[];
}

export interface InstanceReporterDeps {
	readonly service: OpsInstanceService;
	readonly hostname: string;
	readonly pid: number;
	readonly clock: Clock;
	readonly live: OpsLiveStore;
	readonly uow: UnitOfWork<OperationsScope>;
	readonly actor: ActorContext;
	readonly sample: () => InstanceSample;
	readonly takeMinuteRequests: () => InstanceMinuteRequests;
	readonly dbPool: () => { readonly inUse: number; readonly waiting: number } | null;
}

export class InstanceReporter {
	public readonly instanceId: string;
	private readonly startedAt: EpochMs;
	private minuteSamples: InstanceSample[] = [];
	private lastMinute: InstanceMinuteRequests = { count: 0, serverErrors: 0, clientErrors: 0, p50Ms: null, p95Ms: null, p99Ms: null, slowestEndpoints: [] };
	private currentBucket: EpochMs;

	public constructor(private readonly deps: InstanceReporterDeps) {
		this.startedAt = deps.clock.now();
		this.instanceId = `${deps.hostname}:${String(deps.pid)}:${String(this.startedAt)}`;
		this.currentBucket = bucketStartOf(this.startedAt, "MINUTE");
	}

	/** One heartbeat; closes the minute first when the clock has moved into the next one. */
	public async tick(): Promise<void> {
		const now: EpochMs = this.deps.clock.now();
		const bucket: EpochMs = bucketStartOf(now, "MINUTE");
		if (bucket !== this.currentBucket) {
			await this.closeMinute(this.currentBucket);
			this.currentBucket = bucket;
		}
		const sample: InstanceSample = this.deps.sample();
		this.minuteSamples.push(sample);
		await this.deps.live.putInstance(this.liveOf(sample, now));
	}

	/** A clean shutdown: leave the instance list. */
	public async leave(): Promise<void> {
		await this.deps.live.removeInstance(this.instanceId);
	}

	private liveOf(sample: InstanceSample, now: EpochMs): OpsInstanceLive {
		const pool = this.deps.dbPool();
		return {
			instanceId: this.instanceId,
			service: this.deps.service,
			hostname: this.deps.hostname,
			pid: this.deps.pid,
			version: API_VERSION,
			startedAt: this.startedAt,
			sampledAt: now,
			cpuPercent: sample.cpuPercent,
			rssBytes: sample.rssBytes,
			heapUsedBytes: sample.heapUsedBytes,
			heapTotalBytes: sample.heapTotalBytes,
			eventLoopLagP99Ms: sample.eventLoopLagP99Ms,
			gcPauseMs: sample.gcPauseMs,
			activeHandles: sample.activeHandles,
			dbPoolInUse: pool?.inUse ?? null,
			dbPoolWaiting: pool?.waiting ?? null,
			requestsPerMinute: this.lastMinute.count,
			serverErrorsPerMinute: this.lastMinute.serverErrors,
			clientErrorsPerMinute: this.lastMinute.clientErrors,
			latencyP50Ms: this.lastMinute.p50Ms,
			latencyP95Ms: this.lastMinute.p95Ms,
			latencyP99Ms: this.lastMinute.p99Ms,
			slowestEndpoints: [...this.lastMinute.slowestEndpoints],
		};
	}

	/** Writes the finished minute: the samples' averages and peaks, and the minute's requests. */
	private async closeMinute(bucketStart: EpochMs): Promise<void> {
		const requests: InstanceMinuteRequests = this.deps.takeMinuteRequests();
		this.lastMinute = requests;
		const samples: InstanceSample[] = this.minuteSamples;
		this.minuteSamples = [];
		const point = rollUp(samples, (pick) => ({
			bucketStart: epochMs(bucketStart),
			cpuPercentAvg: pick.required("avg", (sample) => sample.cpuPercent),
			cpuPercentMax: pick.required("max", (sample) => sample.cpuPercent),
			rssBytes: Math.round(pick.required("max", (sample) => sample.rssBytes)),
			heapUsedBytes: Math.round(pick.required("max", (sample) => sample.heapUsedBytes)),
			eventLoopLagP99Ms: pick.required("max", (sample) => sample.eventLoopLagP99Ms),
			gcPauseMs: pick.required("sum", (sample) => sample.gcPauseMs),
			requestCount: requests.count,
			serverErrorCount: requests.serverErrors,
			clientErrorCount: requests.clientErrors,
			latencyP50Ms: requests.p50Ms,
			latencyP95Ms: requests.p95Ms,
			latencyP99Ms: requests.p99Ms,
		}));
		if (point === null) {
			return;
		}
		await this.deps.uow.runSystemOperation(OPS_INSTANCE_RECORD_OPERATION, this.deps.actor, (scope) =>
			scope.history.putInstancePoint({ instanceId: this.instanceId, service: this.deps.service, hostname: this.deps.hostname, version: API_VERSION }, "MINUTE", point),
		);
	}
}
