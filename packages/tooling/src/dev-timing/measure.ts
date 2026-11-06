/**
 * The measuring steps of `pnpm tools dev:timing` (plan §19.1), each turning probes
 * into `Measurement`s. Separated from the process handling in
 * `run-dev-timing.mjs` so they are unit-tested against fake servers on
 * ephemeral ports, without ever spawning the real stack.
 */
import { ALL_SERVERS_TARGET, PHASES, localUrl } from "./dev-timing-plan.ts";
import { HTTP_OK, answersOk, downloadBody, isMetroRunning, pollUntil, respondsToHttp } from "./probes.ts";
import { elapsedMs } from "./timing.ts";

export type Measurement = import("./timing.ts").Measurement;
export type DevServer = import("./dev-timing-plan.ts").DevServer;
export type ReadinessKind = import("./dev-timing-plan.ts").ReadinessKind;

const PROBES: Readonly<Record<ReadinessKind, (url: string) => Promise<boolean>>> = { ok: answersOk, responds: respondsToHttp, metro: isMetroRunning };

/**
 * Phase A: polls every server until it is ready and returns, per server, the
 * time from `spawnedAt`, plus the `all` target (the slowest server). Also
 * returns each server's ready clock reading, for the later phases.
 */

export async function measureReadiness({
	servers,
	spawnedAt,
	timeoutMs,
	pollIntervalMs,
	now,
	sleep,
	host = (server) => localUrl(server.port, server.path),
	signal,
}: {
	servers: readonly DevServer[];
	spawnedAt: number;
	timeoutMs: number;
	pollIntervalMs: number;
	now: () => number;
	sleep: (ms: number) => Promise<void>;
	host?: (server: DevServer) => string;
	signal?: AbortSignal;
}): Promise<{ measurements: Measurement[]; readyAt: Map<string, number> }> {
	const readings = await Promise.all(
		servers.map(async (server) => {
			const probe = PROBES[server.readiness];
			const url = host(server);
			const at = await pollUntil({ label: `${server.id} (${url})`, probe: () => probe(url), timeoutMs, pollIntervalMs, now, sleep, signal });
			return { id: server.id, at };
		}),
	);
	const readyAt = new Map(readings.map(({ id, at }) => [id, at]));
	const measurements = readings.map(({ id, at }) => ({ phase: PHASES.coldDev.id, target: id, ms: elapsedMs(spawnedAt, at) }));
	const slowest = Math.max(...readings.map(({ at }) => at));
	measurements.push({ phase: PHASES.coldDev.id, target: ALL_SERVERS_TARGET, ms: elapsedMs(spawnedAt, slowest) });
	return { measurements, readyAt };
}

/**
 * Times one `GET` read to its last byte and requires a 200 answer: a redirect
 * or an error page compiles something other than the route being measured.
 */

export async function measureDownload({
	phase,
	target,
	url,
	headers = {},
	now,
}: {
	phase: string;
	target: string;
	url: string;
	headers?: Readonly<Record<string, string>>;
	now: () => number;
}): Promise<Measurement> {
	const startedAt = now();
	const { status, bytes } = await downloadBody(url, headers);
	const finishedAt = now();
	if (status !== HTTP_OK) {
		throw new Error(`${target}: GET ${url} answered HTTP ${String(status)}, expected ${String(HTTP_OK)}`);
	}
	return { phase, target, ms: elapsedMs(startedAt, finishedAt), detail: `${String(bytes)} bytes` };
}

/**
 * Phase B: from the API's first rspack emit (RunScriptWebpackPlugin spawns
 * the process right after it) to its readiness answer.
 */

export function apiBootMeasurement({ compiledAt, readyAt }: { compiledAt: number | undefined; readyAt: number | undefined }): Measurement {
	if (compiledAt === undefined) {
		throw new Error("the API's rspack build never reported success in the dev output");
	}
	if (readyAt === undefined) {
		throw new Error("the API never answered /health/ready");
	}
	return { phase: PHASES.apiBoot.id, target: "api", ms: elapsedMs(compiledAt, readyAt) };
}
