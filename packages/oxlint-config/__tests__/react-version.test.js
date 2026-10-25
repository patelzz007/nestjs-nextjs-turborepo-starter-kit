import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installedReactVersion } from "../react-version.js";

describe("installedReactVersion", () => {
	let workspace = "";

	beforeEach(() => {
		workspace = realpathSync(mkdtempSync(path.join(tmpdir(), "react-version-")));
		writeFileSync(path.join(workspace, "package.json"), JSON.stringify({ name: "probe", private: true }));
		vi.spyOn(process, "cwd").mockReturnValue(workspace);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		rmSync(workspace, { recursive: true, force: true });
	});

	function installReact(manifest) {
		const directory = path.join(workspace, "node_modules", "react");
		mkdirSync(directory, { recursive: true });
		writeFileSync(path.join(directory, "package.json"), JSON.stringify({ name: "react", ...manifest }));
	}

	it("reads the version of the React installed in the linted workspace (the working directory)", () => {
		installReact({ version: "19.2.3" });
		expect(installedReactVersion()).toBe("19.2.3");
	});

	it("keeps a prerelease suffix", () => {
		installReact({ version: "19.3.0-canary-1a2b3c4d-20261020" });
		expect(installedReactVersion()).toBe("19.3.0-canary-1a2b3c4d-20261020");
	});

	it("fails loudly on a manifest without a semver version", () => {
		installReact({ version: "latest" });
		expect(() => installedReactVersion()).toThrow();
	});

	it("fails loudly when the workspace has no React", () => {
		expect(() => installedReactVersion()).toThrow(/react\/package\.json/u);
	});
});
