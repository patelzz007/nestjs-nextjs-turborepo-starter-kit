#!/usr/bin/env node
/**
 * `node ../tooling/src/watch-runner/cli.mjs "<command 1>" "<command 2>" …`
 *
 * Runs each command (program name + plain flags) as a child process, prefixes
 * their output, forwards SIGINT/SIGTERM to all of them and exits once every
 * child has exited. See watch-runner.mjs for the behaviour and plan §19.2.
 */
import { spawn } from "node:child_process";

import { parseCommand, runWatchers } from "./watch-runner.mjs";

/** Arguments after `node <script>`. */
const FIRST_USER_ARGUMENT = 2;
/**
 * Windows starts `node_modules/.bin/*.cmd` shims only through a shell; on
 * POSIX the children are exec'd directly so signals reach them, not a shell.
 */
const NEEDS_SHELL = process.platform === "win32";

const commands = process.argv.slice(FIRST_USER_ARGUMENT).map(parseCommand);

runWatchers({
	commands,
	spawn: (file, args) => spawn(file, args, { stdio: ["ignore", "pipe", "pipe"], shell: NEEDS_SHELL }),
	signals: process,
	stdout: process.stdout,
	stderr: process.stderr,
})
	.then((code) => {
		process.exitCode = code;
	})
	.catch((error) => {
		console.error(`watch-runner failed: ${error instanceof Error ? error.message : String(error)}`);
		process.exitCode = 1;
	});
