import { describe, expect, it } from "vitest";

import { contentId } from "../content-id";

describe("contentId", () => {
	it("should drop the markdown extension and keep the path and its case", () => {
		expect(contentId("technical/authorization/overview.md")).toBe("technical/authorization/overview");
		expect(contentId("technical/README.md")).toBe("technical/README");
		expect(contentId("notes.mdx")).toBe("notes");
	});

	it("should turn Windows separators into URL slashes", () => {
		expect(contentId("technical\\api\\errors.md")).toBe("technical/api/errors");
	});
});
