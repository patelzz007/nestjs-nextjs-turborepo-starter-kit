import { describe, expect, it } from "vitest";

import { startCommand } from "../command.ts";

function start(script: string, onLine: (line: string) => void = () => undefined): ReturnType<typeof startCommand> {
	return startCommand({ command: process.execPath, args: ["-e", script], cwd: process.cwd(), env: process.env }, onLine);
}

/** Starts a process in the background that ignores SIGINT and keeps the output open, as a real one did. */
const STUBBORN_CHILD = "require('child_process').spawn('sh', ['-c', 'trap \"\" INT; sleep 60'], { stdio: 'inherit' }); console.log('up');";

describe("startCommand", () => {
	it("hands over stdout and stderr by line, and resolves to the exit code", async () => {
		const lines: string[] = [];
		const running = start("console.log('out'); console.error('err'); process.exit(4)", (line) => lines.push(line));

		await expect(running.exit).resolves.toBe(4);
		expect(lines.toSorted()).toStrictEqual(["err", "out"]);
	});

	it("stops a command on interrupt", async () => {
		const running = start("console.log('up'); setTimeout(() => {}, 60000)");
		await new Promise((resolve) => {
			setTimeout(resolve, 300);
		});

		running.interrupt();
		await expect(running.exit).resolves.toBe(1);
	});

	it("kill reaches a background process that ignores the interrupt and holds the output open", async () => {
		const running = start(`${STUBBORN_CHILD} setTimeout(() => {}, 60000)`);
		await new Promise((resolve) => {
			setTimeout(resolve, 500);
		});

		running.interrupt();
		running.kill();
		await expect(running.exit).resolves.toBe(1);
	});

	it("signalling a finished command does nothing", async () => {
		const running = start("");
		await running.exit;

		expect(() => {
			running.interrupt();
			running.kill();
		}).not.toThrow();
	});
});
