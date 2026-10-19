import { describe, expect, it } from "vitest";

import { EXIT_FAILED, EXIT_OK, formatUsage, runCli, type CliCommand, type CliOutput } from "../cli";

interface CapturedLines {
	readonly out: string[];
	readonly err: string[];
}

/** Captures what a run writes. */
function capture(): CliOutput & { readonly lines: CapturedLines } {
	const lines: CapturedLines = { out: [], err: [] };
	return {
		lines,
		out: (line: string): void => {
			lines.out.push(line);
		},
		err: (line: string): void => {
			lines.err.push(line);
		},
	};
}

const EXIT_DRIFT = 2;

function commands(seen: string[][]): ReadonlyMap<string, CliCommand> {
	return new Map<string, CliCommand>([
		[
			"check",
			{
				summary: "Check something",
				run: (args: readonly string[]): number => {
					seen.push([...args]);
					return EXIT_DRIFT;
				},
			},
		],
		["apply-everything", { summary: "Apply it all", run: async (): Promise<number> => Promise.resolve(EXIT_OK) }],
		[
			"explode",
			{
				summary: "Throws",
				run: (): number => {
					throw new Error("boom");
				},
			},
		],
	]);
}

describe("formatUsage", () => {
	it("lists every command with its summary, aligned", () => {
		expect(formatUsage("db", commands([]))).toBe(
			["Usage: db <command> [options]", "", "Commands:", "  check             Check something", "  apply-everything  Apply it all", "  explode           Throws"].join("\n"),
		);
	});
});

describe("runCli", () => {
	it("runs the named command with the remaining arguments and returns its exit code", async () => {
		const seen: string[][] = [];

		await expect(runCli("db", commands(seen), ["check", "--strict", "x"], capture())).resolves.toBe(EXIT_DRIFT);
		await expect(runCli("db", commands(seen), ["apply-everything"], capture())).resolves.toBe(EXIT_OK);
		expect(seen).toEqual([["--strict", "x"]]);
	});

	it("prints the usage and fails without a command, or with an unknown one", async () => {
		const missing = capture();
		const unknown = capture();

		await expect(runCli("db", commands([]), [], missing)).resolves.toBe(EXIT_FAILED);
		await expect(runCli("db", commands([]), ["chek"], unknown)).resolves.toBe(EXIT_FAILED);
		expect(missing.lines.err.join("\n")).toContain("Usage: db <command>");
		expect(unknown.lines.err.join("\n")).toContain('Unknown command "chek".');
	});

	it("prints the usage and succeeds on --help", async () => {
		const output = capture();

		await expect(runCli("db", commands([]), ["--help"], output)).resolves.toBe(EXIT_OK);
		expect(output.lines.err.join("\n")).toContain("Commands:");
	});

	it("reports a command that throws and fails", async () => {
		const output = capture();

		await expect(runCli("db", commands([]), ["explode"], output)).resolves.toBe(EXIT_FAILED);
		expect(output.lines.err).toEqual(["db explode: boom"]);
	});
});
