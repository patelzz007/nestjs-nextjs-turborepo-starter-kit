/**
 * The step plan behind `pnpm ci:local` (scripts/ci-local.mjs): the same
 * commands, in the same order, as the jobs in .github/workflows/ci.yml. Pure
 * data + URL helpers so the plan is unit-tested (ci-local-plan.test.mjs);
 * keep it in step with the workflow whenever a job changes.
 */

/**
 * The ports the apps listen on in CI (ci.yml). The one definition every URL,
 * server command and the browser job's port preflight derive from.
 */
export const LOCAL_APP_PORTS = { api: 8080, web: 3000, admin: 3001, merchant: 3003 };

/**
 * @param {number} port
 * @param {string} [path]
 * @returns {string}
 */
export function localUrl(port, path = "") {
	return `http://localhost:${String(port)}${path}`;
}

/** Public, non-secret build-time config the CI `build` job sets (ci.yml → jobs.build.env). */
export const CI_BUILD_ENV = {
	NEXT_PUBLIC_API_URL: localUrl(LOCAL_APP_PORTS.api),
	NEXT_PUBLIC_APP_URL: localUrl(LOCAL_APP_PORTS.web),
	NEXT_PUBLIC_WEB_URL: localUrl(LOCAL_APP_PORTS.web),
	NEXT_PUBLIC_ADMIN_URL: localUrl(LOCAL_APP_PORTS.admin),
	NEXT_PUBLIC_MERCHANT_URL: localUrl(LOCAL_APP_PORTS.merchant),
};

/** Suffixes of the throwaway databases the e2e steps create and drop (CI uses fresh service containers). */
export const THROWAWAY_DATABASE_SUFFIX = "_ci_local";
export const THROWAWAY_SHADOW_SUFFIX = "_ci_local_shadow";
export const THROWAWAY_BROWSER_SUFFIX = "_ci_local_browser";

/** The browser suites' config (ci.yml → jobs.browser-e2e.env). The admin login is the PUBLIC seed account. */
export const BROWSER_SUITE_ENV = {
	WEB_E2E_BASE_URL: localUrl(LOCAL_APP_PORTS.web),
	ADMIN_E2E_BASE_URL: localUrl(LOCAL_APP_PORTS.admin),
	ADMIN_E2E_EMAIL: "superadmin@example.com",
	ADMIN_E2E_PASSWORD: "SuperAdmin@123",
};

/**
 * API runtime config the browser job's API server needs from CI's API env
 * (.github/actions/write-api-ci-env). Without it the API falls back to the
 * developer's apps/api/.env, whose login verification emails a code the
 * admin suite's seed login cannot read.
 */
export const BROWSER_API_ENV = {
	LOGIN_VERIFICATION_MODE: "disabled",
};

/** Readiness URLs the browser job waits on (API readiness probe, web, admin login). */
export const BROWSER_READINESS_URLS = [localUrl(LOCAL_APP_PORTS.api, "/health/ready"), localUrl(LOCAL_APP_PORTS.web, "/"), localUrl(LOCAL_APP_PORTS.admin, "/auth/login")];
/** Budget for the three servers to become ready. */
export const BROWSER_READINESS_TIMEOUT_MS = 120_000;

/** Postgres identifiers are limited to 63 bytes. */
const MAX_IDENTIFIER_LENGTH = 63;
const SAFE_DATABASE_NAME = /^[a-z0-9_]+$/;

/**
 * A database URL identical to `baseUrl` except for the database name, which is
 * the base name (lower-cased, non-alphanumerics → `_`) plus `suffix`.
 *
 * @param {string} baseUrl
 * @param {string} suffix
 * @returns {{ url: string, database: string }}
 */
export function throwawayDatabaseUrl(baseUrl, suffix) {
	const url = new URL(baseUrl);
	const baseName = decodeURIComponent(url.pathname.replace(/^\//, ""))
		.toLowerCase()
		.replace(/[^a-z0-9_]/g, "_");
	const database = `${baseName}${suffix}`.slice(-MAX_IDENTIFIER_LENGTH);
	if (baseName.length === 0 || !SAFE_DATABASE_NAME.test(database)) {
		throw new Error("DATABASE_URL must name a database (e.g. postgresql://user:pass@localhost:5432/app)");
	}
	return { url: withDatabaseName(baseUrl, database), database };
}

/**
 * `url` pointing at database `database` (same server, credentials and query).
 *
 * @param {string} url
 * @param {string} database
 * @returns {string}
 */
export function withDatabaseName(url, database) {
	const parsed = new URL(url);
	parsed.pathname = `/${database}`;
	return parsed.toString();
}

/**
 * `url` without its query string (`?schema=public` is a Prisma-only parameter
 * that plain `pg` connection strings do not use).
 *
 * @param {string} url
 * @returns {string}
 */
export function withoutQuery(url) {
	const parsed = new URL(url);
	parsed.search = "";
	return parsed.toString();
}

/**
 * @typedef {{ id: string, job: string, command: string, args: string[], env?: Record<string, string> }} Step
 */

/**
 * The non-database steps, one per CI job (or job step), in workflow order.
 *
 * @param {{ base: string, noCache: boolean }} options
 * @returns {Step[]}
 */
export function staticSteps({ base, noCache }) {
	const turbo = (task) => ["turbo", "run", task, ...(noCache ? ["--force"] : [])];
	return [
		{ id: "lint", job: "Lint", command: "pnpm", args: turbo("lint") },
		{ id: "typecheck", job: "Typecheck", command: "pnpm", args: turbo("typecheck") },
		{ id: "test", job: "Unit tests", command: "pnpm", args: turbo("test") },
		{ id: "build", job: "Build", command: "pnpm", args: turbo("build"), env: CI_BUILD_ENV },
		{ id: "rls-manifest", job: "RLS manifest drift", command: "pnpm", args: ["--filter", "@workspace/api", "db:check-rls-manifest"] },
		{ id: "deps", job: "Dependency consistency", command: "pnpm", args: ["turbo", "run", "deps:check"] },
		{ id: "migration-history", job: "Migration history", command: "node", args: ["packages/tooling/scripts/check-migration-history.mjs", "--base", base, "--working-tree"] },
		{ id: "audit", job: "Dependency audit", command: "pnpm", args: ["audit", "--audit-level=high"] },
		{ id: "secret-scan", job: "Secret scan", command: "node", args: ["packages/tooling/scripts/check-env-example-secrets.mjs"] },
		{ id: "docs-links", job: "Docs link check", command: "node", args: ["apps/docs/scripts/check-links.mjs"] },
	];
}

/**
 * The database steps of the `e2e` and `analytics-consumer-e2e` jobs, run
 * against throwaway databases (never the developer's DATABASE_URL).
 *
 * The API e2e step gets its own BullMQ key prefix (`E2E_BULLMQ_PREFIX`,
 * `ci-local:<runId>`): a dev API running on the same Redis can never steal its jobs.
 *
 * @param {{ databaseUrl: string, shadowDatabaseUrl: string, consumerLoginUrl: string | undefined, runId: string }} urls
 * @returns {Step[]}
 */
export function databaseSteps({ databaseUrl, shadowDatabaseUrl, consumerLoginUrl, runId }) {
	const api = { DATABASE_URL: databaseUrl };
	const steps = [
		{ id: "e2e:build", job: "Database + API e2e", command: "pnpm", args: ["turbo", "run", "build", "--filter=@workspace/api^..."] },
		{ id: "e2e:deploy", job: "Database + API e2e", command: "pnpm", args: ["db:deploy"], env: api },
		{
			id: "e2e:drift",
			job: "Database + API e2e",
			command: "pnpm",
			args: ["--filter", "@workspace/api", "db:check-drift"],
			env: { ...api, SHADOW_DATABASE_URL: shadowDatabaseUrl },
		},
		{ id: "e2e:seed", job: "Database + API e2e", command: "pnpm", args: ["db:seed", "--", "--scenario", "development"], env: api },
		{ id: "e2e:seed-coverage", job: "Database + API e2e", command: "pnpm", args: ["--filter", "@workspace/api", "db:check-seed-coverage"], env: api },
		{
			id: "e2e:api",
			job: "Database + API e2e",
			command: "pnpm",
			args: ["--filter", "@workspace/api", "test:e2e"],
			env: { ...api, E2E_BULLMQ_PREFIX: `ci-local:${runId}` },
		},
		{ id: "e2e:seed-enterprise", job: "Database + API e2e", command: "pnpm", args: ["db:seed", "--", "--scenario", "enterprise", "--seed", "1"], env: api },
	];
	if (consumerLoginUrl !== undefined) {
		steps.push({
			id: "e2e:analytics-consumer",
			job: "Analytics consumer e2e",
			command: "pnpm",
			args: ["--filter", "@workspace/analytics-consumer", "test:e2e"],
			env: { ...api, ANALYTICS_CONSUMER_DB_ADMIN_URL: withoutQuery(databaseUrl), ANALYTICS_CONSUMER_DATABASE_URL: consumerLoginUrl },
		});
	}
	return steps;
}

/**
 * The `browser-e2e` job: build, migrate + seed a fresh database, start the API,
 * web and admin in the background (`servers`), wait for readiness, then run
 * both Playwright suites (`suites`). `setup` runs before the servers start.
 * Each server carries the `port` it binds, for the port preflight.
 *
 * @param {{ databaseUrl: string }} urls
 * @returns {{ setup: Step[], servers: (Step & { port: number })[], suites: Step[] }}
 */
export function browserJob({ databaseUrl }) {
	const job = "Browser e2e";
	const api = { DATABASE_URL: databaseUrl };
	return {
		setup: [
			{
				id: "browser:build",
				job,
				command: "pnpm",
				args: ["turbo", "run", "build", "--filter=@workspace/api", "--filter=@workspace/web", "--filter=@workspace/admin"],
				env: CI_BUILD_ENV,
			},
			{ id: "browser:deploy", job, command: "pnpm", args: ["db:deploy"], env: api },
			{ id: "browser:seed", job, command: "pnpm", args: ["db:seed", "--", "--scenario", "development"], env: api },
			{ id: "browser:install", job, command: "pnpm", args: ["exec", "playwright", "install", "chromium"] },
		],
		servers: [
			{
				id: "browser:api",
				job,
				command: "pnpm",
				args: ["--filter", "@workspace/api", "start"],
				env: { ...api, ...BROWSER_API_ENV, PORT: String(LOCAL_APP_PORTS.api) },
				port: LOCAL_APP_PORTS.api,
			},
			{
				id: "browser:web",
				job,
				command: "pnpm",
				args: ["--filter", "@workspace/web", "exec", "next", "start", "--port", String(LOCAL_APP_PORTS.web)],
				port: LOCAL_APP_PORTS.web,
			},
			{
				id: "browser:admin",
				job,
				command: "pnpm",
				args: ["--filter", "@workspace/admin", "exec", "next", "start", "--port", String(LOCAL_APP_PORTS.admin)],
				port: LOCAL_APP_PORTS.admin,
			},
		],
		suites: [
			{
				id: "browser:wait",
				job,
				command: "node",
				args: ["packages/tooling/scripts/wait-for-http.mjs", "--timeout-ms", String(BROWSER_READINESS_TIMEOUT_MS), ...BROWSER_READINESS_URLS],
			},
			{ id: "browser:web-suite", job, command: "pnpm", args: ["--filter", "@workspace/web", "test:browser"], env: BROWSER_SUITE_ENV },
			{ id: "browser:admin-suite", job, command: "pnpm", args: ["--filter", "@workspace/admin", "test:browser"], env: BROWSER_SUITE_ENV },
		],
	};
}
