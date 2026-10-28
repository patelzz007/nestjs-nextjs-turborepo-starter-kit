// scripts/tools.mjs: the occasional commands, behind one `pnpm tools` entry.
//
// The root package.json keeps only what a developer runs every day (setup, dev,
// lint, test, the everyday database commands). Everything else, used now and
// then or only by CI, lives here: `pnpm tools` lists it, grouped and described,
// and `pnpm tools <name> [args…]` runs it. The commands are the ones the root
// package.json used to hold, unchanged.

import { spawnSync } from "node:child_process";

/** The exit code of a run that could not start, or named no known tool. */
export const FAILED_TO_RUN = 1;

/**
 * @typedef {object} Tool
 * @property {string} name The name after `pnpm tools`.
 * @property {string} group The heading it is listed under.
 * @property {string} description One line: what it does and when to use it.
 * @property {string} command The shell command it runs from the repository root.
 */

/** @type {readonly Tool[]} */
export const TOOLS = [
	// Database
	{
		name: "db:deploy",
		group: "Database",
		description: "Apply pending migrations and the RLS policies, without prompts (CI, deploys).",
		command: "pnpm --filter @workspace/api db:deploy",
	},
	{ name: "db:migrate:status", group: "Database", description: "Show which migrations are applied.", command: "pnpm --filter @workspace/api db:migrate:status" },
	{ name: "db:push", group: "Database", description: "Push the schema without a migration (throwaway databases only).", command: "pnpm --filter @workspace/api db:push" },
	{
		name: "db:apply-security",
		group: "Database",
		description: "Re-apply the RLS policies and grants (db:migrate already does this).",
		command: "pnpm --filter @workspace/api db:apply-security",
	},
	{
		name: "db:check-rls-manifest",
		group: "Database",
		description: "Check every tenant table is covered by an RLS policy.",
		command: "pnpm --filter @workspace/api db:check-rls-manifest",
	},
	{
		name: "db:check-tenant-integrity",
		group: "Database",
		description: "Check no row points at another tenant's data.",
		command: "pnpm --filter @workspace/api db:check-tenant-integrity",
	},
	{
		name: "db:carry-github-link",
		group: "Database",
		description: "Copy your GitHub link from one local database to another.",
		command: "pnpm --filter @workspace/api db:carry-github-link",
	},
	// Development
	{
		name: "dev:analytics-consumer",
		group: "Development",
		description: "Run the analytics consumer (needs Kafka: pnpm docker:up).",
		command: "turbo dev --filter @workspace/analytics-consumer --log-prefix=none",
	},
	{
		name: "dev:tunnel",
		group: "Development",
		description: "Open a public tunnel to the local API (webhooks, phones).",
		command: "pnpm --silent --filter @workspace/api dev:tunnel",
	},
	{ name: "dev:timing", group: "Development", description: "Measure how long each dev server takes to be ready.", command: "node packages/tooling/src/dev-timing/cli.mjs" },
	{ name: "docker:restart", group: "Development", description: "Restart the local containers.", command: "docker compose down && docker compose up -d" },
	{ name: "docker:logs", group: "Development", description: "Follow the local containers' logs.", command: "docker compose logs -f" },
	{ name: "docker:ps", group: "Development", description: "List the local containers.", command: "docker compose ps" },
	// Build and generate
	{ name: "build:shared", group: "Build and generate", description: "Build @workspace/shared (setup does this).", command: "pnpm --filter @workspace/shared build" },
	{
		name: "tokens:generate",
		group: "Build and generate",
		description: "Regenerate the theme CSS, icons and brand assets from @workspace/tokens.",
		command: "pnpm --filter @workspace/tokens generate",
	},
	{
		name: "openapi:export",
		group: "Build and generate",
		description: "Rewrite the committed OpenAPI document from the API.",
		command: "turbo run openapi:export --filter=@workspace/api",
	},
	{ name: "docs:api", group: "Build and generate", description: "Regenerate the docs site's API reference.", command: "pnpm --filter @workspace/docs docs:api" },
	{
		name: "secrets:generate",
		group: "Build and generate",
		description: "Generate fresh local app secrets into the .env files.",
		command: "node packages/tooling/scripts/generate-app-secrets.mjs",
	},
	// Checks
	{
		name: "bundle:check",
		group: "Checks",
		description: "Check the app bundles against their size budgets (after a build).",
		command: "node packages/tooling/src/bundle-budget/cli.mjs",
	},
	{ name: "deps:check", group: "Checks", description: "Check every workspace uses the same dependency versions.", command: "turbo run deps:check" },
	{ name: "deps:fix", group: "Checks", description: "Align mismatched dependency versions.", command: "turbo run deps:fix" },
	{ name: "deps:list", group: "Checks", description: "List every dependency and its versions.", command: "turbo run deps:list" },
	{ name: "docs:check-links", group: "Checks", description: "Check every internal link in docs/.", command: "pnpm --filter @workspace/docs check:links" },
	{ name: "secrets:scan", group: "Checks", description: "Check no .env.example holds a real secret.", command: "node packages/tooling/scripts/check-env-example-secrets.mjs" },
];

/**
 * The tool named `name`.
 *
 * @param {readonly Tool[]} tools
 * @param {string | undefined} name
 * @returns {Tool | undefined}
 */
export function findTool(tools, name) {
	return tools.find((tool) => tool.name === name);
}

/**
 * The menu `pnpm tools` prints: every tool under its group, in order.
 *
 * @param {readonly Tool[]} tools
 * @returns {string}
 */
export function formatToolMenu(tools) {
	const width = Math.max(...tools.map((tool) => tool.name.length));
	/** @type {string[]} */
	const lines = ["Usage: pnpm tools <name> [args…]", ""];
	for (const group of [...new Set(tools.map((tool) => tool.group))]) {
		lines.push(group);
		for (const tool of tools.filter((candidate) => candidate.group === group)) {
			lines.push(`  ${tool.name.padEnd(width)}  ${tool.description}`);
		}
		lines.push("");
	}
	return lines.join("\n");
}

/**
 * The arguments to hand on, without the `--` separator pnpm may pass through
 * (`pnpm tools db:deploy -- --flag`).
 *
 * @param {readonly string[]} args
 * @returns {readonly string[]}
 */
export function toolArguments(args) {
	const [first, ...rest] = args;
	return first === "--" ? rest : args;
}

/**
 * `pnpm tools [name] [args…]`: lists the tools, or runs one from `repoRoot`
 * through `sh` with `args` appended, and returns its exit code.
 *
 * @param {string} repoRoot
 * @param {readonly string[]} argv `[name, ...args]`
 * @param {{ readonly tools?: readonly Tool[], readonly spawn?: typeof spawnSync, readonly print?: (text: string) => void }} [options]
 * @returns {number}
 */
export function runTool(repoRoot, argv, { tools = TOOLS, spawn = spawnSync, print = console.log } = {}) {
	const [name, ...args] = argv;
	if (name === undefined || name === "--help" || name === "-h") {
		print(formatToolMenu(tools));
		return 0;
	}
	const tool = findTool(tools, name);
	if (tool === undefined) {
		print(`Unknown tool "${name}".\n`);
		print(formatToolMenu(tools));
		return FAILED_TO_RUN;
	}
	const handedOn = toolArguments(args);
	// The arguments land in "$@" (`$0` is the tool's name), so the shell never re-parses them.
	const script = handedOn.length === 0 ? tool.command : `${tool.command} "$@"`;
	const result = spawn("sh", ["-c", script, tool.name, ...handedOn], { cwd: repoRoot, stdio: "inherit" });
	if (result.error !== undefined) {
		print(`could not run ${tool.name}: ${result.error.message}`);
		return FAILED_TO_RUN;
	}
	return result.status ?? FAILED_TO_RUN;
}
