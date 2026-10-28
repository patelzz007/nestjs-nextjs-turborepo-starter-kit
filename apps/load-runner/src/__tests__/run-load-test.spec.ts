import type { LoadTestProgress } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { type K6Process, type RunDeps, runLoadTest } from "../run-load-test";
import { k6Line, loadTestJob } from "./fixtures";

const T0 = "2026-10-28T10:00:00.000Z";
const T0_MS = Date.parse(T0);

interface Harness {
	readonly deps: RunDeps;
	readonly progress: LoadTestProgress[];
	readonly state: { stopped: boolean; cleanedUp: boolean; config: string };
}

/**
 * A fake k6 that writes the given lines over `ticks` seconds, then exits with `exitCode` (or as soon
 * as it is stopped, when `stopAfter` ticks have passed and a stop was requested).
 */
function harness(options: { readonly lines: readonly string[]; readonly ticks: number; readonly exitCode: number; readonly stopAfter?: number }): Harness {
	const progress: LoadTestProgress[] = [];
	const state = { stopped: false, cleanedUp: false, config: "" };
	let tick = 0;
	let resolveExit: (code: number) => void = (): void => undefined;
	const pending: string[] = [...options.lines];
	const k6: K6Process = {
		exited: new Promise<number>((resolve) => {
			resolveExit = resolve;
		}),
		stop: (): void => {
			state.stopped = true;
			resolveExit(1);
		},
	};
	const deps: RunDeps = {
		targetOverride: undefined,
		prepare: (_script, config) => {
			state.config = config;
			return Promise.resolve({
				scriptPath: "s.js",
				configPath: "c.json",
				outputPath: "o.json",
				cleanup: (): Promise<void> => {
					state.cleanedUp = true;
					return Promise.resolve();
				},
			});
		},
		startK6: () => k6,
		readNewLines: () => Promise.resolve(pending.splice(0, pending.length)),
		isStopRequested: () => Promise.resolve(options.stopAfter !== undefined && tick >= options.stopAfter),
		reportProgress: (entry) => {
			progress.push(entry);
			return Promise.resolve();
		},
		now: () => T0_MS + tick * 1_000,
		sleep: () => {
			tick += 1;
			if (tick >= options.ticks && options.stopAfter === undefined) {
				resolveExit(options.exitCode);
			}
			return Promise.resolve();
		},
	};
	return { deps, progress, state };
}

describe("runLoadTest", () => {
	it("reports finished seconds as it goes and completes with totals", async () => {
		const { deps, progress, state } = harness({
			lines: [
				k6Line("http_req_duration", T0, 100),
				k6Line("http_req_duration", "2026-10-28T10:00:01.000Z", 200),
				k6Line("http_req_duration", "2026-10-28T10:00:01.000Z", 300),
			],
			ticks: 3,
			exitCode: 0,
		});

		const outcome = await runLoadTest(loadTestJob(), deps);

		expect(outcome.status).toBe("COMPLETED");
		expect(outcome.error).toBeNull();
		expect(outcome.totals).toMatchObject({ requests: 3, peakRps: 2 });
		// Second 2 passed with k6 still running and no requests: it is reported, as an empty second.
		expect(outcome.points.map((point) => point.second)).toEqual([0, 1, 2]);
		expect(progress.length).toBeGreaterThan(0);
		expect(JSON.parse(state.config)).toMatchObject({ baseUrl: "http://localhost:8080" });
		expect(state.cleanedUp).toBe(true);
	});

	it("stops k6 when a stop is requested and ends ABORTED", async () => {
		const { deps, state } = harness({ lines: [], ticks: 10, exitCode: 0, stopAfter: 1 });

		const outcome = await runLoadTest(loadTestJob(), deps);

		expect(state.stopped).toBe(true);
		expect(outcome).toMatchObject({ status: "ABORTED", abortReason: "Stopped on request", error: null });
	});

	it("ends in ERROR when k6 fails on its own", async () => {
		const { deps, state } = harness({ lines: [], ticks: 1, exitCode: 107 });

		const outcome = await runLoadTest(loadTestJob(), deps);

		expect(outcome).toMatchObject({ status: "ERROR", error: "k6 exited with code 107" });
		expect(outcome.totals.peakRps).toBeNull();
		expect(state.cleanedUp).toBe(true);
	});
});
