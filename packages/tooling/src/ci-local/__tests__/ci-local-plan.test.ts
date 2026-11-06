import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
	API_CI_TENANCY,
	BROWSER_ADMIN_FEATURE_ENV,
	BROWSER_READINESS_URLS,
	LOCAL_APP_PORTS,
	BROWSER_SUITE_ENV,
	browserJob,
	CI_BUILD_ENV,
	databaseSteps,
	NON_INTERACTIVE_ENV,
	selectSteps,
	staticSteps,
	THROWAWAY_DATABASE_SUFFIX,
	throwawayDatabaseUrl,
	withDatabaseName,
	withoutQuery,
} from "../ci-local-plan.ts";
import { easConfig, packageManifest } from "../../testing/manifests.ts";

const WORKFLOW = readFileSync(path.resolve(import.meta.dirname, "../../../../../.github/workflows/ci.yml"), "utf8");
const API_CI_ENV_ACTION = readFileSync(path.resolve(import.meta.dirname, "../../../../../.github/actions/write-api-ci-env/action.yml"), "utf8");
/** The generated CI env files ci:local points the API at (paths are illustrative). */
const API_ENV_FILES = { e2e: "/repo/.artifacts/ci/api-ci-e2e.env", single: "/repo/.artifacts/ci/api-ci-single.env" };
const BROWSER_API_ENV_FILE = "/repo/.artifacts/ci/api-ci-browser.env";
const REDIS_URL = "redis://localhost:6379";
/** The steps that run the analytics consumer, which keeps its own .env. */
const CONSUMER_STEP_IDS = ["e2e:analytics-consumer"];

describe("throwawayDatabaseUrl", () => {
	it("derives a sibling database on the same server, keeping credentials and query", () => {
		expect(throwawayDatabaseUrl("postgresql://u:p@localhost:5432/My-App?schema=public", THROWAWAY_DATABASE_SUFFIX)).toEqual({
			url: "postgresql://u:p@localhost:5432/my_app_ci_local?schema=public",
			database: "my_app_ci_local",
		});
	});

	it("refuses a URL without a database name", () => {
		expect(() => throwawayDatabaseUrl("postgresql://u:p@localhost:5432/", THROWAWAY_DATABASE_SUFFIX)).toThrow(/must name a database/);
	});

	it("keeps the name within Postgres' 63-byte identifier limit", () => {
		const { database } = throwawayDatabaseUrl(`postgresql://u:p@localhost/${"a".repeat(70)}`, THROWAWAY_DATABASE_SUFFIX);
		expect(database.length).toBeLessThanOrEqual(63);
		expect(database.endsWith(THROWAWAY_DATABASE_SUFFIX)).toBe(true);
	});
});

describe("URL helpers", () => {
	it("withDatabaseName swaps only the database", () => {
		expect(withDatabaseName("postgresql://login:secret@db:5432/app?sslmode=disable", "other")).toBe("postgresql://login:secret@db:5432/other?sslmode=disable");
	});

	it("withoutQuery drops Prisma-only query parameters", () => {
		expect(withoutQuery("postgresql://u:p@localhost:5432/app?schema=public")).toBe("postgresql://u:p@localhost:5432/app");
	});
});

describe("plan mirrors .github/workflows/ci.yml", () => {
	it("runs every command the workflow runs", () => {
		const commands = [
			...staticSteps({ base: "origin/main", noCache: false }),
			...databaseSteps({
				databaseUrl: "postgresql://u:p@h/db_ci_local",
				shadowDatabaseUrl: "x",
				consumerLoginUrl: "y",
				runId: "1",
				apiEnvFiles: API_ENV_FILES,
				redisUrl: REDIS_URL,
			}),
		]
			.map((step) => `${step.command} ${step.args.join(" ")}`)
			.map((command) => command.replace(" --working-tree", "").replace(/--base \S+/, "--base"));
		for (const expected of [
			"pnpm turbo run lint",
			"pnpm turbo run typecheck",
			"pnpm turbo run test --concurrency=1",
			"pnpm turbo run build --concurrency=3",
			"pnpm tools bundle:check",
			"pnpm --filter @workspace/api db:check-rls-manifest",
			"pnpm turbo run deps:check",
			"pnpm audit --audit-level=high",
			"node packages/tooling/src/env-example-secrets/cli.ts",
			"node apps/docs/scripts/check-links.ts",
			"pnpm tools db:deploy",
			"pnpm --filter @workspace/api db:check-drift",
			"pnpm --filter @workspace/api db:check-seed-coverage",
			"pnpm --filter @workspace/api test:e2e",
			"pnpm --filter @workspace/api db:check-tenant-integrity",
			"pnpm --filter @workspace/api test:e2e:tenancy",
			"pnpm --filter @workspace/api test:e2e:tenancy:single",
			"pnpm --filter @workspace/api test:e2e:rls",
			"pnpm --filter @workspace/analytics-consumer test:e2e",
		]) {
			expect(commands).toContain(expected);
			expect(WORKFLOW).toContain(expected);
		}
		expect(WORKFLOW).toContain("node packages/tooling/src/migration-history/cli.ts --base");
	});

	it("builds with the workflow's public build env", () => {
		for (const [name, value] of Object.entries(CI_BUILD_ENV)) {
			expect(WORKFLOW).toMatch(new RegExp(`${name}: "?${value}"?`));
		}
	});

	it("runs every step with turbo's TUI off, so no task ever sees a terminal it could prompt on", () => {
		expect(NON_INTERACTIVE_ENV).toEqual({ TURBO_UI: "false" });
	});

	it("passes --force to turbo only with --no-cache", () => {
		expect(staticSteps({ base: "b", noCache: true }).at(0)?.args).toEqual(["turbo", "run", "lint", "--force"]);
		expect(staticSteps({ base: "b", noCache: false }).at(0)?.args).toEqual(["turbo", "run", "lint"]);
	});

	it("points every database step at the throwaway database, and the consumer at its own login", () => {
		const steps = databaseSteps({
			databaseUrl: "postgresql://u:p@h/db_ci_local?schema=public",
			shadowDatabaseUrl: "postgresql://u:p@h/db_ci_local_shadow",
			consumerLoginUrl: "postgresql://c:s@h/db_ci_local",
			runId: "1791005000000",
			apiEnvFiles: API_ENV_FILES,
			redisUrl: REDIS_URL,
		});
		for (const step of steps.filter((candidate) => candidate.env !== undefined)) {
			expect(step.env?.DATABASE_URL).toBe("postgresql://u:p@h/db_ci_local?schema=public");
		}
		expect(steps.find((step) => step.id === "e2e:drift")?.env?.SHADOW_DATABASE_URL).toBe("postgresql://u:p@h/db_ci_local_shadow");
		expect(steps.find((step) => step.id === "e2e:analytics-consumer")?.env).toMatchObject({
			ANALYTICS_CONSUMER_DB_ADMIN_URL: "postgresql://u:p@h/db_ci_local",
			ANALYTICS_CONSUMER_DATABASE_URL: "postgresql://c:s@h/db_ci_local",
		});
	});

	it("isolates the API e2e step's BullMQ keys under a per-run ci-local prefix", () => {
		const steps = databaseSteps({
			databaseUrl: "postgresql://u:p@h/d",
			shadowDatabaseUrl: "s",
			consumerLoginUrl: undefined,
			runId: "1791005000000",
			apiEnvFiles: API_ENV_FILES,
			redisUrl: REDIS_URL,
		});
		expect(steps.find((step) => step.id === "e2e:api")?.env?.E2E_BULLMQ_PREFIX).toBe("ci-local:1791005000000");
	});

	it("audits seed coverage right after the development seed, before the e2e suite writes anything", () => {
		const ids = databaseSteps({
			databaseUrl: "postgresql://u:p@h/d",
			shadowDatabaseUrl: "s",
			consumerLoginUrl: undefined,
			runId: "1",
			apiEnvFiles: API_ENV_FILES,
			redisUrl: REDIS_URL,
		}).map((step) => step.id);
		expect(ids.indexOf("e2e:seed-coverage")).toBe(ids.indexOf("e2e:seed") + 1);
		expect(ids.indexOf("e2e:seed-coverage")).toBeLessThan(ids.indexOf("e2e:api"));
		expect(WORKFLOW.indexOf("db:check-seed-coverage")).toBeGreaterThan(WORKFLOW.indexOf("pnpm db:seed -- --scenario development"));
		expect(WORKFLOW.indexOf("db:check-seed-coverage")).toBeLessThan(WORKFLOW.indexOf("pnpm --filter @workspace/api test:e2e"));
	});

	it("points every API step at CI's generated env, never the developer's apps/api/.env", () => {
		const steps = databaseSteps({
			databaseUrl: "postgresql://u:p@h/d",
			shadowDatabaseUrl: "s",
			consumerLoginUrl: "c",
			runId: "1",
			apiEnvFiles: API_ENV_FILES,
			redisUrl: REDIS_URL,
		});
		const envOf = (id: string): Record<string, string | undefined> => steps.find((step) => step.id === id)?.env ?? {};
		for (const step of steps.filter((candidate) => candidate.env !== undefined && !CONSUMER_STEP_IDS.includes(candidate.id))) {
			expect([API_ENV_FILES.e2e, API_ENV_FILES.single]).toContain(step.env?.DOTENV_PATH);
		}
		for (const id of ["e2e:deploy", "e2e:seed", "e2e:seed-coverage", "e2e:api", "e2e:tenancy", "e2e:rls"]) {
			expect(envOf(id)).toMatchObject({ DOTENV_PATH: API_ENV_FILES.e2e, REDIS_URL });
		}
		// ci.yml's single-tenant job sets no REDIS_URL.
		for (const id of ["e2e:single-tenancy", "e2e:single-rls"]) {
			expect(envOf(id).DOTENV_PATH).toBe(API_ENV_FILES.single);
			expect(envOf(id).REDIS_URL).toBeUndefined();
		}
	});

	it("leaves the analytics consumer on its own .env (Kafka), with only its database settings", () => {
		const steps = databaseSteps({
			databaseUrl: "postgresql://u:p@h/d",
			shadowDatabaseUrl: "s",
			consumerLoginUrl: "c",
			runId: "1",
			apiEnvFiles: API_ENV_FILES,
			redisUrl: REDIS_URL,
		});
		expect(steps.find((step) => step.id === "e2e:analytics-consumer")?.env?.DOTENV_PATH).toBeUndefined();
	});

	it("writes each job's tenancy as the workflow does: multi for e2e, the fixture's Tenant A and the seed tenant in single mode (MT-70)", () => {
		expect(API_CI_TENANCY.e2e).toEqual({ tenancyMode: "multi" });
		expect(WORKFLOW).toContain("tenancy-mode: multi");
		for (const job of [API_CI_TENANCY.single, API_CI_TENANCY.browser]) {
			expect(job.tenancyMode).toBe("single");
			expect(WORKFLOW).toContain(`default-tenant-id: ${job.defaultTenantId ?? ""}`);
		}
	});

	it("omits the consumer suite when no consumer login is configured", () => {
		const steps = databaseSteps({
			databaseUrl: "postgresql://u:p@h/d",
			shadowDatabaseUrl: "s",
			consumerLoginUrl: undefined,
			runId: "1",
			apiEnvFiles: API_ENV_FILES,
			redisUrl: REDIS_URL,
		});
		expect(steps.map((step) => step.id)).not.toContain("e2e:analytics-consumer");
	});
});

describe("browser job mirrors .github/workflows/ci.yml → browser-e2e", () => {
	const job = browserJob({ databaseUrl: "postgresql://u:p@h/db_ci_local_browser?schema=public", apiEnvFile: BROWSER_API_ENV_FILE });
	const all = [...job.setup, ...job.servers, ...job.suites];
	const commandOf = (id: string): string => {
		const step = all.find((candidate) => candidate.id === id);
		return step === undefined ? "" : `${step.command} ${step.args.join(" ")}`;
	};

	it("runs the same build, start and suite commands as the workflow", () => {
		for (const id of ["browser:build", "browser:api", "browser:web", "browser:admin", "browser:web-suite", "browser:admin-suite"]) {
			expect(WORKFLOW).toContain(commandOf(id));
		}
		expect(WORKFLOW).toContain(`node packages/tooling/src/wait-for-http/cli.ts --timeout-ms 120000 ${BROWSER_READINESS_URLS.join(" ")}`);
	});

	it("waits for readiness before any suite runs", () => {
		expect(job.suites.map((step) => step.id)).toEqual(["browser:wait", "browser:web-suite", "browser:admin-suite", "browser:admin-visual-suite", "browser:merchant-suite"]);
	});

	it("gives the suites the workflow's base URLs and seed login", () => {
		for (const [name, value] of Object.entries(BROWSER_SUITE_ENV)) {
			expect(WORKFLOW).toContain(`${name}: ${value}`);
			expect(job.suites.find((step) => step.id === "browser:admin-suite")?.env?.[name]).toBe(value);
		}
	});

	it("builds and serves the admin with the features its suite drives, as the workflow does", () => {
		for (const [name, value] of Object.entries(BROWSER_ADMIN_FEATURE_ENV)) {
			expect(WORKFLOW).toContain(`${name}: "${value}"`);
			expect(job.setup.find((step) => step.id === "browser:build")?.env?.[name]).toBe(value);
			expect(job.servers.find((server) => server.id === "browser:admin")?.env?.[name]).toBe(value);
		}
	});

	it("serves and seeds the API from CI's generated browser env, never the developer's apps/api/.env", () => {
		for (const id of ["browser:deploy", "browser:seed", "browser:api"]) {
			expect(all.find((step) => step.id === id)?.env?.DOTENV_PATH).toBe(BROWSER_API_ENV_FILE);
		}
		expect(API_CI_ENV_ACTION).toContain("node packages/tooling/src/api-ci-env/cli.ts");
	});

	it("binds every server to the port its readiness URL polls, for the port preflight", () => {
		expect(job.servers.map((server) => [server.id, server.port])).toEqual([
			["browser:api", LOCAL_APP_PORTS.api],
			["browser:web", LOCAL_APP_PORTS.web],
			["browser:admin", LOCAL_APP_PORTS.admin],
			["browser:merchant", LOCAL_APP_PORTS.merchant],
		]);
		expect(job.servers.find((server) => server.id === "browser:api")?.env?.PORT).toBe(String(LOCAL_APP_PORTS.api));
		for (const server of job.servers.filter((candidate) => candidate.id !== "browser:api")) {
			expect(server.args.slice(-2)).toEqual(["--port", String(server.port)]);
		}
		expect(BROWSER_READINESS_URLS.map((url) => Number(new URL(url).port))).toEqual(job.servers.map((server) => server.port));
	});

	it("migrates, seeds and serves the API from its own throwaway database", () => {
		for (const id of ["browser:deploy", "browser:seed", "browser:api"]) {
			expect(all.find((step) => step.id === id)?.env?.DATABASE_URL).toBe("postgresql://u:p@h/db_ci_local_browser?schema=public");
		}
	});
});

describe("selectSteps", () => {
	const steps = staticSteps({ base: "origin/main", noCache: false });

	it("keeps only the listed steps, in plan order", () => {
		expect(selectSteps(steps, ["test", "lint"]).map((step) => step.id)).toStrictEqual(["lint", "test"]);
	});

	it("refuses an unknown step id or an empty list instead of running nothing", () => {
		expect(() => selectSteps(steps, ["lint", "unit"])).toThrow(/--only needs step ids from: lint, typecheck, test/);
		expect(() => selectSteps(steps, [])).toThrow(/got: none/);
	});
});

describe("staticSteps errorsOnly", () => {
	it("runs the same turbo commands, showing only failing tasks' logs", () => {
		const quiet = selectSteps(staticSteps({ base: "origin/main", noCache: false, errorsOnly: true }), ["lint", "typecheck", "test"]);

		expect(quiet.map((step) => step.args.join(" "))).toStrictEqual([
			"turbo run lint --output-logs=errors-only",
			"turbo run typecheck --output-logs=errors-only",
			"turbo run test --output-logs=errors-only --concurrency=1",
		]);
	});

	it("leaves the default full logs, and non-turbo steps, untouched", () => {
		const loud = staticSteps({ base: "origin/main", noCache: false });
		const quiet = staticSteps({ base: "origin/main", noCache: false, errorsOnly: true });

		expect(loud.some((step) => step.args.includes("--output-logs=errors-only"))).toBe(false);
		expect(quiet.filter((step) => step.args.at(0) !== "turbo")).toStrictEqual(loud.filter((step) => step.args.at(0) !== "turbo"));
	});
});

describe("the Node.js release", () => {
	const repo = (file: string): string => readFileSync(path.resolve(import.meta.dirname, "../../../../..", file), "utf8");
	const nvmrc = repo(".nvmrc").trim();
	const nodeVersionOf = (workflow: string): string | undefined => /^\s*NODE_VERSION: "(?<version>[^"]+)"/mu.exec(workflow)?.groups?.version;

	it("is the same in .nvmrc, CI, the dependency review, the mobile and load nightlies and the engines floor", () => {
		expect(nvmrc).toMatch(/^\d+\.\d+\.\d+$/u);
		expect(nodeVersionOf(WORKFLOW)).toBe(nvmrc);
		expect(nodeVersionOf(repo(".github/workflows/dependency-review.yml"))).toBe(nvmrc);
		expect(nodeVersionOf(repo(".github/workflows/mobile-nightly.yml"))).toBe(nvmrc);
		expect(nodeVersionOf(repo(".github/workflows/load-nightly.yml"))).toBe(nvmrc);
		expect(packageManifest(repo("package.json")).engines?.node).toBe(`>=${nvmrc}`);
	});

	it("is the one EAS builds the mobile app with, with the repository's own pnpm (EAS's image default is older: the install refused it)", () => {
		const eas = easConfig(repo("apps/mobile/eas.json"));
		const pnpmVersion = /^pnpm@(?<version>\d+\.\d+\.\d+)$/u.exec(packageManifest(repo("package.json")).packageManager ?? "")?.groups?.version;
		expect(eas.build.base).toMatchObject({ node: nvmrc, pnpm: pnpmVersion });
		// Every other profile builds on the base, so none can run on a different Node or pnpm.
		for (const [name, profile] of Object.entries(eas.build)) {
			expect({ name, extends: name === "base" ? "base" : profile.extends }).toStrictEqual({ name, extends: "base" });
		}
	});

	it("gives every EAS build profile its own EAS environment, so the build reads that environment's variables (GOOGLE_SERVICES_JSON among them)", () => {
		const eas = easConfig(repo("apps/mobile/eas.json"));
		const profiles = Object.fromEntries(Object.entries(eas.build).filter(([name]) => name !== "base"));
		expect(Object.entries(profiles).map(([name, profile]) => [name, profile.environment])).toStrictEqual([
			["development", "development"],
			["preview", "preview"],
			["production", "production"],
		]);
	});

	it("bakes the demo logins into development and preview builds and keeps them out of production (EAS never sees .env; ADR 042)", () => {
		const eas = easConfig(repo("apps/mobile/eas.json"));
		const profiles = Object.fromEntries(Object.entries(eas.build).filter(([name]) => name !== "base"));
		expect(Object.entries(profiles).map(([name, profile]) => [name, profile.env?.EXPO_PUBLIC_SHOW_DEMO_ACCOUNT])).toStrictEqual([
			["development", "true"],
			["preview", "true"],
			["production", "false"],
		]);
	});

	it("lets development and preview builds reach the API on the Mac over LAN http, as `.env` does locally (else EAS's runtime version differs from the Mac's), and never production", () => {
		const eas = easConfig(repo("apps/mobile/eas.json"));
		const profiles = Object.fromEntries(Object.entries(eas.build).filter(([name]) => name !== "base"));
		expect(Object.entries(profiles).map(([name, profile]) => [name, profile.env?.EXPO_PUBLIC_ALLOW_LAN_HTTP_API])).toStrictEqual([
			["development", "true"],
			["preview", "true"],
			["production", undefined],
		]);
	});
});
