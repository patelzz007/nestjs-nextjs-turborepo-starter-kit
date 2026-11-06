import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ChangeSummary } from "../change-summary.ts";
import type { KeyboardOpener, KeyName } from "../keyboard.ts";
import { failureLog, runChecks, terminalStream, toLogLine, type LiveCheck } from "../run-checks.ts";
import type { ProgressStream } from "../screen.ts";

const CHANGES: ChangeSummary = { headline: "main → origin/main · 1 commit", commits: [], files: [] };
const NO_KEYBOARD: KeyboardOpener = () => undefined;
/** Long enough to outlast the test; every test using it stops it first. */
const LONG_SCRIPT = "setTimeout(() => {}, 60000)";

function writeHistory(folder: string, history: { readonly totalMs: number; readonly checks: Record<string, number> }): void {
	mkdirSync(path.join(folder, "logs"), { recursive: true });
	writeFileSync(path.join(folder, "logs/hook.history.json"), JSON.stringify(history));
}

/** A keyboard the test presses, once the check has printed something. */
function pressing(keys: readonly KeyName[]): KeyboardOpener {
	return (onKey) => {
		const timer = setTimeout(() => {
			keys.forEach(onKey);
		}, 300);
		return {
			close: (): void => {
				clearTimeout(timer);
			},
		};
	};
}

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

	function run(checks: readonly LiveCheck[], stream: ProgressStream, nextStep?: string, openKeys: KeyboardOpener = NO_KEYBOARD): Promise<boolean> {
		return runChecks({
			title: "Title",
			changes: CHANGES,
			action: "push",
			checks,
			cwd: folder,
			stream,
			logFile: path.join(folder, "logs/hook.log"),
			historyFile: path.join(folder, "logs/hook.history.json"),
			openKeys,
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

	it("fails a check that exits non-zero without printing a word", async () => {
		const stream = recording(false);

		await expect(run([nodeCheck("silent", "process.exit(1)")], stream)).resolves.toBe(false);
		expect(stream.text()).toContain("Stopped: silent failed");
		expect(stream.text()).not.toContain("All clear");
	});

	it("fails when the command cannot start", async () => {
		await expect(run([{ id: "missing", label: "missing", command: "/no/such/command", args: [] }], recording(false))).resolves.toBe(false);
	});

	it("keeps the whole output in the log file", async () => {
		await run([nodeCheck("one", "console.log('kept'); console.error('kept too')")], recording(false));

		expect(readFileSync(path.join(folder, "logs/hook.log"), "utf8")).toContain("kept too");
	});

	it("takes over the screen in a terminal, gives it back, and leaves a summary in the scrollback", async () => {
		const stream = recording(true);

		await run([nodeCheck("one", "")], stream);
		const text = stream.text();
		expect(text).toContain("\u001B[?1049h");
		expect(text).toContain("\u001B[?25h");
		expect(text.slice(text.indexOf("\u001B[?1049l"))).toContain("main → origin/main");
		expect(text.slice(text.indexOf("\u001B[?1049l"))).toContain("All clear");
	});

	it("compares a run with the last one only when it finished", async () => {
		writeHistory(folder, { totalMs: 60_000, checks: { one: 60_000 } });
		const failed = recording(true);
		const passed = recording(true);

		await run([nodeCheck("one", "process.exit(1)")], failed);
		await run([nodeCheck("one", "")], passed);
		expect(failed.text()).not.toContain("than last time");
		expect(passed.text()).toContain("faster than last time");
	});

	it("remembers a good run's timings, and not a failed one's", async () => {
		const history = path.join(folder, "logs/hook.history.json");

		await run([nodeCheck("one", "process.exit(1)")], recording(false));
		expect(existsSync(history)).toBe(false);

		await run([nodeCheck("one", "")], recording(false));
		expect(readFileSync(history, "utf8")).toContain('"one"');
	});

	it("colours a terminal that supports it, and leaves one that doesn't plain", async () => {
		const colours = recording(true, true);
		const plain = recording(true, false);

		await run([nodeCheck("one", "")], colours);
		await run([nodeCheck("one", "")], plain);
		expect(colours.text()).toContain("\u001B[32m✓\u001B[39m");
		expect(plain.text()).not.toContain("\u001B[32m");
	});

	it("cancels on q pressed twice: the checks stop, the rest never run, and the hook fails", async () => {
		const stream = recording(true);
		const started = Date.now();
		const passed = run([nodeCheck("long", LONG_SCRIPT), nodeCheck("after", "console.log('ran')")], stream, undefined, pressing(["quit", "quit"]));

		await expect(passed).resolves.toBe(false);
		expect(Date.now() - started).toBeLessThan(5000);
		expect(stream.text()).toContain("Cancelled after");
		expect(stream.text()).toContain("The push did not happen.");
		expect(stream.text()).toContain("\u001B[?1049l");
		expect(readFileSync(path.join(folder, "logs/hook.log"), "utf8")).not.toContain("ran");
	});

	it("doesn't cancel on one q and another key", async () => {
		const stream = recording(true);

		await expect(run([nodeCheck("short", "setTimeout(() => {}, 700)")], stream, undefined, pressing(["quit", "down"]))).resolves.toBe(true);
		expect(stream.text()).toContain("Press q again");
		expect(stream.text()).not.toContain("Cancelled");
	});

	it("cancels on Ctrl+C at once", async () => {
		const stream = recording(true);

		await expect(run([nodeCheck("long", LONG_SCRIPT)], stream, undefined, pressing(["interrupt"]))).resolves.toBe(false);
		expect(stream.text()).toContain("Cancelled after");
	});

	it("cancels on a signal, and a second one doesn't wait for a check that ignores the first", async () => {
		const stream = recording(false);
		const stubborn = nodeCheck("stubborn", "process.on('SIGINT', () => {}); console.log('up'); setTimeout(() => {}, 60000)");
		const running = run([stubborn], stream);

		await new Promise((resolve) => {
			setTimeout(resolve, 500);
		});
		process.emit("SIGINT");
		process.emit("SIGINT");
		await expect(running).resolves.toBe(false);
		expect(stream.text()).toContain("Cancelled after");
	});

	it("keeps looking around separate from the result: every view and key leaves a pass a pass", async () => {
		const stream = recording(true);
		const keys: readonly KeyName[] = ["view2", "down", "enter", "escape", "view3", "view4", "view5", "up", "view6", "next", "previous", "pageUp", "pageDown", "home", "end"];
		const printing = nodeCheck("one", "console.log('@workspace/a:test: hello'); setTimeout(() => {}, 700)");

		await expect(run([{ ...printing, task: "test" }], stream, undefined, pressing(keys))).resolves.toBe(true);
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

describe("toLogLine", () => {
	it("splits off the package, and removes what could move the cursor", () => {
		expect(toLogLine("@workspace/api:test: \u001B[32mok\u001B[39m\tdone")).toStrictEqual({ workspace: "@workspace/api", text: "ok  done" });
		expect(toLogLine("\u001B[1mplain\u001B[22m line")).toStrictEqual({ workspace: undefined, text: "plain line" });
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
