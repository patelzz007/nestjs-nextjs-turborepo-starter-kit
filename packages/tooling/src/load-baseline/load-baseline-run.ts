/**
 * Drives the nightly load test (enhancement 3.9) the way an operator would, through the API's own
 * Operations console endpoints (ADR 068): sign in as a Platform Developer on the admin client, check
 * load testing is on, start the baselines' run, wait for the load runner to finish it, and return the
 * run's detail (its steps' p95s are what the gate checks). The API provisions the Load Test tenant and
 * its users and queues the run; apps/load-runner takes it from the queue and drives it with k6. HTTP,
 * the clock and sleeping are injected, so the flow is tested against a fake API.
 */
import { setTimeout as delay } from "node:timers/promises";

import { z } from "zod";

import { API_PREFIX, signIn } from "../dev-timing/session.ts";
import { startLoadTestBody } from "./load-baselines.ts";

/** How often the run's status is read while it runs. */
export const POLL_INTERVAL_MS = 5_000;
/**
 * How long past its own duration a run may take before the job gives up: the queue wait, the runner's
 * start and k6's ramp-down.
 */
export const RUN_GRACE_MS = 5 * 60_000;
const MS_PER_SECOND = 1_000;
/** The run statuses after which nothing more happens to a run. */
const FINISHED_STATUSES = new Set(["PASSED", "FAILED", "ABORTED", "ERROR"]);
/** Characters of an unexpected answer quoted in an error. */
const QUOTED_BODY_CHARACTERS = 300;

/** Every API answer is `{ success, data }`. */
const EnvelopeSchema = z.object({ data: z.json() });
const OverviewSchema = z.object({ enabled: z.boolean(), disabledReason: z.string().nullable() });
const StartedRunSchema = z.object({ id: z.string().min(1) });
const RunStatusSchema = z.object({ run: z.object({ status: z.string() }) });

export type LoadBaselines = import("./load-baselines.ts").LoadBaselines;
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
export interface LoadRunTarget {
	apiUrl: string;
	adminOrigin: string;
	email: string;
	password: string;
}

/** The headers of an admin-panel request: the session, the admin client, and (for a write) the CSRF intent. */

export function adminHeaders(cookie: string, adminOrigin: string): Record<string, string> {
	return { cookie, origin: adminOrigin, "x-client-type": "admin", "x-mutation-intent": "same-origin", "content-type": "application/json" };
}

/** The `data` of an API answer, or an error naming the step and quoting the answer. */

async function dataOf(response: Response, step: string): Promise<z.output<typeof EnvelopeSchema>["data"]> {
	const text = await response.text();
	if (!response.ok) {
		throw new Error(`${step} answered HTTP ${String(response.status)}: ${text.slice(0, QUOTED_BODY_CHARACTERS)}`);
	}
	return EnvelopeSchema.parse(JSON.parse(text)).data;
}

/** Login verification is off in CI (`LOGIN_VERIFICATION_MODE=disabled`): a request for a code is a misconfiguration. */
const noLoginCode = (): Promise<string> => Promise.reject(new Error("the API asked for a login verification code; run the load test with LOGIN_VERIFICATION_MODE=disabled"));

/** Runs the baselines' load test to the end and returns its detail (the API's `LoadTestRunDetail`). */

export async function runLoadBaseline({
	target,
	baselines,
	fetchImpl = fetch,
	sleep = delay,
	now = Date.now,
	log = () => undefined,
}: {
	target: LoadRunTarget;
	baselines: LoadBaselines;
	fetchImpl?: FetchLike;
	sleep?: (ms: number) => Promise<void>;
	now?: () => number;
	log?: (line: string) => void;
}): Promise<z.output<typeof EnvelopeSchema>["data"]> {
	const cookie = await signIn({
		apiUrl: target.apiUrl,
		account: { email: target.email, password: target.password, clientType: "admin", origin: target.adminOrigin },
		readLoginCode: noLoginCode,
		readCurrentCode: () => Promise.resolve(undefined),
		fetchImpl,
		sleep,
	});
	const headers = adminHeaders(cookie, target.adminOrigin);
	const loadTests = `${target.apiUrl}${API_PREFIX}/admin/operations/load-tests`;

	const overview = OverviewSchema.parse(await dataOf(await fetchImpl(loadTests, { method: "GET", headers }), "reading the load tests"));
	if (!overview.enabled) {
		throw new Error(`load testing is off on this API: ${overview.disabledReason ?? "no reason given"}`);
	}

	const started = StartedRunSchema.parse(
		await dataOf(await fetchImpl(loadTests, { method: "POST", headers, body: JSON.stringify(startLoadTestBody(baselines)) }), "starting the load test"),
	);
	log(`Load test ${started.id} queued: ${String(baselines.run.requestsPerSecond)} requests/s for ${String(baselines.run.durationSeconds)} s`);

	const deadline = now() + baselines.run.durationSeconds * MS_PER_SECOND + RUN_GRACE_MS;
	for (;;) {
		const detail = await dataOf(await fetchImpl(`${loadTests}/${started.id}`, { method: "GET", headers }), "reading the load test");
		const { status } = RunStatusSchema.parse(detail).run;
		if (FINISHED_STATUSES.has(status)) {
			log(`Load test ${started.id} ended: ${status}`);
			return detail;
		}
		if (now() >= deadline) {
			// Stop it, so the API's one-at-a-time rule does not hold the next run back.
			await fetchImpl(`${loadTests}/${started.id}/abort`, { method: "POST", headers });
			throw new Error(`load test ${started.id} was still ${status} past its deadline (is the load runner running and reading the API's queue?)`);
		}
		await sleep(POLL_INTERVAL_MS);
	}
}
