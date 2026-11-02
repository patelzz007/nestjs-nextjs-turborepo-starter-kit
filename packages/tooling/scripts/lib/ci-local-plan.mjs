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
 * The environment every step runs with: the gate is never interactive, exactly as on CI.
 * Under turbo's TUI (`turbo.json` "ui": "tui") each task gets a pseudo-terminal, so a
 * tool that prompts on a TTY — `expo install --check` asks whether to fix outdated
 * packages — waits forever in a hidden pane, and the pre-push hook hangs until GitHub
 * drops the idle push connection. Set in the environment, not as a flag, so every step
 * keeps the workflow's exact command.
 */
export const NON_INTERACTIVE_ENV = Object.freeze({ TURBO_UI: "false" });

/**
 * The non-database steps, one per CI job (or job step), in workflow order.
 * `errorsOnly` (`ci:local --errors-only`, the pre-push hook) keeps the same
 * commands but shows only failing tasks' logs (`--output-logs=errors-only`).
 * @param {{ base: string, noCache: boolean, errorsOnly?: boolean }} options
 * @returns {Step[]}
 */
export function staticSteps({ base, noCache, errorsOnly = false }) {
	const turbo = (task) => ["turbo", "run", task, ...(noCache ? ["--force"] : []), ...(errorsOnly ? ["--output-logs=errors-only"] : [])];
	return [
		{ id: "lint", job: "Lint", command: "pnpm", args: turbo("lint") },
		{ id: "typecheck", job: "Typecheck", command: "pnpm", args: turbo("typecheck") },
		// One workspace's suite at a time (docs/technical/operations/ci.md, "Unit tests").
		{ id: "test", job: "Unit tests", command: "pnpm", args: [...turbo("test"), "--concurrency=1"] },
		{ id: "build", job: "Build", command: "pnpm", args: turbo("build"), env: CI_BUILD_ENV },
		{ id: "bundle-budgets", job: "Build", command: "pnpm", args: ["tools", "bundle:check"] },
		{ id: "rls-manifest", job: "RLS manifest drift", command: "pnpm", args: ["--filter", "@workspace/api", "db:check-rls-manifest"] },
		{ id: "deps", job: "Dependency consistency", command: "pnpm", args: ["turbo", "run", "deps:check"] },
		{ id: "migration-history", job: "Migration history", command: "node", args: ["packages/tooling/scripts/check-migration-history.mjs", "--base", base, "--working-tree"] },
		{ id: "audit", job: "Dependency audit", command: "pnpm", args: ["audit", "--audit-level=high"] },
		{ id: "secret-scan", job: "Secret scan", command: "node", args: ["packages/tooling/scripts/check-env-example-secrets.mjs"] },
		{ id: "docs-links", job: "Docs link check", command: "node", args: ["apps/docs/scripts/check-links.mjs"] },
	];
}

/**
 * `steps` narrowed to `ids` (`ci:local --only lint,typecheck,test`, the
 * pre-push hook), in plan order. An unknown id is an error, never a silent no-op.
 *
 * @param {Step[]} steps
 * @param {readonly string[]} ids
 * @returns {Step[]}
 */
export function selectSteps(steps, ids) {
	const known = new Set(steps.map((step) => step.id));
	const unknown = ids.filter((id) => !known.has(id));
	if (unknown.length > 0 || ids.length === 0) {
		throw new Error(`--only needs step ids from: ${[...known].join(", ")} (got: ${ids.join(", ") || "none"})`);
	}
	return steps.filter((step) => ids.includes(step.id));
}

/**
 * The tenancy each CI job writes into its API env (`write-api-ci-env` inputs in ci.yml), so ci:local
 * generates the same three files (scripts/lib/api-ci-env.mjs) and points each job's API steps at its own:
 * - `e2e`: RewardHub's multi-tenant mode, no default tenant (multi-tenancy plan MT-70);
 * - `single`: ci.yml → jobs.e2e-single-tenant, serving the two-tenant fixture's Tenant A;
 * - `browser`: ci.yml → jobs.browser-e2e, serving the tenant `pnpm db:seed` creates.
 */
export const API_CI_TENANCY = {
	e2e: { tenancyMode: "multi" },
	single: { tenancyMode: "single", defaultTenantId: "019b76da-a810-7000-8000-0000000000a1" },
	browser: { tenancyMode: "single", defaultTenantId: "019b76da-a800-7a94-a198-23ad1b4cfdd9" },
};

/**
 * What an API step runs with: CI's generated env file (`DOTENV_PATH`, honoured by `dotenv run`,
 * `dotenv/config` and every loader in apps/api) instead of the developer's apps/api/.env, plus the
 * job's infrastructure locations, as ci.yml sets them at job level.
 *
 * @param {string} envFile
 * @param {string} databaseUrl
 * @param {string | undefined} [redisUrl]
 */
function apiStepEnv(envFile, databaseUrl, redisUrl) {
	return { DOTENV_PATH: envFile, DATABASE_URL: databaseUrl, ...(redisUrl === undefined ? {} : { REDIS_URL: redisUrl }) };
}

/**
 * The database steps of the `e2e` and `analytics-consumer-e2e` jobs, run
 * against throwaway databases (never the developer's DATABASE_URL).
 *
 * Every API step reads CI's generated env (`apiEnvFiles`), never the
 * developer's apps/api/.env: a setting only the developer has (an encryption
 * key, a login mode) can't make a step pass locally and fail in CI. The `e2e`
 * job's steps also get the developer's Redis, as ci.yml's job sets REDIS_URL;
 * the single-tenant job has none, as in ci.yml.
 *
 * The API e2e step gets its own BullMQ key prefix (`E2E_BULLMQ_PREFIX`,
 * `ci-local:<runId>`): a dev API running on the same Redis can never steal its jobs.
 *
 * @param {{ databaseUrl: string, shadowDatabaseUrl: string, consumerLoginUrl: string | undefined, runId: string, apiEnvFiles: { e2e: string, single: string }, redisUrl?: string | undefined }} urls
 * @returns {Step[]}
 */
export function databaseSteps({ databaseUrl, shadowDatabaseUrl, consumerLoginUrl, runId, apiEnvFiles, redisUrl }) {
	const api = apiStepEnv(apiEnvFiles.e2e, databaseUrl, redisUrl);
	const single = apiStepEnv(apiEnvFiles.single, databaseUrl);
	const steps = [
		{ id: "e2e:build", job: "Database + API e2e", command: "pnpm", args: ["turbo", "run", "build", "--filter=@workspace/api^..."] },
		{ id: "e2e:deploy", job: "Database + API e2e", command: "pnpm", args: ["tools", "db:deploy"], env: api },
		{
			id: "e2e:drift",
			job: "Database + API e2e",
			command: "pnpm",
			args: ["--filter", "@workspace/api", "db:check-drift"],
			env: { ...api, SHADOW_DATABASE_URL: shadowDatabaseUrl },
		},
		{ id: "e2e:seed", job: "Database + API e2e", command: "pnpm", args: ["db:seed", "--", "--scenario", "development"], env: api },
		{ id: "e2e:seed-coverage", job: "Database + API e2e", command: "pnpm", args: ["--filter", "@workspace/api", "db:check-seed-coverage"], env: api },
		{ id: "e2e:integrity", job: "Database + API e2e", command: "pnpm", args: ["--filter", "@workspace/api", "db:check-tenant-integrity"], env: api },
		{
			id: "e2e:api",
			job: "Database + API e2e",
			command: "pnpm",
			args: ["--filter", "@workspace/api", "test:e2e"],
			env: { ...api, E2E_BULLMQ_PREFIX: `ci-local:${runId}` },
		},
		{ id: "e2e:tenancy", job: "Database + API e2e", command: "pnpm", args: ["--filter", "@workspace/api", "test:e2e:tenancy"], env: api },
		{ id: "e2e:rls", job: "Database + API e2e", command: "pnpm", args: ["--filter", "@workspace/api", "test:e2e:rls"], env: api },
		{
			id: "e2e:single-tenancy",
			job: "Single-tenant e2e + RLS",
			command: "pnpm",
			args: ["--filter", "@workspace/api", "test:e2e:tenancy:single"],
			env: single,
		},
		{ id: "e2e:single-rls", job: "Single-tenant e2e + RLS", command: "pnpm", args: ["--filter", "@workspace/api", "test:e2e:rls"], env: single },
		{ id: "e2e:seed-enterprise", job: "Database + API e2e", command: "pnpm", args: ["db:seed", "--", "--scenario", "enterprise", "--seed", "1"], env: api },
	];
	if (consumerLoginUrl !== undefined) {
		steps.push({
			id: "e2e:analytics-consumer",
			job: "Analytics consumer e2e",
			command: "pnpm",
			args: ["--filter", "@workspace/analytics-consumer", "test:e2e"],
			// Its own apps/analytics-consumer/.env (Kafka) stays in charge: no API DOTENV_PATH here.
			env: { DATABASE_URL: databaseUrl, ANALYTICS_CONSUMER_DB_ADMIN_URL: withoutQuery(databaseUrl), ANALYTICS_CONSUMER_DATABASE_URL: consumerLoginUrl },
		});
	}
	return steps;
}

/**
 * The admin features the browser suite drives that a production build leaves off (ci.yml →
 * jobs.browser-e2e.env): the kanban board lives in the developer component gallery.
 */
export const BROWSER_ADMIN_FEATURE_ENV = { ADMIN_COMPONENT_GALLERY: "true" };

/**
 * The `browser-e2e` job: build, migrate + seed a fresh database, start the API,
 * web and admin in the background (`servers`), wait for readiness, then run
 * both Playwright suites (`suites`). `setup` runs before the servers start.
 * Each server carries the `port` it binds, for the port preflight.
 *
 * The API steps and server read CI's generated browser env (`apiEnvFile`),
 * never the developer's apps/api/.env.
 *
 * @param {{ databaseUrl: string, apiEnvFile: string }} urls
 * @returns {{ setup: Step[], servers: (Step & { port: number })[], suites: Step[] }}
 */
export function browserJob({ databaseUrl, apiEnvFile }) {
	const job = "Browser e2e";
	const api = apiStepEnv(apiEnvFile, databaseUrl);
	return {
		setup: [
			{
				id: "browser:build",
				job,
				command: "pnpm",
				args: ["turbo", "run", "build", "--filter=@workspace/api", "--filter=@workspace/web", "--filter=@workspace/admin"],
				env: { ...CI_BUILD_ENV, ...BROWSER_ADMIN_FEATURE_ENV },
			},
			{ id: "browser:deploy", job, command: "pnpm", args: ["tools", "db:deploy"], env: api },
			{ id: "browser:seed", job, command: "pnpm", args: ["db:seed", "--", "--scenario", "development"], env: api },
			{ id: "browser:install", job, command: "pnpm", args: ["exec", "playwright", "install", "chromium"] },
		],
		servers: [
			{
				id: "browser:api",
				job,
				command: "pnpm",
				args: ["--filter", "@workspace/api", "start"],
				env: { ...api, PORT: String(LOCAL_APP_PORTS.api) },
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
				env: BROWSER_ADMIN_FEATURE_ENV,
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
