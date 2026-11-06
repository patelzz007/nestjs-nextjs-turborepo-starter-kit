#!/usr/bin/env node
/**
 * `pnpm ci:local` — run what .github/workflows/ci.yml runs, locally, and print
 * a per-job summary. The plan lives in ci-local-plan.ts.
 *
 * The database jobs run against THROWAWAY databases created next to the one in
 * apps/api/.env (`<name>_ci_local`, `<name>_ci_local_shadow`), migrated and
 * seeded from scratch and dropped afterwards — exactly like CI's fresh service
 * container, so state left behind by earlier local runs can never make a suite
 * pass locally and fail in CI. The analytics-consumer suite also needs the
 * local Kafka broker (`pnpm docker:up`) and apps/analytics-consumer/.env.
 *
 *   pnpm ci:local                    everything
 *   pnpm ci:local --skip-e2e         everything except the database jobs
 *   pnpm ci:local --e2e-only         only the database jobs (API, analytics consumer, browser)
 *   pnpm ci:local --only lint,test   only these non-database steps (the pre-push hook runs lint,typecheck,test)
 *   pnpm ci:local --no-cache         bypass the Turborepo cache (like a cold CI cache)
 *   pnpm ci:local --errors-only      the same steps, printing only failing tasks' logs (the pre-push hook)
 *   pnpm ci:local --base origin/main ref for the migration-history check (default origin/main)
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

import pg from "pg";

import { apiCiEnv, renderEnvFile } from "../api-ci-env/api-ci-env.ts";
import {
	API_CI_TENANCY,
	browserJob,
	databaseSteps,
	NON_INTERACTIVE_ENV,
	selectSteps,
	staticSteps,
	THROWAWAY_BROWSER_SUFFIX,
	THROWAWAY_DATABASE_SUFFIX,
	THROWAWAY_SHADOW_SUFFIX,
	throwawayDatabaseUrl,
	withDatabaseName,
	withoutQuery,
	type Step,
} from "./ci-local-plan.ts";
import { formatDuration } from "../shared/format-duration.ts";
import { describeOccupiedPorts, findOccupiedPorts } from "../shared/port-preflight.ts";
import { settings } from "../shared/settings.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");
const API_ENV_FILE = path.join(REPO_ROOT, settings.folders.api ?? "", ".env");
const CONSUMER_ENV_FILE = path.join(REPO_ROOT, settings.folders.analyticsConsumer ?? "", ".env");
const DEFAULT_BASE = "origin/main";
/** Where ci:local writes CI's generated API env files (gitignored with the server logs). */
const CI_ENV_DIR = path.join(REPO_ROOT, settings.artifacts.ci);
/** Owner read/write only: the files hold signing secrets. */
const ENV_FILE_MODE = 0o600;

function readEnvFile(filePath: string): NodeJS.Dict<string> {
	return existsSync(filePath) ? parseEnv(readFileSync(filePath, "utf8")) : {};
}

function parseArgs(argv: readonly string[]): { base: string; only: string[] | undefined; skipE2e: boolean; e2eOnly: boolean; noCache: boolean; errorsOnly: boolean } {
	const baseIndex = argv.indexOf("--base");
	const onlyIndex = argv.indexOf("--only");
	return {
		base: baseIndex === -1 ? DEFAULT_BASE : (argv[baseIndex + 1] ?? DEFAULT_BASE),
		only: onlyIndex === -1 ? undefined : (argv[onlyIndex + 1] ?? "").split(",").filter((id) => id.length > 0),
		skipE2e: argv.includes("--skip-e2e"),
		e2eOnly: argv.includes("--e2e-only"),
		noCache: argv.includes("--no-cache"),
		errorsOnly: argv.includes("--errors-only"),
	};
}

/**
 * Writes CI's API env for one job (src/api-ci-env/api-ci-env.ts, the generator ci.yml uses) pointed at a
 * throwaway database, and returns its path. The developer's apps/api/.env is never read by an API step.
 */

function writeApiCiEnv(job: "e2e" | "single" | "browser", databaseUrl: string): string {
	mkdirSync(CI_ENV_DIR, { recursive: true });
	const file = path.join(CI_ENV_DIR, `api-ci-${job}.env`);
	writeFileSync(file, renderEnvFile(apiCiEnv({ databaseUrl, ...API_CI_TENANCY[job] }).entries), { mode: ENV_FILE_MODE });
	return file;
}

/** One line of the summary. */
interface CiResult {
	job: string;
	id: string;
	ok: boolean;
	ms?: number;
	note?: string;
}

/** Runs one step; `{ ok, ms }` — whether it passed and how long it took. */
function runStep(step: Step): { ok: boolean; ms: number } {
	process.stdout.write(`\n▶ [${step.job}] ${step.command} ${step.args.join(" ")}\n`);
	const startedAt = performance.now();
	// Through `sh` (argv passed verbatim, never re-parsed): package-manager shims such
	// as nvm's `pnpm` can be shebang-less scripts that execve() rejects (ENOEXEC).
	const result = spawnSync("sh", ["-c", 'exec "$0" "$@"', step.command, ...step.args], {
		cwd: REPO_ROOT,
		stdio: "inherit",
		env: { ...process.env, ...NON_INTERACTIVE_ENV, ...step.env },
	});
	if (result.error !== undefined) {
		process.stderr.write(`could not start ${step.command}: ${result.error.message}\n`);
	}
	return { ok: result.status === 0, ms: performance.now() - startedAt };
}

/** Runs `sql` on the server's maintenance database (`postgres`). Database names are validated identifiers. */
async function onMaintenanceDatabase(databaseUrl: string, statements: readonly string[]): Promise<void> {
	const url = new URL(withoutQuery(databaseUrl));
	url.pathname = "/postgres";
	const client = new pg.Client({ connectionString: url.toString() });
	await client.connect();
	try {
		for (const statement of statements) {
			await client.query(statement);
		}
	} finally {
		await client.end();
	}
}

async function runDatabaseJobs(results: CiResult[]): Promise<void> {
	const developerUrl = readEnvFile(API_ENV_FILE).DATABASE_URL;
	if (developerUrl === undefined) {
		results.push({ job: "Database + API e2e", id: "e2e", ok: false, note: `${path.relative(REPO_ROOT, API_ENV_FILE)} has no DATABASE_URL` });
		return;
	}
	const main = throwawayDatabaseUrl(developerUrl, THROWAWAY_DATABASE_SUFFIX);
	const shadow = throwawayDatabaseUrl(developerUrl, THROWAWAY_SHADOW_SUFFIX);

	const consumerLogin = readEnvFile(CONSUMER_ENV_FILE).ANALYTICS_CONSUMER_DATABASE_URL;
	// The consumer's own least-privilege login, pointed at the throwaway database (its e2e suite provisions it).
	const consumerLoginUrl = consumerLogin === undefined ? undefined : withDatabaseName(consumerLogin, main.database);

	const recreate = [main.database, shadow.database].flatMap((name) => [`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`, `CREATE DATABASE "${name}"`]);
	await onMaintenanceDatabase(developerUrl, recreate);
	try {
		const apiEnvFiles = { e2e: writeApiCiEnv("e2e", main.url), single: writeApiCiEnv("single", main.url) };
		// Infrastructure locations come from this machine (as ci.yml's job sets REDIS_URL); settings and secrets from CI's file.
		const redisUrl = readEnvFile(API_ENV_FILE).REDIS_URL;
		for (const step of databaseSteps({ databaseUrl: main.url, shadowDatabaseUrl: shadow.url, consumerLoginUrl, runId: String(Date.now()), apiEnvFiles, redisUrl })) {
			const { ok, ms } = runStep(step);
			results.push({ job: step.job, id: step.id, ok, ms });
			if (!ok) {
				break; // later steps depend on this one, exactly as in the CI job
			}
		}
		if (consumerLoginUrl === undefined) {
			results.push({
				job: "Analytics consumer e2e",
				id: "e2e:analytics-consumer",
				ok: false,
				note: "not run: apps/analytics-consumer/.env is missing (copy .env.example; needs `pnpm docker:up` for Kafka)",
			});
		}
	} finally {
		await onMaintenanceDatabase(
			developerUrl,
			[main.database, shadow.database].map((name) => `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`),
		);
	}
}

const SERVER_LOG_DIR = path.join(REPO_ROOT, settings.artifacts.ci);

/** Starts a long-running server in the background, its output in .artifacts/ci/<id>.log. */
function startServer(step: Step): ChildProcess {
	mkdirSync(SERVER_LOG_DIR, { recursive: true });
	const log = openSync(path.join(SERVER_LOG_DIR, `${step.id.replace(":", "-")}.log`), "w");
	process.stdout.write(`\n▶ [${step.job}] (background) ${step.command} ${step.args.join(" ")}\n`);
	return spawn("sh", ["-c", 'exec "$0" "$@"', step.command, ...step.args], {
		cwd: REPO_ROOT,
		stdio: ["ignore", log, log],
		detached: true,
		env: { ...process.env, ...NON_INTERACTIVE_ENV, ...step.env },
	});
}

/** Stops a background server and everything it spawned (its process group). */
function stopServer(child: ChildProcess): void {
	if (child.pid !== undefined && child.exitCode === null) {
		try {
			process.kill(-child.pid, "SIGTERM");
		} catch {
			// The group already exited.
		}
	}
}

/** The `browser-e2e` job against its own fresh throwaway database (dev seed only, as in CI). */
async function runBrowserJob(results: CiResult[]): Promise<void> {
	const developerUrl = readEnvFile(API_ENV_FILE).DATABASE_URL;
	if (developerUrl === undefined) {
		results.push({ job: "Browser e2e", id: "browser", ok: false, note: `${path.relative(REPO_ROOT, API_ENV_FILE)} has no DATABASE_URL` });
		return;
	}
	const database = throwawayDatabaseUrl(developerUrl, THROWAWAY_BROWSER_SUFFIX);
	const job = browserJob({ databaseUrl: database.url, apiEnvFile: writeApiCiEnv("browser", database.url) });
	// Before the (slow) build: a server that cannot bind its port would leave the suites running against whatever holds it.
	const occupied = await findOccupiedPorts(job.servers);
	if (occupied.length > 0) {
		results.push({ job: "Browser e2e", id: "browser:ports", ok: false, note: describeOccupiedPorts(occupied) });
		return;
	}
	await onMaintenanceDatabase(developerUrl, [`DROP DATABASE IF EXISTS "${database.database}" WITH (FORCE)`, `CREATE DATABASE "${database.database}"`]);
	const servers = [];
	try {
		for (const step of job.setup) {
			const { ok, ms } = runStep(step);
			results.push({ job: step.job, id: step.id, ok, ms });
			if (!ok) {
				return;
			}
		}
		servers.push(...job.servers.map(startServer));
		for (const step of job.suites) {
			const { ok, ms } = runStep(step);
			results.push({ job: step.job, id: step.id, ok, ms, ...(ok ? {} : { note: "server logs: .artifacts/ci/" }) });
			if (!ok && step.id === "browser:wait") {
				return;
			}
		}
	} finally {
		servers.forEach(stopServer);
		await onMaintenanceDatabase(developerUrl, [`DROP DATABASE IF EXISTS "${database.database}" WITH (FORCE)`]);
	}
}

async function main(): Promise<void> {
	const startedAt = performance.now();
	const options = parseArgs(process.argv.slice(2));
	const results: CiResult[] = [];

	if (options.only !== undefined) {
		process.stdout.write(`ci:local --only ${options.only.join(",")}: a subset of CI, not a full run\n`);
		for (const step of selectSteps(staticSteps(options), options.only)) {
			results.push({ job: step.job, id: step.id, ...runStep(step) });
		}
	} else if (options.e2eOnly) {
		results.push({ job: "Static jobs", id: "static", ok: false, note: "skipped (--e2e-only): this is NOT a full CI run" });
	} else {
		for (const step of staticSteps(options)) {
			results.push({ job: step.job, id: step.id, ...runStep(step) });
		}
	}
	if (options.only === undefined) {
		if (options.skipE2e) {
			results.push({ job: "Database jobs", id: "e2e", ok: false, note: "skipped (--skip-e2e): this is NOT a full CI run" });
		} else {
			await runDatabaseJobs(results);
			await runBrowserJob(results);
		}
	}

	process.stdout.write("\n── ci:local summary ──\n");
	for (const result of results) {
		const duration = result.ms === undefined ? "" : `  ${formatDuration(result.ms)}`;
		process.stdout.write(`${result.ok ? "PASS" : "FAIL"}  ${result.job} (${result.id})${duration}${result.note === undefined ? "" : ` — ${result.note}`}\n`);
	}
	process.stdout.write(`\nTotal ${formatDuration(performance.now() - startedAt)}\n`);
	if (results.some((result) => !result.ok)) {
		process.exitCode = 1;
	}
}

main().catch((error: unknown) => {
	process.stderr.write(`ci:local failed: ${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
});
