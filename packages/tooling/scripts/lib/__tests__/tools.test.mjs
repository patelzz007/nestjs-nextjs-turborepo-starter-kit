import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FAILED_TO_RUN, TOOLS, findTool, formatToolMenu, runTool, toolArguments } from "../tools.mjs";

const EXIT_FROM_TOOL = 4;

/** @type {readonly import("../tools.mjs").Tool[]} */
const FIXTURE = [
	{ name: "db:deploy", group: "Database", description: "Apply migrations.", command: `printf '%s\\n' "ran" > ran.txt` },
	{ name: "echo-args", group: "Checks", description: "Echo its arguments.", command: `printf '%s\\n'` },
	{ name: "fail", group: "Checks", description: "Exit non-zero.", command: `exit ${String(EXIT_FROM_TOOL)}` },
];

let repo = "";
/** @type {string[]} */
let printed = [];
const print = (/** @type {string} */ text) => {
	printed.push(text);
};

beforeEach(() => {
	repo = mkdtempSync(path.join(tmpdir(), "tools-"));
	printed = [];
});

afterEach(() => {
	rmSync(repo, { recursive: true, force: true });
});

describe("TOOLS", () => {
	it("names every tool once", () => {
		const names = TOOLS.map((tool) => tool.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it("does not repeat a command the root package.json still runs", () => {
		const scripts = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../../../../../package.json"), "utf8")).scripts;
		expect(TOOLS.filter((tool) => Object.hasOwn(scripts, tool.name)).map((tool) => tool.name)).toEqual([]);
	});
});

describe("findTool", () => {
	it("finds a tool by name, and nothing for an unknown name", () => {
		expect(findTool(FIXTURE, "fail")?.group).toBe("Checks");
		expect(findTool(FIXTURE, "nope")).toBeUndefined();
	});
});

describe("formatToolMenu", () => {
	it("lists each tool with its description under its group, groups in order", () => {
		const menu = formatToolMenu(FIXTURE);
		expect(menu.indexOf("Database")).toBeLessThan(menu.indexOf("Checks"));
		expect(menu).toContain("  db:deploy  Apply migrations.");
		expect(menu).toContain("  echo-args  Echo its arguments.");
	});
});

describe("toolArguments", () => {
	it("drops the -- separator pnpm passes through, and keeps everything else", () => {
		expect(toolArguments(["--", "--scenario", "development"])).toEqual(["--scenario", "development"]);
		expect(toolArguments(["--scenario"])).toEqual(["--scenario"]);
		expect(toolArguments([])).toEqual([]);
	});
});

describe("runTool", () => {
	it("prints the menu and succeeds with no name", () => {
		expect(runTool(repo, [], { tools: FIXTURE, print })).toBe(0);
		expect(printed.join("\n")).toContain("Usage: pnpm tools");
	});

	it("prints the menu and fails for an unknown name", () => {
		expect(runTool(repo, ["nope"], { tools: FIXTURE, print })).toBe(FAILED_TO_RUN);
		expect(printed.join("\n")).toContain('Unknown tool "nope"');
	});

	it("runs the tool's command from the repository root", () => {
		expect(runTool(repo, ["db:deploy"], { tools: FIXTURE, print })).toBe(0);
		expect(readFileSync(path.join(repo, "ran.txt"), "utf8")).toBe("ran\n");
	});

	it("hands on its arguments as they are, without the -- separator", () => {
		const echoed = path.join(repo, "args.txt");
		const tools = [{ name: "echo-args", group: "Checks", description: "Echo its arguments.", command: `printf '%s\\n' > ${JSON.stringify(echoed)}` }];
		expect(runTool(repo, ["echo-args", "--", "a b", "$HOME"], { tools, print })).toBe(0);
		expect(readFileSync(echoed, "utf8")).toBe("a b\n$HOME\n");
	});

	it("returns the tool's exit code", () => {
		expect(runTool(repo, ["fail"], { tools: FIXTURE, print })).toBe(EXIT_FROM_TOOL);
	});
});
