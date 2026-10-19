// The subcommand runner behind `scripts/db.ts` and `scripts/dev.ts`: one entry
// file per area, one named command per job (`tsx scripts/db.ts check-drift`).

import { CaughtValueSchema } from "@workspace/shared";

import { readCaughtErrorMessage } from "../../src/platform/infrastructure/utils/caught-error";

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;

/** One subcommand: a one-line summary for the usage text, and what it runs (returns or resolves to the exit code). */
export interface CliCommand {
	readonly summary: string;
	readonly run: (args: readonly string[]) => number | Promise<number>;
}

/** Where a CLI writes: normal output and diagnostics. */
export interface CliOutput {
	readonly out: (line: string) => void;
	readonly err: (line: string) => void;
}

export const PROCESS_OUTPUT: CliOutput = {
	out: (line: string): void => {
		process.stdout.write(`${line}\n`);
	},
	err: (line: string): void => {
		process.stderr.write(`${line}\n`);
	},
};

/** The usage text: the program, then each command with its summary, aligned. */
export function formatUsage(program: string, commands: ReadonlyMap<string, CliCommand>): string {
	const width = Math.max(...[...commands.keys()].map((name: string): number => name.length));
	const lines = [...commands.entries()].map(([name, command]): string => `  ${name.padEnd(width)}  ${command.summary}`);
	return [`Usage: ${program} <command> [options]`, "", "Commands:", ...lines].join("\n");
}

/**
 * Runs the command `argv` names (its first element) with the rest as its arguments. An unknown or
 * missing command prints the usage and fails; a command that throws prints the error and fails.
 */
export async function runCli(program: string, commands: ReadonlyMap<string, CliCommand>, argv: readonly string[], output: CliOutput = PROCESS_OUTPUT): Promise<number> {
	const [name, ...args] = argv;
	if (name === undefined || name === "--help") {
		output.err(formatUsage(program, commands));
		return name === undefined ? EXIT_FAILED : EXIT_OK;
	}
	const command = commands.get(name);
	if (command === undefined) {
		output.err(`Unknown command "${name}".\n\n${formatUsage(program, commands)}`);
		return EXIT_FAILED;
	}
	try {
		return await command.run(args);
	} catch (error: unknown) {
		output.err(`${program} ${name}: ${readCaughtErrorMessage(CaughtValueSchema.parse(error))}`);
		return EXIT_FAILED;
	}
}
