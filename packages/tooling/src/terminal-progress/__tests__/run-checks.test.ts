import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProgressStream } from "../live-region.ts";
import { failureLog, runChecks, terminalStream, type LiveCheck } from "../run-checks.ts";

function nodeCheck(id: string, script: string): LiveCheck {
	return { id, label: id, command: process.execPath, args: ["-e", script] };
}

function recording(isTTY: boolean, colours = false): ProgressStream & { readonly text: () => string } {
	const chunks: string[] = [];
	return {
		isTTY,
		columns: 80,
		hasColors: () => colours,
		write: (text: string): boolean => {
			chunks.push(text);
			return true;
		},
		text: () => chunks.join(""),
	};
}

describe("runChecks", () => {
	let folder: string;

	beforeEach(() => {
		folder = mkdtempSync(path.join(tmpdir(), "run-checks-"));
	});

	afterEach(() => {
		rmSync(folder, { recursive: true, force: true });
	});

	function run(checks: readonly LiveCheck[], stream: ProgressStream, nextStep?: string): Promise<boolean> {
		return runChecks({
			title: "Title",
			subtitle: "Subtitle",
			checks,
			cwd: folder,
			stream,
			logFile: path.join(folder, "logs/hook.log"),
			...(nextStep === undefined ? {} : { nextStep }),
		});
	}

	it("passes on exit codes of 0, and says what happens next", async () => {
		const stream = recording(false);

		await expect(run([nodeCheck("one", "console.log('hello')")], stream, "Pushing to GitHub…")).resolves.toBe(true);
		expect(stream.text()).toContain("✓ one");
		expect(stream.text()).toContain("All clear");
		expect(stream.text()).toContain("→ Pushing to GitHub…");
	});

	it("fails on a non-zero exit code whatever the output says, and still runs the next check", async () => {
		const stream = recording(false);
		const checks = [nodeCheck("broken", "console.log('✓ all good'); process.exit(3)"), nodeCheck("after", "console.log('ran')")];

		await expect(run(checks, stream)).resolves.toBe(false);
		expect(stream.text()).toContain("✗ broken");
		expect(stream.text()).toContain("✓ after");
		expect(stream.text()).toContain("Stopped: broken failed");
		expect(stream.text()).not.toContain("All clear");
	});

	it("fails when the command cannot start", async () => {
		await expect(run([{ id: "missing", label: "missing", command: "/no/such/command", args: [] }], recording(false))).resolves.toBe(false);
	});

	it("keeps the whole output in the log file", async () => {
		await run([nodeCheck("one", "console.log('kept'); console.error('kept too')")], recording(false));

		expect(readFileSync(path.join(folder, "logs/hook.log"), "utf8")).toContain("kept too");
	});

	it("redraws in a terminal and gives the cursor back", async () => {
		const stream = recording(true);

		await run([nodeCheck("one", "")], stream);
		expect(stream.text()).toContain("\u001B[?25l");
		expect(stream.text()).toContain("\u001B[?25h");
	});

	it("colours a terminal that supports it, and leaves one that doesn't plain", async () => {
		const colours = recording(true, true);
		const plain = recording(true, false);

		await run([nodeCheck("one", "")], colours);
		await run([nodeCheck("one", "")], plain);
		expect(colours.text()).toContain("\u001B[32m✓\u001B[39m");
		expect(plain.text()).not.toContain("\u001B[32m");
	});

	it("gives the cursor back when Ctrl+C stops the run", async () => {
		const exit = vi.spyOn(process, "exit").mockImplementation(() => {
			throw new Error("exited");
		});
		const stream = recording(true);
		const running = run([nodeCheck("one", "setTimeout(() => {}, 300)")], stream);

		expect(() => process.emit("SIGINT")).toThrow("exited");
		await running;
		expect(exit).toHaveBeenCalledWith(1);
		expect(stream.text()).toContain("\u001B[?25h");
		exit.mockRestore();
	});

	it("prints no control codes where nobody can see them redraw", async () => {
		const stream = recording(false);

		await run([nodeCheck("one", "")], stream);
		expect(stream.text()).not.toContain("\u001B");
	});
});

describe("terminalStream", () => {
	it("is a stream the display can write to", () => {
		expect(terminalStream()).toHaveProperty("write");
	});
});

describe("failureLog", () => {
	it("prints only the tasks turbo says failed", () => {
		const lines = ["@workspace/api:test: fine", "@workspace/ui:test: broken", "  Failed:    @workspace/ui#test"];

		expect(failureLog(lines)).toStrictEqual(["@workspace/ui:test: broken"]);
	});

	it("cuts a line as long as lint-staged's echoed command, so the error beneath it stays readable", () => {
		const [echoed, error] = failureLog([`oxlint ${"src/file.ts ".repeat(500)}`, "src/a.ts:1:1: error"]);

		expect(echoed?.length).toBeLessThan(400);
		expect(error).toBe("src/a.ts:1:1: error");
	});

	it("prints everything when no task is named, as with lint-staged", () => {
		expect(failureLog(["oxlint found a problem"])).toStrictEqual(["oxlint found a problem"]);
	});
});
