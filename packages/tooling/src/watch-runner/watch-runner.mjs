/**
 * Runs several long-lived watchers as one process (plan §19.2, decision #69):
 * the `dev` script of `packages/shared`, `packages/messaging` and
 * `packages/api-client` keeps `dist/` current with `tsrs --watch` and
 * `tsc-alias --watch` side by side.
 *
 * Why a runner and not `a & b`: `&` in a package script is not portable and
 * leaves orphan watchers behind after Ctrl-C. This runner prefixes each
 * child's output with its name, forwards SIGINT/SIGTERM to every child, and
 * when one watcher dies on its own stops the others and exits non-zero, so
 * `turbo dev` shows the failure instead of a silently stale `dist/`.
 *
 * Process creation, signals and timers are injected so the behaviour is
 * unit-tested with fake child processes.
 */
import readline from "node:readline";

/** The signals a terminal or turbo sends to stop a dev task. */
export const FORWARDED_SIGNALS = ["SIGINT", "SIGTERM"];
/** How long children get to exit after a forwarded signal before they are killed outright. */
export const SHUTDOWN_GRACE_MS = 5_000;
/** The exit code when a watcher stops by itself, or could not start, while it should keep running. */
export const WATCHER_FAILED_EXIT_CODE = 1;

/**
 * @typedef {{ label: string, file: string, args: string[] }} WatchCommand
 * @typedef {import("node:events").EventEmitter & {
 *   stdout: NodeJS.ReadableStream | null,
 *   stderr: NodeJS.ReadableStream | null,
 *   kill: (signal: NodeJS.Signals) => boolean,
 * }} ChildLike
 * @typedef {(file: string, args: string[]) => ChildLike} SpawnLike
 * @typedef {{
 *   on: (signal: NodeJS.Signals, listener: () => void) => void,
 *   off: (signal: NodeJS.Signals, listener: () => void) => void,
 * }} SignalSource
 * @typedef {{ write: (text: string) => void }} Sink
 */

/**
 * Splits one command line on whitespace. The label is the program name.
 * Quoting is deliberately unsupported: the watcher commands take plain flags.
 *
 * @param {string} commandLine
 * @returns {WatchCommand}
 */
export function parseCommand(commandLine) {
	const [file, ...args] = commandLine.trim().split(/\s+/);
	if (file === undefined || file.length === 0) {
		throw new Error("watch-runner: an empty command was given");
	}
	return { label: file, file, args };
}

/**
 * @param {readonly WatchCommand[]} commands
 * @returns {number}
 */
function labelWidth(commands) {
	return Math.max(...commands.map((command) => command.label.length));
}

/**
 * Starts every command and resolves with the exit code the runner should end
 * with once all of them have exited: 0 after a forwarded signal, otherwise the
 * failing watcher's code.
 *
 * @param {{
 *   commands: readonly WatchCommand[],
 *   spawn: SpawnLike,
 *   signals: SignalSource,
 *   stdout: Sink,
 *   stderr: Sink,
 *   setTimer?: (callback: () => void, ms: number) => unknown,
 *   clearTimer?: (handle: unknown) => void,
 * }} options
 * @returns {Promise<number>}
 */
export function runWatchers({ commands, spawn, signals, stdout, stderr, setTimer = setTimeout, clearTimer = (handle) => clearTimeout(handle) }) {
	if (commands.length === 0) {
		throw new Error("watch-runner: pass at least one command");
	}
	const width = labelWidth(commands);
	const prefix = (/** @type {WatchCommand} */ command) => `[${command.label.padEnd(width)}] `;

	return new Promise((resolve) => {
		/** @type {Set<ChildLike>} */
		const running = new Set();
		let exitCode = 0;
		let stopping = false;
		/** @type {unknown} */
		let killTimer = undefined;

		/** @param {NodeJS.Signals} signal */
		const stopAll = (signal) => {
			if (stopping) {
				return;
			}
			stopping = true;
			for (const child of running) {
				child.kill(signal);
			}
			killTimer = setTimer(() => {
				for (const child of running) {
					child.kill("SIGKILL");
				}
			}, SHUTDOWN_GRACE_MS);
		};

		/** @type {Map<NodeJS.Signals, () => void>} */
		const listeners = new Map(FORWARDED_SIGNALS.map((signal) => [signal, () => stopAll(signal)]));
		for (const [signal, listener] of listeners) {
			signals.on(signal, listener);
		}

		const settle = () => {
			if (running.size > 0) {
				return;
			}
			if (killTimer !== undefined) {
				clearTimer(killTimer);
			}
			for (const [signal, listener] of listeners) {
				signals.off(signal, listener);
			}
			resolve(exitCode);
		};

		for (const command of commands) {
			const child = spawn(command.file, command.args);
			running.add(child);
			/** @type {readonly { stream: NodeJS.ReadableStream | null, sink: Sink }[]} */
			const outputs = [
				{ stream: child.stdout, sink: stdout },
				{ stream: child.stderr, sink: stderr },
			];
			for (const { stream, sink } of outputs) {
				if (stream !== null) {
					readline.createInterface({ input: stream }).on("line", (line) => sink.write(`${prefix(command)}${line}\n`));
				}
			}
			let settled = false;
			/** @param {number | null} code @param {string} reason */
			const onEnd = (code, reason) => {
				if (settled) {
					return;
				}
				settled = true;
				running.delete(child);
				if (!stopping) {
					stderr.write(`${prefix(command)}${reason}; stopping the other watchers\n`);
					exitCode = code === null || code === 0 ? WATCHER_FAILED_EXIT_CODE : code;
					stopAll("SIGTERM");
				}
				settle();
			};
			child.once("exit", (/** @type {number | null} */ code, /** @type {string | null} */ signal) => onEnd(code, `exited (${signal ?? `code ${String(code)}`})`));
			child.once("error", (/** @type {Error} */ error) => onEnd(null, `failed to start: ${error.message}`));
		}
	});
}
