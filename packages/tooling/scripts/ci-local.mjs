#!/usr/bin/env node
/**
 * `pnpm ci:local` — run what .github/workflows/ci.yml runs, locally, and print
 * a per-job summary. The plan lives in ./lib/ci-local-plan.mjs.
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
 *   pnpm ci:local --no-cache         bypass the Turborepo cache (like a cold CI cache)
 *   pnpm ci:local --base origin/main ref for the migration-history check (default origin/main)
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

import pg from "pg";

import {
	browserJob,
	databaseSteps,
	staticSteps,
	THROWAWAY_BROWSER_SUFFIX,
	THROWAWAY_DATABASE_SUFFIX,
	THROWAWAY_SHADOW_SUFFIX,
	throwawayDatabaseUrl,
	withDatabaseName,
	withoutQuery,
} from "./lib/ci-local-plan.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const API_ENV_FILE = path.join(REPO_ROOT, "apps/api/.env");
const CONSUMER_ENV_FILE = path.join(REPO_ROOT, "apps/analytics-consumer/.env");
const DEFAULT_BASE = "origin/main";

function readEnvFile(filePath) {
	return existsSync(filePath) ? parseEnv(readFileSync(filePath, "utf8")) : {};
}

function parseArgs(argv) {
	const baseIndex = argv.indexOf("--base");
	return {
		base: baseIndex === -1 ? DEFAULT_BASE : (argv[baseIndex + 1] ?? DEFAULT_BASE),
		skipE2e: argv.includes("--skip-e2e"),
		e2eOnly: argv.includes("--e2e-only"),
		noCache: argv.includes("--no-cache"),
	};
}

function runStep(step) {
	console.log(`\n▶ [${step.job}] ${step.command} ${step.args.join(" ")}`);
	// Through `sh` (argv passed verbatim, never re-parsed): package-manager shims such
	// as nvm's `pnpm` can be shebang-less scripts that execve() rejects (ENOEXEC).
	const result = spawnSync("sh", ["-c", 'exec "$0" "$@"', step.command, ...step.args], { cwd: REPO_ROOT, stdio: "inherit", env: { ...process.env, ...step.env } });
	if (result.error !== undefined) {
		console.error(`could not start ${step.command}: ${result.error.message}`);
	}
	return result.status === 0;
}

/** Runs `sql` on the server's maintenance database (`postgres`). Database names are validated identifiers. */
async function onMaintenanceDatabase(databaseUrl, statements) {
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

async function runDatabaseJobs(results) {
	const developerUrl = readEnvFile(API_ENV_FILE).DATABASE_URL;
	if (developerUrl === undefined) {
		results.push({ job: "Database + API e2e", id: "e2e", ok: false, note: "apps/api/.env has no DATABASE_URL" });
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
		for (const step of databaseSteps({ databaseUrl: main.url, shadowDatabaseUrl: shadow.url, consumerLoginUrl, runId: String(Date.now()) })) {
			const ok = runStep(step);
			results.push({ job: step.job, id: step.id, ok });
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

const SERVER_LOG_DIR = path.join(REPO_ROOT, ".ci-logs");

/** Starts a long-running server in the background, its output in .ci-logs/<id>.log. */
function startServer(step) {
	mkdirSync(SERVER_LOG_DIR, { recursive: true });
	const log = openSync(path.join(SERVER_LOG_DIR, `${step.id.replace(":", "-")}.log`), "w");
	console.log(`\n▶ [${step.job}] (background) ${step.command} ${step.args.join(" ")}`);
	return spawn("sh", ["-c", 'exec "$0" "$@"', step.command, ...step.args], {
		cwd: REPO_ROOT,
		stdio: ["ignore", log, log],
		detached: true,
		env: { ...process.env, ...step.env },
	});
}

/** Stops a background server and everything it spawned (its process group). */
function stopServer(child) {
	if (child.pid !== undefined && child.exitCode === null) {
		try {
			process.kill(-child.pid, "SIGTERM");
		} catch {
			// The group already exited.
		}
	}
}

/** The `browser-e2e` job against its own fresh throwaway database (dev seed only, as in CI). */
async function runBrowserJob(results) {
	const developerUrl = readEnvFile(API_ENV_FILE).DATABASE_URL;
	if (developerUrl === undefined) {
		results.push({ job: "Browser e2e", id: "browser", ok: false, note: "apps/api/.env has no DATABASE_URL" });
		return;
	}
	const database = throwawayDatabaseUrl(developerUrl, THROWAWAY_BROWSER_SUFFIX);
	await onMaintenanceDatabase(developerUrl, [`DROP DATABASE IF EXISTS "${database.database}" WITH (FORCE)`, `CREATE DATABASE "${database.database}"`]);
	const job = browserJob({ databaseUrl: database.url });
	const servers = [];
	try {
		for (const step of job.setup) {
			const ok = runStep(step);
			results.push({ job: step.job, id: step.id, ok });
			if (!ok) {
				return;
			}
		}
		servers.push(...job.servers.map(startServer));
		for (const step of job.suites) {
			const ok = runStep(step);
			results.push({ job: step.job, id: step.id, ok, ...(ok ? {} : { note: "server logs: .ci-logs/" }) });
			if (!ok && step.id === "browser:wait") {
				return;
			}
		}
	} finally {
		servers.forEach(stopServer);
		await onMaintenanceDatabase(developerUrl, [`DROP DATABASE IF EXISTS "${database.database}" WITH (FORCE)`]);
	}
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const results = [];

	if (options.e2eOnly) {
		results.push({ job: "Static jobs", id: "static", ok: false, note: "skipped (--e2e-only): this is NOT a full CI run" });
	} else {
		for (const step of staticSteps(options)) {
			results.push({ job: step.job, id: step.id, ok: runStep(step) });
		}
	}
	if (options.skipE2e) {
		results.push({ job: "Database jobs", id: "e2e", ok: false, note: "skipped (--skip-e2e): this is NOT a full CI run" });
	} else {
		await runDatabaseJobs(results);
		await runBrowserJob(results);
	}

	console.log("\n── ci:local summary ──");
	for (const result of results) {
		console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.job} (${result.id})${result.note === undefined ? "" : ` — ${result.note}`}`);
	}
	if (results.some((result) => !result.ok)) {
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(`ci:local failed: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
});
