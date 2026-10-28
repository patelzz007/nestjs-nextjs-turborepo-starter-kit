// ============================================
// application/services/load-test-recorder.ts — a run's progress and outcome, as the runner reports them
// ============================================
// Every API instance hears the load runner's BullMQ events; every write here is idempotent (seconds
// and steps are upserted, a run ends once), so recording on several instances changes nothing.
// While a run is in progress, the automatic abort (errors, or a saturated server) is checked here.

import { LOAD_TEST_ABORT_CPU_PERCENT, type EpochMs, type LoadTestOutcome, type LoadTestPoint, type LoadTestProgress } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { autoAbortReason, loadTestPassed } from "../../domain/policies/load-test.policy";
import { loadTestStopKey } from "../commands/load-tests/load-test.handlers";
import type { OperationsScope } from "../operations-scope";
import type { OpsLiveStore } from "../ports/ops-live-store.port";
import { LOAD_TEST_RECORD_OPERATION } from "../ports/operations.tokens";

/** The seconds kept in memory per run for the automatic abort's error window. */
const RECENT_SECONDS = 60;

interface RunWatch {
	recent: LoadTestPoint[];
	readonly cpuOverSince: Map<string, number>;
	aborting: boolean;
}

export class LoadTestRecorder {
	private readonly watches = new Map<string, RunWatch>();

	public constructor(
		private readonly uow: UnitOfWork<OperationsScope>,
		private readonly live: OpsLiveStore,
		private readonly clock: Clock,
		private readonly actor: ActorContext,
	) {}

	public async started(runId: string): Promise<void> {
		await this.uow.runSystemOperation(LOAD_TEST_RECORD_OPERATION, this.actor, (scope) => scope.loadTests.markRunning(runId, this.clock.now()));
	}

	/** Stores the new seconds and step totals, and stops the run when it must abort itself. */
	public async progress(runId: string, progress: LoadTestProgress): Promise<void> {
		const watch: RunWatch = this.watches.get(runId) ?? { recent: [], cpuOverSince: new Map(), aborting: false };
		this.watches.set(runId, watch);
		const servers = await this.uow.runSystemOperation(LOAD_TEST_RECORD_OPERATION, this.actor, async (scope) => {
			await scope.loadTests.recordProgress(runId, progress.points, progress.steps);
			return scope.servers.list();
		});
		watch.recent = [...watch.recent, ...progress.points].sort((left, right) => left.second - right.second).slice(-RECENT_SECONDS);
		const [latest] = watch.recent.slice(-1);
		if (latest === undefined || watch.aborting) {
			return;
		}
		const live = await this.live.serverLive(servers.map((server) => server.id));
		for (const server of servers) {
			const cpu: number | undefined = live.get(server.id)?.cpuPercent;
			if (cpu !== undefined && cpu > LOAD_TEST_ABORT_CPU_PERCENT) {
				if (!watch.cpuOverSince.has(server.name)) {
					watch.cpuOverSince.set(server.name, latest.second);
				}
			} else {
				watch.cpuOverSince.delete(server.name);
			}
		}
		const reason: string | null = autoAbortReason(watch.recent, watch.cpuOverSince, latest.second);
		if (reason !== null) {
			watch.aborting = true;
			await this.uow.runSystemOperation(LOAD_TEST_RECORD_OPERATION, this.actor, (scope) =>
				scope.loadTests.requestAbort(runId, `Stopped automatically: ${reason}`, this.clock.now()),
			);
			await this.live.requestStop(loadTestStopKey(runId));
		}
	}

	/** Records how the run ended, with its verdict against its thresholds. */
	public async finished(runId: string, outcome: LoadTestOutcome): Promise<void> {
		this.watches.delete(runId);
		const at: EpochMs = this.clock.now();
		await this.uow.runSystemOperation(LOAD_TEST_RECORD_OPERATION, this.actor, async (scope) => {
			await scope.loadTests.recordProgress(runId, outcome.points, outcome.steps);
			const run = await scope.loadTests.find(runId);
			if (run === null) {
				return;
			}
			const status =
				outcome.status === "ERROR"
					? "ERROR"
					: outcome.status === "ABORTED"
						? "ABORTED"
						: loadTestPassed(outcome.totals, { p95Ms: run.thresholdP95Ms, errorPercent: run.thresholdErrorPercent })
							? "PASSED"
							: "FAILED";
			await scope.loadTests.finish(runId, { status, at, abortReason: outcome.abortReason ?? run.abortReason, error: outcome.error, totals: outcome.totals });
		});
	}

	/** The runner failed outright (crashed, or the job errored): the run ends as ERROR. */
	public async failed(runId: string, reason: string): Promise<void> {
		this.watches.delete(runId);
		await this.uow.runSystemOperation(LOAD_TEST_RECORD_OPERATION, this.actor, (scope) =>
			scope.loadTests.finish(runId, {
				status: "ERROR",
				at: this.clock.now(),
				abortReason: null,
				error: reason,
				totals: { requests: 0, failures: 0, p50Ms: null, p95Ms: null, p99Ms: null, peakRps: null },
			}),
		);
	}
}
