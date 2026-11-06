import { describe, expect, it } from "vitest";

import { isPublishedGuide } from "../publishing";

describe("isPublishedGuide", () => {
	it("should publish a guide and skip posts and dated notes", () => {
		expect(isPublishedGuide("technical/database.md")).toBe(true);
		expect(isPublishedGuide("blog/changelog.md")).toBe(false);
		expect(isPublishedGuide("history/SECURITY-AUDIT-2026-10-25.md")).toBe(false);
	});
});
