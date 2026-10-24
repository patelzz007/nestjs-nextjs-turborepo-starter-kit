import { describe, expect, it } from "vitest";

import { parseConvertArguments } from "../kanban-convert";

describe("parseConvertArguments", () => {
	it("runs every stage by default, or plans only (--dry-run), or checks the board (--verify)", () => {
		expect(parseConvertArguments([])).toEqual({ mode: "run" });
		expect(parseConvertArguments(["--", "--dry-run"])).toEqual({ mode: "dry-run" });
		expect(parseConvertArguments(["--verify"])).toEqual({ mode: "verify" });
	});

	it("refuses an unknown option or two modes at once", () => {
		expect(() => parseConvertArguments(["--force"])).toThrow("Unknown option --force");
		expect(() => parseConvertArguments(["--dry-run", "--verify"])).toThrow("Usage");
	});
});
