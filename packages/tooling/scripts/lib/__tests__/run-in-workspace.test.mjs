import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FAILED_TO_RUN, runInWorkspace } from "../run-in-workspace.mjs";

const EXIT_FROM_TOOL = 3;

let repo = "";

beforeEach(() => {
	repo = mkdtempSync(path.join(tmpdir(), "run-in-workspace-"));
	const bin = path.join(repo, "apps/api/node_modules/.bin");
	mkdirSync(bin, { recursive: true });
	// A shebang-less shim, like nvm's pnpm: it only starts through a shell.
	writeFileSync(path.join(bin, "tool"), `pwd > ran-in.txt\nprintf '%s\\n' "$@" > args.txt\nexit ${String(EXIT_FROM_TOOL)}\n`);
	chmodSync(path.join(bin, "tool"), 0o755);
});

afterEach(() => {
	rmSync(repo, { recursive: true, force: true });
});

describe("runInWorkspace", () => {
	it("runs the workspace's own binary from the workspace folder, even a shebang-less shim, and returns its exit code", () => {
		expect(runInWorkspace(repo, ["apps/api", "tool", "src/a b.ts", "--flag"])).toBe(EXIT_FROM_TOOL);
		expect(readFileSync(path.join(repo, "apps/api/ran-in.txt"), "utf8").trim()).toBe(realpathSync(path.join(repo, "apps/api")));
		expect(readFileSync(path.join(repo, "apps/api/args.txt"), "utf8")).toBe("src/a b.ts\n--flag\n");
	});

	it("fails, never passes, when the binary is missing", () => {
		// The shell's own "cannot run" status: 126 or 127 depending on the shell.
		expect(runInWorkspace(repo, ["apps/api", "missing-tool"])).toBeGreaterThan(0);
	});

	it("fails when it cannot start at all, or is given no binary", () => {
		const unstartable = () => ({ error: new Error("spawn sh ENOENT"), status: null });

		expect(runInWorkspace(repo, ["apps/api", "tool"], unstartable)).toBe(FAILED_TO_RUN);
		expect(runInWorkspace(repo, ["apps/api"])).toBe(FAILED_TO_RUN);
	});
});
