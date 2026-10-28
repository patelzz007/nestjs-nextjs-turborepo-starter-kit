// ============================================
// run-load-test.ts — one load test, start to finish
// ============================================
// Writes the run's script and plan, starts k6, and every second: reads k6's new measurements,
// reports the finished seconds (BullMQ job progress, which the API records) and checks the stop flag
// (an operator's abort, or the API's automatic one). Returns how the run ended.
// Single Responsibility + Dependency Inversion: k6, the file system, the clock and the stop flag are
// injected, so the loop is tested without any of them.

import type { LoadTestJob, LoadTestOutcome, LoadTestPoint, LoadTestProgress } from "@workspace/shared";

import { k6RunConfig } from "./k6-config";
import { k6Script } from "./k6-script";
import { K6ResultsAggregator } from "./results";

/** A running k6 process. */
export interface K6Process {
	/** Settles with k6's exit code. */
	readonly exited: Promise<number>;
	/** Asks k6 to stop (it finishes the requests in flight). */
	stop(): void;
}

export interface RunDeps {
	readonly targetOverride: string | undefined;
	/** Writes the script and the plan; returns their paths and where k6 writes its measurements. */
	prepare(script: string, config: string): Promise<{ readonly scriptPath: string; readonly configPath: string; readonly outputPath: string; cleanup(): Promise<void> }>;
	startK6(paths: { readonly scriptPath: string; readonly configPath: string; readonly outputPath: string }): K6Process;
	/** The measurements k6 wrote since the last read (complete lines only). */
	readNewLines(outputPath: string): Promise<readonly string[]>;
	isStopRequested(abortKey: string): Promise<boolean>;
	reportProgress(progress: LoadTestProgress): Promise<void>;
	now(): number;
	sleep(ms: number): Promise<void>;
}

const TICK_MS = 1_000;
const K6_OK = 0;

export async function runLoadTest(job: LoadTestJob, deps: RunDeps): Promise<LoadTestOutcome> {
	const files = await deps.prepare(k6Script(), JSON.stringify(k6RunConfig(job, deps.targetOverride)));
	const aggregator = new K6ResultsAggregator();
	const points: LoadTestPoint[] = [];
	let aborted = false;
	/** k6's exit code once it has exited (set by the process's own promise, read by the loop). */
	const exit: { code: number | null } = { code: null };
	const exitCode = (): number | null => exit.code;
	try {
		const k6 = deps.startK6(files);
		void k6.exited.then((code): void => {
			exit.code = code;
		});
		while (exitCode() === null) {
			await deps.sleep(TICK_MS);
			for (const line of await deps.readNewLines(files.outputPath)) {
				aggregator.addLine(line);
			}
			const finished: LoadTestPoint[] = aggregator.takeFinishedSeconds(deps.now(), false);
			points.push(...finished);
			if (finished.length > 0) {
				await deps.reportProgress({ points: finished, steps: aggregator.stepStats() });
			}
			if (!aborted && (await deps.isStopRequested(job.abortKey))) {
				aborted = true;
				k6.stop();
			}
		}
		for (const line of await deps.readNewLines(files.outputPath)) {
			aggregator.addLine(line);
		}
		points.push(...aggregator.takeFinishedSeconds(deps.now(), true));
		const peakRps: number | null = points.length === 0 ? null : Math.max(...points.map((point) => point.requests));
		const failed: boolean = !aborted && exitCode() !== K6_OK;
		return {
			status: aborted ? "ABORTED" : failed ? "ERROR" : "COMPLETED",
			abortReason: aborted ? "Stopped on request" : null,
			error: failed ? `k6 exited with code ${String(exitCode())}` : null,
			points,
			steps: aggregator.stepStats(),
			totals: aggregator.totals(peakRps),
		};
	} finally {
		await files.cleanup();
	}
}
