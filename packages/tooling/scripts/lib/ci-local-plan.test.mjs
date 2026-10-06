import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
	BROWSER_READINESS_URLS,
	LOCAL_APP_PORTS,
	BROWSER_SUITE_ENV,
	browserJob,
	CI_BUILD_ENV,
	databaseSteps,
	staticSteps,
	THROWAWAY_DATABASE_SUFFIX,
	throwawayDatabaseUrl,
	withDatabaseName,
	withoutQuery,
} from "./ci-local-plan.mjs";

const WORKFLOW = readFileSync(path.resolve(import.meta.dirname, "../../../../.github/workflows/ci.yml"), "utf8");

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
			...databaseSteps({ databaseUrl: "postgresql://u:p@h/db_ci_local", shadowDatabaseUrl: "x", consumerLoginUrl: "y", runId: "1" }),
		]
			.map((step) => `${step.command} ${step.args.join(" ")}`)
			.map((command) => command.replace(" --working-tree", "").replace(/--base \S+/, "--base"));
		for (const expected of [
			"pnpm turbo run lint",
			"pnpm turbo run typecheck",
			"pnpm turbo run test",
			"pnpm turbo run build",
			"pnpm --filter @workspace/api db:check-rls-manifest",
			"pnpm turbo run deps:check",
			"pnpm audit --audit-level=high",
			"node packages/tooling/scripts/check-env-example-secrets.mjs",
			"node apps/docs/scripts/check-links.mjs",
			"pnpm db:deploy",
			"pnpm --filter @workspace/api db:check-drift",
			"pnpm --filter @workspace/api db:check-seed-coverage",
			"pnpm --filter @workspace/api test:e2e",
			"pnpm --filter @workspace/analytics-consumer test:e2e",
		]) {
			expect(commands).toContain(expected);
			expect(WORKFLOW).toContain(expected);
		}
		expect(WORKFLOW).toContain("node packages/tooling/scripts/check-migration-history.mjs --base");
	});

	it("builds with the workflow's public build env", () => {
		for (const [name, value] of Object.entries(CI_BUILD_ENV)) {
			expect(WORKFLOW).toMatch(new RegExp(`${name}: "?${value}"?`));
		}
	});

	it("passes --force to turbo only with --no-cache", () => {
		expect(staticSteps({ base: "b", noCache: true })[0]?.args).toEqual(["turbo", "run", "lint", "--force"]);
		expect(staticSteps({ base: "b", noCache: false })[0]?.args).toEqual(["turbo", "run", "lint"]);
	});

	it("points every database step at the throwaway database, and the consumer at its own login", () => {
		const steps = databaseSteps({
			databaseUrl: "postgresql://u:p@h/db_ci_local?schema=public",
			shadowDatabaseUrl: "postgresql://u:p@h/db_ci_local_shadow",
			consumerLoginUrl: "postgresql://c:s@h/db_ci_local",
			runId: "1791005000000",
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
		const steps = databaseSteps({ databaseUrl: "postgresql://u:p@h/d", shadowDatabaseUrl: "s", consumerLoginUrl: undefined, runId: "1791005000000" });
		expect(steps.find((step) => step.id === "e2e:api")?.env?.E2E_BULLMQ_PREFIX).toBe("ci-local:1791005000000");
	});

	it("audits seed coverage right after the development seed, before the e2e suite writes anything", () => {
		const ids = databaseSteps({ databaseUrl: "postgresql://u:p@h/d", shadowDatabaseUrl: "s", consumerLoginUrl: undefined, runId: "1" }).map((step) => step.id);
		expect(ids.indexOf("e2e:seed-coverage")).toBe(ids.indexOf("e2e:seed") + 1);
		expect(ids.indexOf("e2e:seed-coverage")).toBeLessThan(ids.indexOf("e2e:api"));
		expect(WORKFLOW.indexOf("db:check-seed-coverage")).toBeGreaterThan(WORKFLOW.indexOf("pnpm db:seed -- --scenario development"));
		expect(WORKFLOW.indexOf("db:check-seed-coverage")).toBeLessThan(WORKFLOW.indexOf("pnpm --filter @workspace/api test:e2e"));
	});

	it("omits the consumer suite when no consumer login is configured", () => {
		const steps = databaseSteps({ databaseUrl: "postgresql://u:p@h/d", shadowDatabaseUrl: "s", consumerLoginUrl: undefined, runId: "1" });
		expect(steps.map((step) => step.id)).not.toContain("e2e:analytics-consumer");
	});
});

describe("browser job mirrors .github/workflows/ci.yml → browser-e2e", () => {
	const job = browserJob({ databaseUrl: "postgresql://u:p@h/db_ci_local_browser?schema=public" });
	const all = [...job.setup, ...job.servers, ...job.suites];
	const commandOf = (id) => {
		const step = all.find((candidate) => candidate.id === id);
		return step === undefined ? "" : `${step.command} ${step.args.join(" ")}`;
	};

	it("runs the same build, start and suite commands as the workflow", () => {
		for (const id of ["browser:build", "browser:api", "browser:web", "browser:admin", "browser:web-suite", "browser:admin-suite"]) {
			expect(WORKFLOW).toContain(commandOf(id));
		}
		expect(WORKFLOW).toContain(`node packages/tooling/scripts/wait-for-http.mjs --timeout-ms 120000 ${BROWSER_READINESS_URLS.join(" ")}`);
	});

	it("waits for readiness before any suite runs", () => {
		expect(job.suites.map((step) => step.id)).toEqual(["browser:wait", "browser:web-suite", "browser:admin-suite"]);
	});

	it("gives the suites the workflow's base URLs and seed login", () => {
		for (const [name, value] of Object.entries(BROWSER_SUITE_ENV)) {
			expect(WORKFLOW).toContain(`${name}: ${value}`);
			expect(job.suites.find((step) => step.id === "browser:admin-suite")?.env?.[name]).toBe(value);
		}
	});

	it("binds every server to the port its readiness URL polls, for the port preflight", () => {
		expect(job.servers.map((server) => [server.id, server.port])).toEqual([
			["browser:api", LOCAL_APP_PORTS.api],
			["browser:web", LOCAL_APP_PORTS.web],
			["browser:admin", LOCAL_APP_PORTS.admin],
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
