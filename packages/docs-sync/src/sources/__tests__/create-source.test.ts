import { describe, expect, it } from "vitest";

import { createSource, SourceConfigurationError } from "../create-source.ts";

describe("createSource", () => {
	it("builds the Notion source from the environment", () => {
		const source = createSource("NOTION", { NOTION_READ_TOKEN: "t", NOTION_DOCS_DATA_SOURCE_ID: "d", NOTION_BLOG_DATA_SOURCE_ID: "b" });

		expect(source.kind).toBe("NOTION");
	});

	it("names what is missing, and only names it", () => {
		const build = (): void => {
			createSource("NOTION", { NOTION_READ_TOKEN: "secret-value" });
		};

		expect(build).toThrow(SourceConfigurationError);
		expect(build).toThrow("NOTION_DOCS_DATA_SOURCE_ID, NOTION_BLOG_DATA_SOURCE_ID");
		expect(build).not.toThrow("secret-value");
	});
});
