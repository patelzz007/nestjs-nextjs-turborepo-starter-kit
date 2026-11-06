// src/tools/cli.ts: the occasional commands, behind one `pnpm tools` entry.
//
// The root package.json keeps only what a developer runs every day (setup, dev,
// lint, test, the everyday database commands). Everything else, used now and
// then or only by CI, lives here: `pnpm tools` lists it, grouped and described,
// and `pnpm tools <name> [args…]` runs it. The commands are the ones the root
// package.json used to hold, unchanged.

import { spawnSync } from "node:child_process";

import { toolingConfig } from "../../../../tooling.config.ts";

/** The exit code of a run that could not start, or named no known tool. */
export const FAILED_TO_RUN = 1;

export interface Tool {
	/** The name after `pnpm tools`. */
	readonly name: string;
	/** The heading it is listed under. */
	readonly group: string;
	/** One line: what it does and when to use it. */
	readonly description: string;
	/** The shell command it runs from the repository root. */
	readonly command: string;
}

export const TOOLS: readonly Tool[] = toolingConfig.tools;

/** The tool named `name`. */

export function findTool(tools: readonly Tool[], name: string | undefined): Tool | undefined {
	return tools.find((tool) => tool.name === name);
}

/** The menu `pnpm tools` prints: every tool under its group, in order. */

export function formatToolMenu(tools: readonly Tool[]): string {
	const width = Math.max(...tools.map((tool) => tool.name.length));
	const lines: string[] = ["Usage: pnpm tools <name> [args…]", ""];
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
 */

export function toolArguments(args: readonly string[]): readonly string[] {
	const [first, ...rest] = args;
	return first === "--" ? rest : args;
}

/**
 * `pnpm tools [name] [args…]`: lists the tools, or runs one from `repoRoot`
 * through `sh` with `args` appended, and returns its exit code.
 * @param argv `[name, ...args]`
 */

export function runTool(
	repoRoot: string,
	argv: readonly string[],
	{
		tools = TOOLS,
		spawn = spawnSync,
		print = (text: string): void => {
			process.stdout.write(`${text}\n`);
		},
	}: { readonly tools?: readonly Tool[]; readonly spawn?: typeof spawnSync; readonly print?: (text: string) => void } = {},
): number {
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
