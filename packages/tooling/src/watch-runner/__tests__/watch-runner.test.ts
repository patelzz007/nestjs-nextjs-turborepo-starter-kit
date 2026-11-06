import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { setImmediate as nextTick } from "node:timers/promises";

import { describe, expect, it } from "vitest";

import { type TimerHandle, FORWARDED_SIGNALS, SHUTDOWN_GRACE_MS, WATCHER_FAILED_EXIT_CODE, parseCommand, runWatchers } from "../watch-runner.ts";

/** A child process stand-in: real streams, records the signals it receives. */
class FakeChild extends EventEmitter {
	public stdout = new PassThrough();
	public stderr = new PassThrough();
	public signals: string[] = [];
	/** Whether a received SIGINT/SIGTERM makes it exit (a hung watcher ignores them). */
	public exitsOnSignal: boolean;

	public constructor(exitsOnSignal: boolean) {
		super();
		this.exitsOnSignal = exitsOnSignal;
	}

	public kill(signal: NodeJS.Signals): boolean {
		this.signals.push(signal);
		if (this.exitsOnSignal || signal === "SIGKILL") {
			queueMicrotask(() => this.emit("exit", null, signal));
		}
		return true;
	}
}

/** A process-like signal source the test fires by hand. */
class FakeSignals extends EventEmitter {
	public fire(signal: NodeJS.Signals): void {
		this.emit(signal);
	}
}

/** Collects written text. */
function sink(): { lines: string[]; write: (text: string) => void } {
	const lines: string[] = [];
	return {
		lines,
		write: (text: string): void => {
			lines.push(text);
		},
	};
}

/** Manual timers: the test decides when the grace period has passed. */
function manualTimers(): {
	pending: Map<TimerHandle, { callback: () => void; ms: number }>;
	setTimer: (callback: () => void, ms: number) => number;
	clearTimer: (handle: TimerHandle) => void;
	fireAll: () => void;
} {
	const pending = new Map<TimerHandle, { callback: () => void; ms: number }>();
	let nextHandle = 1;
	return {
		pending,
		setTimer: (callback: () => void, ms: number): number => {
			const handle = nextHandle;
			nextHandle += 1;
			pending.set(handle, { callback, ms });
			return handle;
		},
		clearTimer: (handle: TimerHandle): void => {
			pending.delete(handle);
		},
		fireAll: () => {
			for (const [handle, { callback }] of [...pending]) {
				pending.delete(handle);
				callback();
			}
		},
	};
}

function setup({ exitsOnSignal = true } = {}): {
	children: FakeChild[];
	spawned: { file: string; args: readonly string[] }[];
	signals: FakeSignals;
	stdout: { lines: string[]; write: (text: string) => void };
	stderr: { lines: string[]; write: (text: string) => void };
	timers: {
		pending: Map<TimerHandle, { callback: () => void; ms: number }>;
		setTimer: (callback: () => void, ms: number) => number;
		clearTimer: (handle: TimerHandle) => void;
		fireAll: () => void;
	};
	done: Promise<number>;
} {
	const children: FakeChild[] = [];
	const spawned: { file: string; args: readonly string[] }[] = [];
	const signals = new FakeSignals();
	const stdout = sink();
	const stderr = sink();
	const timers = manualTimers();
	const commands = [parseCommand("tsrs -p tsconfig.build.json --watch --preserveWatchOutput"), parseCommand("tsc-alias -p tsconfig.build.json --watch")];
	const done = runWatchers({
		commands,
		spawn: (file, args) => {
			spawned.push({ file, args });
			const child = new FakeChild(exitsOnSignal);
			children.push(child);
			return child;
		},
		signals,
		stdout,
		stderr,
		setTimer: timers.setTimer,
		clearTimer: timers.clearTimer,
	});
	return { children, spawned, signals, stdout, stderr, timers, done };
}

describe("parseCommand", () => {
	it("splits a command line into program, flags and a label", () => {
		expect(parseCommand("  tsc-alias -p tsconfig.build.json   --watch ")).toEqual({ label: "tsc-alias", file: "tsc-alias", args: ["-p", "tsconfig.build.json", "--watch"] });
	});

	it("rejects an empty command", () => {
		expect(() => parseCommand("   ")).toThrow(/empty command/);
	});
});

describe("runWatchers", () => {
	it("refuses to run without commands", () => {
		expect(() => runWatchers({ commands: [], spawn: () => new FakeChild(true), signals: new FakeSignals(), stdout: sink(), stderr: sink() })).toThrow(/at least one command/);
	});

	it("spawns every command with its own arguments", () => {
		const { spawned } = setup();
		expect(spawned).toEqual([
			{ file: "tsrs", args: ["-p", "tsconfig.build.json", "--watch", "--preserveWatchOutput"] },
			{ file: "tsc-alias", args: ["-p", "tsconfig.build.json", "--watch"] },
		]);
	});

	it("prefixes each child's lines with its padded label, on the matching stream", async () => {
		const { children, stdout, stderr } = setup();
		const [compiler = new FakeChild(true), alias = new FakeChild(true)] = children;
		compiler.stdout.write("Found 0 errors. Watching for file changes.\n");
		alias.stderr.write("cannot read tsconfig\n");
		await nextTick();
		expect(stdout.lines).toEqual(["[tsrs     ] Found 0 errors. Watching for file changes.\n"]);
		expect(stderr.lines).toEqual(["[tsc-alias] cannot read tsconfig\n"]);
	});

	it.each(FORWARDED_SIGNALS)("forwards %s to every child and resolves 0 once all have exited", async (signal) => {
		const { children, signals, timers, done } = setup();
		signals.fire(signal);
		expect(children.map((child) => child.signals)).toEqual([[signal], [signal]]);
		await expect(done).resolves.toBe(0);
		expect(timers.pending.size).toBe(0);
		expect(signals.listenerCount(signal)).toBe(0);
	});

	it("forwards a repeated signal only once", async () => {
		const { children, signals, done } = setup();
		signals.fire("SIGINT");
		signals.fire("SIGINT");
		await done;
		expect(children.map((child) => child.signals)).toEqual([["SIGINT"], ["SIGINT"]]);
	});

	it("kills children that ignore the forwarded signal once the grace period passes", async () => {
		const { children, signals, timers, done } = setup({ exitsOnSignal: false });
		signals.fire("SIGTERM");
		expect([...timers.pending.values()].map(({ ms }) => ms)).toEqual([SHUTDOWN_GRACE_MS]);
		timers.fireAll();
		await expect(done).resolves.toBe(0);
		expect(children.map((child) => child.signals)).toEqual([
			["SIGTERM", "SIGKILL"],
			["SIGTERM", "SIGKILL"],
		]);
	});

	it("stops the other watchers and returns the code when one exits by itself", async () => {
		const { children, stderr, done } = setup();
		const [compiler = new FakeChild(true), alias = new FakeChild(true)] = children;
		alias.emit("exit", 2, null);
		expect(compiler.signals).toEqual(["SIGTERM"]);
		await expect(done).resolves.toBe(2);
		expect(stderr.lines.join("")).toContain("[tsc-alias] exited (code 2); stopping the other watchers");
	});

	it("treats a watcher exiting cleanly on its own as a failure", async () => {
		const { children, done } = setup();
		const [compiler = new FakeChild(true)] = children;
		compiler.emit("exit", 0, null);
		await expect(done).resolves.toBe(WATCHER_FAILED_EXIT_CODE);
	});

	it("fails when a watcher cannot start, even if exit follows the error", async () => {
		const { children, stderr, done } = setup();
		const [compiler = new FakeChild(true)] = children;
		compiler.emit("error", new Error("spawn tsrs ENOENT"));
		compiler.emit("exit", null, null);
		await expect(done).resolves.toBe(WATCHER_FAILED_EXIT_CODE);
		expect(stderr.lines.join("")).toContain("failed to start: spawn tsrs ENOENT");
	});
});
