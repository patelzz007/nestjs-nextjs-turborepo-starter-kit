// Enhancement 7.9: `ci:local` stays honest automatically. Every command every job of .github/workflows/ci.yml
// runs must have a twin in ci:local's plan (or be on CI_ONLY below, with the reason it can't), and every step
// of the plan must be in CI (or on LOCAL_ONLY). Step and job environment names are compared too. A new CI step
// with no local twin, or a twin that drifts, fails here instead of letting ci:local pass while CI fails.

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { browserJob, databaseSteps, staticSteps } from "../ci-local-plan.mjs";

const WORKFLOW = parse(readFileSync(path.resolve(import.meta.dirname, "../../../../../.github/workflows/ci.yml"), "utf8"));

/**
 * CI commands that have no step of their own in the plan, each with why. When one changes, this list must be
 * revisited: the reason is the review.
 */
const CI_ONLY = new Map([
	["mkdir -p .ci-logs", "ci-local.mjs creates its own log directory before starting the servers"],
	[
		'psql --host localhost --username postgres --dbname app_ci --command "CREATE DATABASE app_ci_shadow"',
		"ci-local.mjs creates and drops its throwaway shadow database itself",
	],
	['password="$(openssl rand -hex 24)"', "the consumer's least-privilege login: ci-local.mjs generates its own random password"],
	['echo "::add-mask::${password}"', "GitHub log masking; there are no shared logs locally"],
	[
		'node packages/tooling/scripts/ci-changes.mjs --event "$GITHUB_EVENT_NAME" --base <base> --output "$GITHUB_OUTPUT"',
		"CI's `changes` job lets a documentation-only pull request skip the code jobs; ci:local always runs every job",
	],
	[
		'echo "ANALYTICS_CONSUMER_DATABASE_URL=postgresql://analytics_consumer_app:${password}@localhost:5432/app_ci" >> "$GITHUB_ENV"',
		"ci-local.mjs passes the consumer's login URL to the step directly",
	],
]);

/** CI commands whose local twin differs on purpose: CI command → [local command, reason]. */
const DIFFERENT_TWINS = new Map([
	[
		"pnpm --filter @workspace/admin test:visual",
		[
			"pnpm --filter @workspace/admin test:visual:docker",
			"the committed screenshots are Linux's, CI's renderer: on a developer's Mac the suite runs in Playwright's Linux image to compare like with like",
		],
	],
	[
		"pnpm turbo run test --concurrency=1 ${{ matrix.filters }}",
		[
			"pnpm turbo run test --concurrency=1",
			"CI splits the unit tests over several runners (ci-test-shards.test.mjs proves the shards cover every workspace); one machine runs them all in one step",
		],
	],
	[
		"pnpm exec playwright install --with-deps chromium",
		["pnpm exec playwright install chromium", "the runner needs Chromium's OS libraries installed; a developer machine already has them"],
	],
]);

/** Variables CI sets that reach the local twin another way, each with how. */
const ENV_FROM_ELSEWHERE = new Map([
	["BASE_REF", "the migration check's base ref travels as its `--base` argument"],
	["PGPASSWORD", "only CI's own psql call (creating the shadow database) reads it"],
	["KAFKA_BROKERS", "the consumer reads its own apps/analytics-consumer/.env locally (the developer's Kafka)"],
]);

/** Plan steps CI has no command for, each with why. */
const LOCAL_ONLY = new Map();

/** One CI `run:` block as the commands it runs, one per line, backgrounding and log redirection removed. */
function commandsOf(run) {
	return run
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith("#"))
		.map((line) =>
			line
				.replace(/^nohup /u, "")
				.replace(/ > \S+ 2>&1 &$/u, "")
				.replace(/--base "\$BASE_REF"/u, "--base <base>"),
		);
}

function localCommand(step) {
	return `${step.command} ${step.args.join(" ")}`.replace(/--base \S+ --working-tree/u, "--base <base>");
}

const planSteps = (() => {
	const browser = browserJob({ databaseUrl: "postgresql://u:p@h/db_ci_local_browser", apiEnvFile: "/repo/.ci-logs/api-ci-browser.env" });
	return [
		...staticSteps({ base: "origin/main", noCache: false }),
		...databaseSteps({
			databaseUrl: "postgresql://u:p@h/db_ci_local",
			shadowDatabaseUrl: "postgresql://u:p@h/db_ci_local_shadow",
			consumerLoginUrl: "postgresql://c:s@h/db_ci_local",
			runId: "1",
			apiEnvFiles: { e2e: "/repo/.ci-logs/api-ci-e2e.env", single: "/repo/.ci-logs/api-ci-single.env" },
			redisUrl: "redis://localhost:6379",
		}),
		...browser.setup,
		...browser.servers,
		...browser.suites,
	];
})();

/** Every `run:` step of every job: its job id, its commands, and the env names its job and step set. */
const ciSteps = Object.entries(WORKFLOW.jobs).flatMap(([jobId, job]) =>
	(job.steps ?? [])
		.filter((step) => typeof step.run === "string")
		.map((step) => ({ jobId, name: step.name ?? "", commands: commandsOf(step.run), envNames: [...Object.keys(job.env ?? {}), ...Object.keys(step.env ?? {})] })),
);

describe("ci:local mirrors every step of .github/workflows/ci.yml", () => {
	const local = new Map(planSteps.map((step) => [localCommand(step), step]));

	it("has a local twin for every command CI runs (or a stated reason it can't)", () => {
		const missing = ciSteps.flatMap((step) =>
			step.commands
				.filter((command) => {
					if (CI_ONLY.has(command)) return false;
					const twin = DIFFERENT_TWINS.get(command)?.[0] ?? command;
					return !local.has(twin);
				})
				.map((command) => `${step.jobId} › ${step.name}: ${command}`),
		);
		expect(missing).toStrictEqual([]);
	});

	it("runs nothing CI doesn't (or says why)", () => {
		const ciCommands = new Set(ciSteps.flatMap((step) => step.commands.map((command) => DIFFERENT_TWINS.get(command)?.[0] ?? command)));
		const extra = planSteps.map(localCommand).filter((command) => !ciCommands.has(command) && !LOCAL_ONLY.has(command));
		expect(extra).toStrictEqual([]);
	});

	it("sets every variable CI sets: a step's own on its twin, a job's somewhere in that job's local steps", () => {
		const envOf = (step) => new Set([...Object.keys(step.env ?? {}), ...expectedFromEnvFile(step)]);
		const twinOf = (command) => local.get(DIFFERENT_TWINS.get(command)?.[0] ?? command);
		const drift = Object.entries(WORKFLOW.jobs).flatMap(([jobId, job]) => {
			const steps = (job.steps ?? []).filter((step) => typeof step.run === "string");
			const twins = steps.flatMap((step) => commandsOf(step.run).map(twinOf)).filter((twin) => twin !== undefined);
			const jobLocal = new Set(twins.flatMap((twin) => [...envOf(twin)]));
			const jobDrift = Object.keys(job.env ?? {})
				.filter((name) => !jobLocal.has(name) && !ENV_FROM_ELSEWHERE.has(name))
				.map((name) => `${jobId} (job env): ${name}`);
			const stepDrift = steps.flatMap((step) =>
				Object.keys(step.env ?? {})
					.filter((name) => !ENV_FROM_ELSEWHERE.has(name))
					.flatMap((name) =>
						commandsOf(step.run)
							.map(twinOf)
							.filter((twin) => twin !== undefined && !envOf(twin).has(name))
							.map((twin) => `${jobId} › ${localCommand(twin)}: ${name}`),
					),
			);
			return [...jobDrift, ...stepDrift];
		});
		expect(drift).toStrictEqual([]);
	});

	it("keeps every stated exception still needed (a stale reason fails too)", () => {
		const ciCommands = new Set(ciSteps.flatMap((step) => step.commands));
		expect([...CI_ONLY.keys(), ...DIFFERENT_TWINS.keys()].filter((command) => !ciCommands.has(command))).toStrictEqual([]);
	});
});

/** Variables a step gets from CI's generated API env file (`DOTENV_PATH`), not its own env block. */
function expectedFromEnvFile(step) {
	return step.env?.DOTENV_PATH === undefined ? [] : ["DATABASE_URL", "REDIS_URL"];
}
