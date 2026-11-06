// One check's command, in its own process group so a cancel reaches everything it started.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

export interface CommandSpec {
	readonly command: string;
	readonly args: readonly string[];
	readonly cwd: string;
	readonly env: NodeJS.ProcessEnv;
}

export interface RunningCommand {
	/** Resolves to the exit code. */
	readonly exit: Promise<number>;
	/** Asks everything to stop, then insists: a background process can ignore SIGINT and hold the output open. */
	interrupt(): void;
	/** Stops everything now. */
	kill(): void;
}

const NO_EXIT_CODE = 1;
/** Long enough for lint-staged to put the person's files back, which it does on SIGINT. */
const TERMINATE_AFTER_MS = 5000;
const KILL_AFTER_MS = 10_000;

export function startCommand({ command, args, cwd, env }: CommandSpec, onLine: (line: string) => void): RunningCommand {
	// Through `sh` (argv passed verbatim): package-manager shims can be scripts execve() rejects (ENOEXEC).
	const child = spawn("sh", ["-c", 'exec "$0" "$@"', command, ...args], { cwd, env, stdio: ["ignore", "pipe", "pipe"], detached: true });
	createInterface({ input: child.stdout }).on("line", onLine);
	createInterface({ input: child.stderr }).on("line", onLine);

	const timers: NodeJS.Timeout[] = [];
	const signalGroup = (signal: NodeJS.Signals): void => {
		// No pid means it never started; and `kill(0)` would signal this very process's group.
		if (child.pid === undefined) {
			return;
		}
		try {
			process.kill(-child.pid, signal);
		} catch {
			// Already gone.
		}
	};
	const exit = new Promise<number>((resolve) => {
		child.on("close", (code) => {
			timers.forEach(clearTimeout);
			resolve(code ?? NO_EXIT_CODE);
		});
	});

	return {
		exit,
		interrupt: (): void => {
			signalGroup("SIGINT");
			timers.push(
				setTimeout(() => {
					signalGroup("SIGTERM");
				}, TERMINATE_AFTER_MS),
				setTimeout(() => {
					signalGroup("SIGKILL");
				}, KILL_AFTER_MS),
			);
		},
		kill: (): void => {
			signalGroup("SIGKILL");
		},
	};
}
