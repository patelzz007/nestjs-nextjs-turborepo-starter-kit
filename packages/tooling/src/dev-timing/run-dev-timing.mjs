/**
 * One `pnpm dev:timing` run (plan §19.1): optionally reset to cold, spawn
 * `pnpm dev`, measure phases A–D, then stop the whole process group and wait
 * until every port is free again. The measuring itself lives in
 * `measure.mjs`; this file only owns processes and the file system, which is
 * why it is the one part exercised by running the tool, not by unit tests
 * (no test spawns the real stack).
 */
import { exec, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

import { findOccupiedPorts } from "../../scripts/lib/port-preflight.mjs";
import { ApiBootRecorder } from "./dev-output.mjs";
import {
	API_ENV_FILE,
	API_PORT,
	COLD_RESET_PATHS,
	DEV_SERVERS,
	EMAIL_REDIRECT_KEY,
	METRO_CACHE_DIRECTORY,
	METRO_FILE_MAP_PREFIX,
	METRO_MANIFEST_HEADERS,
	METRO_MANIFEST_PATH,
	METRO_PORT,
	PAGE_TARGETS,
	PHASES,
	localUrl,
	metroCacheRoots,
} from "./dev-timing-plan.mjs";
import { readEnvValue } from "./env-file.mjs";
import { apiBootMeasurement, measureDownload, measureReadiness } from "./measure.mjs";
import { readLaunchAssetUrl } from "./probes.mjs";
import { signIn } from "./session.mjs";

const execAsync = promisify(exec);

/**
 * `pnpm` is started through the shell: depending on how it was installed the
 * `pnpm` on PATH is a shell shim without a shebang, which a direct exec rejects
 * (ENOEXEC). Every command passed this way is built from constants of this
 * tool; the one variable part, a demo account's email, is checked against
 * SHELL_SAFE_EMAIL first.
 */
const THROUGH_SHELL = true;
const SHELL_SAFE_EMAIL = /^[a-z0-9.+_-]+@[a-z0-9.-]+$/i;

/** Pause between readiness polls; also the resolution of phases A and B. */
export const POLL_INTERVAL_MS = 200;
/** A cold start rebuilds every package and app; ten minutes bounds a hung server, not a slow one. */
export const READY_TIMEOUT_MS = 600_000;
/** How long the stack gets to exit after SIGINT before SIGTERM, then SIGKILL. */
export const SHUTDOWN_GRACE_MS = 15_000;
/** How long the ports get to close after the process group has exited. */
export const PORTS_FREED_TIMEOUT_MS = 30_000;
/** Mailpit delivery is asynchronous (outbox → queue → SMTP); poll this long for a fresh code. */
export const LOGIN_CODE_TIMEOUT_MS = 60_000;
export const LOGIN_CODE_POLL_INTERVAL_MS = 1_000;

/**
 * @typedef {import("./timing.mjs").Measurement} Measurement
 * @typedef {{ label: string, stepMs: number, totalMs: number }} BootPhase
 * @typedef {{ mode: "cold" | "warm", startedAt: number, measurements: Measurement[], apiBootPhases: readonly BootPhase[], errors: string[] }} RunResult
 */

/**
 * @param {unknown} error
 * @returns {string}
 */
function messageOf(error) {
	return error instanceof Error ? error.message : String(error);
}

/**
 * @param {string} repoRoot
 * @returns {Promise<void>}
 */
export async function resetToCold(repoRoot) {
	await Promise.all(COLD_RESET_PATHS.map((relative) => rm(path.join(repoRoot, relative), { recursive: true, force: true })));
	for (const cacheRoot of metroCacheRoots()) {
		const entries = await readdir(cacheRoot).catch(() => []);
		const metroEntries = entries.filter((name) => name === METRO_CACHE_DIRECTORY || name.startsWith(METRO_FILE_MAP_PREFIX));
		await Promise.all(metroEntries.map((name) => rm(path.join(cacheRoot, name), { recursive: true, force: true })));
	}
}

/**
 * The Mailpit mailbox a login code for `email` lands in: the API's
 * EMAIL_TEST_TO when it is set (every email is redirected there), else the
 * account's own address.
 *
 * @param {string} repoRoot
 * @returns {Promise<(email: string) => string>}
 */
async function mailboxResolver(repoRoot) {
	let redirect = undefined;
	try {
		redirect = readEnvValue(await readFile(path.join(repoRoot, API_ENV_FILE), "utf8"), EMAIL_REDIRECT_KEY);
	} catch {
		redirect = undefined;
	}
	return (email) => redirect ?? email;
}

/**
 * The newest six-digit code in `mailbox`, or `undefined`.
 *
 * @param {string} repoRoot
 * @param {string} mailbox
 * @returns {Promise<string | undefined>}
 */
async function readMailpitCode(repoRoot, mailbox) {
	if (!SHELL_SAFE_EMAIL.test(mailbox)) {
		throw new Error("refusing to pass a malformed mailbox address to the shell");
	}
	try {
		const { stdout } = await execAsync(`pnpm --silent mail:latest --to ${mailbox} --code`, { cwd: repoRoot });
		const code = stdout.trim();
		return code.length > 0 ? code : undefined;
	} catch {
		return undefined;
	}
}

/**
 * @param {string} repoRoot
 * @param {(email: string) => string} mailboxOf
 * @returns {(email: string, previousCode: string | undefined) => Promise<string>}
 */
function freshCodeReader(repoRoot, mailboxOf) {
	return async (email, previousCode) => {
		const deadline = Date.now() + LOGIN_CODE_TIMEOUT_MS;
		while (Date.now() < deadline) {
			const code = await readMailpitCode(repoRoot, mailboxOf(email));
			if (code !== undefined && code !== previousCode) {
				return code;
			}
			await delay(LOGIN_CODE_POLL_INTERVAL_MS);
		}
		throw new Error(
			`no new login code for ${email} reached Mailpit within ${String(LOGIN_CODE_TIMEOUT_MS)} ms (is \`pnpm mailpit\` running? ${EMAIL_REDIRECT_KEY} in ${API_ENV_FILE} picks the mailbox)`,
		);
	};
}

/**
 * Stop the `pnpm dev` process group: SIGINT (turbo's graceful stop), then
 * SIGTERM and SIGKILL if it outlives the grace period.
 *
 * @param {import("node:child_process").ChildProcess} child
 * @param {Promise<void>} exited
 * @returns {Promise<void>}
 */
async function stopProcessGroup(child, exited) {
	const groupId = child.pid;
	if (groupId === undefined || child.exitCode !== null) {
		return;
	}
	for (const signal of ["SIGINT", "SIGTERM", "SIGKILL"]) {
		try {
			// A negative pid signals the whole group (`detached: true` made the child its leader).
			process.kill(-groupId, signal);
		} catch {
			return;
		}
		const outcome = await Promise.race([exited.then(() => "exited"), delay(SHUTDOWN_GRACE_MS).then(() => "timeout")]);
		if (outcome === "exited") {
			return;
		}
	}
}

/**
 * @returns {Promise<void>}
 */
async function waitForPortsFreed() {
	const deadline = Date.now() + PORTS_FREED_TIMEOUT_MS;
	for (;;) {
		const occupied = await findOccupiedPorts(DEV_SERVERS);
		if (occupied.length === 0) {
			return;
		}
		if (Date.now() >= deadline) {
			throw new Error(`ports still in use after stopping pnpm dev: ${occupied.map((server) => String(server.port)).join(", ")}`);
		}
		await delay(POLL_INTERVAL_MS);
	}
}

/**
 * @param {{ repoRoot: string, mode: "cold" | "warm", logPath: string, signal: AbortSignal }} options
 *   `signal` aborts the run (Ctrl-C): the stack is stopped and the run reports what it measured so far.
 * @returns {Promise<RunResult>}
 */
export async function runDevTiming({ repoRoot, mode, logPath, signal }) {
	signal.throwIfAborted();
	const occupied = await findOccupiedPorts(DEV_SERVERS);
	if (occupied.length > 0) {
		throw new Error(`port(s) already in use: ${occupied.map((server) => `${String(server.port)} (${server.id})`).join(", ")} — stop the running dev servers first`);
	}
	if (mode === "cold") {
		await resetToCold(repoRoot);
	}

	const now = () => performance.now();
	const sleep = (/** @type {number} */ ms) => delay(ms);
	/** @type {Measurement[]} */
	const measurements = [];
	/** @type {string[]} */
	const errors = [];
	const recorder = new ApiBootRecorder(now);
	const log = createWriteStream(logPath);

	const startedAt = Date.now();
	const spawnedAt = now();
	const child = spawn("pnpm run dev --ui=stream", { cwd: repoRoot, detached: true, shell: THROUGH_SHELL, stdio: ["ignore", "pipe", "pipe"] });
	/** @type {Promise<void>} */
	const exited = new Promise((resolve) => {
		child.once("exit", () => resolve());
	});
	// Aborts the readiness polls the moment `pnpm dev` dies, instead of polling a dead stack until the timeout.
	const stackExited = new AbortController();
	void exited.then(() => {
		stackExited.abort(new Error(`pnpm dev exited before every server was ready (see ${logPath})`));
	});
	const stopRequested = () => {
		void stopProcessGroup(child, exited);
	};
	signal.addEventListener("abort", stopRequested, { once: true });
	for (const stream of [child.stdout, child.stderr]) {
		readline.createInterface({ input: stream }).on("line", (line) => {
			recorder.accept(line);
			log.write(`${line}\n`);
		});
	}

	try {
		const readiness = await measureReadiness({
			servers: DEV_SERVERS,
			spawnedAt,
			timeoutMs: READY_TIMEOUT_MS,
			pollIntervalMs: POLL_INTERVAL_MS,
			now,
			sleep,
			signal: AbortSignal.any([stackExited.signal, signal]),
		});
		measurements.push(...readiness.measurements);

		try {
			measurements.push(apiBootMeasurement({ compiledAt: recorder.compiledAt, readyAt: readiness.readyAt.get("api") }));
		} catch (error) {
			errors.push(`phase ${PHASES.apiBoot.id}: ${messageOf(error)}`);
		}

		const mailboxOf = await mailboxResolver(repoRoot);
		const readLoginCode = freshCodeReader(repoRoot, mailboxOf);
		const readCurrentCode = (/** @type {string} */ email) => readMailpitCode(repoRoot, mailboxOf(email));
		for (const page of PAGE_TARGETS) {
			signal.throwIfAborted();
			try {
				const cookie = await signIn({ apiUrl: localUrl(API_PORT, ""), account: page.account, readLoginCode, readCurrentCode });
				measurements.push(await measureDownload({ phase: PHASES.firstPageCompile.id, target: page.id, url: localUrl(page.port, page.path), headers: { cookie }, now }));
			} catch (error) {
				errors.push(`phase ${PHASES.firstPageCompile.id} (${page.id}): ${messageOf(error)}`);
			}
		}

		signal.throwIfAborted();
		try {
			// Untimed: the manifest only names the bundle; the download below is what compiles it.
			const bundleUrl = await readLaunchAssetUrl(localUrl(METRO_PORT, METRO_MANIFEST_PATH), METRO_MANIFEST_HEADERS);
			measurements.push(await measureDownload({ phase: PHASES.firstMetroBundle.id, target: "mobile-ios", url: bundleUrl, now }));
		} catch (error) {
			errors.push(`phase ${PHASES.firstMetroBundle.id}: ${messageOf(error)}`);
		}
	} catch (error) {
		errors.push(signal.aborted ? `run interrupted: ${messageOf(signal.reason)}` : `phase ${PHASES.coldDev.id}: ${messageOf(error)}`);
	} finally {
		signal.removeEventListener("abort", stopRequested);
		await stopProcessGroup(child, exited);
		log.end();
	}
	await waitForPortsFreed();
	return { mode, startedAt, measurements, apiBootPhases: recorder.phases, errors };
}
