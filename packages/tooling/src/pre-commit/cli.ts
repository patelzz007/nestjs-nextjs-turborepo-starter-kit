#!/usr/bin/env node
/**
 * The pre-commit hook (.husky/pre-commit): formats and lints the staged files with lint-staged
 * (lint-staged.config.mjs), showing that it is working. Without this a commit just sits there, and someone new to
 * the repository can't tell it from a frozen terminal.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

import { settings } from "../shared/settings.ts";
import { runChecks, terminalStream } from "../terminal-progress/run-checks.ts";
import { stagedFilesNote } from "./pre-commit.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");

const staged = spawnSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], { cwd: REPO_ROOT, encoding: "utf8" }).stdout;

const passed = await runChecks({
	title: "Checking your commit",
	subtitle: "Formatting and linting the staged files",
	checks: [
		{
			id: "lint-staged",
			label: "Format, lint",
			note: stagedFilesNote(staged),
			command: path.join(REPO_ROOT, "node_modules/.bin/lint-staged"),
			args: ["--quiet", "--config", "packages/tooling/lint-staged.config.mjs"],
		},
	],
	cwd: REPO_ROOT,
	stream: terminalStream(),
	logFile: path.join(REPO_ROOT, settings.artifacts.ci, "pre-commit.log"),
});

process.exitCode = passed ? 0 : 1;
