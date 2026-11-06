/**
 * Readiness probes and the polling loop behind `pnpm tools dev:timing` (plan §19.1).
 * Each probe answers one question about one server; `pollUntil` repeats a
 * probe until it says yes and returns the clock reading at that moment. The
 * clock and sleep are injected so the loop is unit-tested with fake time, and
 * the probes are unit-tested against fake servers on ephemeral ports.
 */
import { z } from "zod";

/** Per-request timeout, so a hung server cannot stall a poll past its deadline. */
export const PROBE_REQUEST_TIMEOUT_MS = 5_000;
/** The body Metro's `GET /status` returns once the packager is up. */
export const METRO_RUNNING_BODY = "packager-status:running";
/** The only status that counts as "ready" for the API readiness probe and a page fetch. */
export const HTTP_OK = 200;

export type Headers = Readonly<Record<string, string>>;

/**
 * The status of `GET url`, without following redirects (a redirect is an
 * answer, and following it would compile a different route).
 */

export async function fetchStatus(url: string, headers: Headers = {}): Promise<number> {
	const response = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(PROBE_REQUEST_TIMEOUT_MS) });
	await response.body?.cancel();
	return response.status;
}

/** Whether anything answers HTTP on `url` (any status counts: the port is up). */

export async function respondsToHttp(url: string): Promise<boolean> {
	try {
		await fetchStatus(url);
		return true;
	} catch {
		return false;
	}
}

/** Whether `GET url` answers exactly 200 (the API's `/health/ready`). */

export async function answersOk(url: string): Promise<boolean> {
	try {
		return (await fetchStatus(url)) === HTTP_OK;
	} catch {
		return false;
	}
}

/** Whether Metro's `GET /status` reports a running packager. */

export async function isMetroRunning(url: string): Promise<boolean> {
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(PROBE_REQUEST_TIMEOUT_MS) });
		return response.status === HTTP_OK && (await response.text()).trim() === METRO_RUNNING_BODY;
	} catch {
		return false;
	}
}

/**
 * `GET url` read to the last byte. The caller times it; nothing here
 * aborts it early, because a first bundle or page compile can legitimately
 * take longer than any probe timeout (the overall run has its own deadline).
 */

export async function downloadBody(url: string, headers: Headers = {}): Promise<{ status: number; bytes: number }> {
	const response = await fetch(url, { headers, redirect: "manual" });
	const body = await response.arrayBuffer();
	return { status: response.status, bytes: body.byteLength };
}

const ExpoManifestSchema = z.object({ launchAsset: z.object({ url: z.url() }) });

/** The bundle URL an Expo manifest tells the client to launch. */

export async function readLaunchAssetUrl(url: string, headers: Headers): Promise<string> {
	const response = await fetch(url, { headers, signal: AbortSignal.timeout(PROBE_REQUEST_TIMEOUT_MS) });
	const text = await response.text();
	if (response.status !== HTTP_OK) {
		throw new Error(`GET ${url} answered HTTP ${String(response.status)}`);
	}
	return ExpoManifestSchema.parse(JSON.parse(text)).launchAsset.url;
}

/**
 * Repeat `probe` until it resolves `true` and return the clock reading taken
 * right after that answer. Throws once `timeoutMs` passes without one, or
 * as soon as `signal` aborts (the process being probed has exited).
 */

export async function pollUntil({
	label,
	probe,
	timeoutMs,
	pollIntervalMs,
	now,
	sleep,
	signal,
}: {
	label: string;
	probe: () => Promise<boolean>;
	timeoutMs: number;
	pollIntervalMs: number;
	now: () => number;
	sleep: (ms: number) => Promise<void>;
	signal?: AbortSignal | undefined;
}): Promise<number> {
	const deadline = now() + timeoutMs;
	for (;;) {
		signal?.throwIfAborted();
		if (await probe()) {
			return now();
		}
		if (now() >= deadline) {
			throw new Error(`${label} not ready after ${String(timeoutMs)} ms`);
		}
		await sleep(pollIntervalMs);
	}
}
