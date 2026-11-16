import { describe, expect, it } from "vitest";

import { setVariables } from "../cli-environment.ts";

describe("setVariables", () => {
	it("keeps the variables that hold a value, unchanged", () => {
		expect(setVariables({ NOTION_READ_TOKEN: "ntn_abc", DOCS_SYNC_API_URL: "http://localhost:8080" })).toEqual({
			NOTION_READ_TOKEN: "ntn_abc",
			DOCS_SYNC_API_URL: "http://localhost:8080",
		});
	});

	it("leaves out a variable copied empty from .env.example, one of only spaces, and one not set", () => {
		expect(setVariables({ DOCS_SYNC_REPORT_TOKEN: "", NOTION_WRITE_TOKEN: "  ", DOCS_SOURCE: undefined, DOCS_DEFAULT_AUTHOR: "Platform Team" })).toEqual({
			DOCS_DEFAULT_AUTHOR: "Platform Team",
		});
	});
});
