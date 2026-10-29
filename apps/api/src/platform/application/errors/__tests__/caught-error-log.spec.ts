import { describe, expect, it } from "vitest";

import { caughtErrorLogFields } from "../caught-error-log";

describe("caughtErrorLogFields", () => {
	it("logs an Error's message and its stack", () => {
		const error = new Error("database unreachable");

		expect(caughtErrorLogFields(error)).toEqual({ error: "database unreachable", stack: error.stack });
		expect(caughtErrorLogFields(error).stack).toContain("caught-error-log.spec.ts");
	});

	it("logs only the message of an Error that has no stack", () => {
		const error = new Error("no stack");
		delete error.stack;

		expect(caughtErrorLogFields(error)).toEqual({ error: "no stack" });
	});

	it("logs a thrown primitive as its text, and a thrown object as JSON", () => {
		expect(caughtErrorLogFields("boom")).toEqual({ error: "boom" });
		expect(caughtErrorLogFields(42)).toEqual({ error: "42" });
		expect(caughtErrorLogFields(null)).toEqual({ error: "null" });
		expect(caughtErrorLogFields(undefined)).toEqual({ error: "undefined" });
		expect(caughtErrorLogFields({ code: "E_FAIL", retry: false })).toEqual({ error: '{"code":"E_FAIL","retry":false}' });
	});
});
