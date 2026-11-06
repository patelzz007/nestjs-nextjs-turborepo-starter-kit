import { describe, expect, it } from "vitest";

import { FrontmatterError, GuideFrontmatterSchema, parseMarkdownFile, PostFrontmatterSchema } from "../frontmatter";

const GUIDE = `---
title: "Messaging"
author: "Backend Team"
lastUpdated: 1790812800000
coverImage: "https://images.example/cover.jpg"
---

# Messaging

Body text.
`;

describe("parseMarkdownFile", () => {
	it("should split a guide into validated front matter and its body, defaulting tags", () => {
		const parsed = parseMarkdownFile("docs/messaging.md", GUIDE, GuideFrontmatterSchema);
		expect(parsed.data).toEqual({ title: "Messaging", author: "Backend Team", lastUpdated: 1790812800000, coverImage: "https://images.example/cover.jpg", tags: [] });
		expect(parsed.body).toBe("\n# Messaging\n\nBody text.\n");
	});

	it("should accept Windows line endings and a file that is only front matter", () => {
		const parsed = parseMarkdownFile("docs/blog/x.md", '---\r\ntitle: "X"\r\ndescription: "D"\r\nauthor: "A"\r\ndate: 1\r\ncategory: "C"\r\n---', PostFrontmatterSchema);
		expect(parsed.data.category).toBe("C");
		expect(parsed.body).toBe("");
	});

	it("should name the file when the front matter block is missing", () => {
		expect(() => parseMarkdownFile("docs/bare.md", "# No front matter", GuideFrontmatterSchema)).toThrow(
			new FrontmatterError("docs/bare.md", "missing the `---` front matter block"),
		);
	});

	it("should reject a misspelt or missing field, naming the file and the field", () => {
		const misspelt = GUIDE.replace("author:", "auther:");
		expect(() => parseMarkdownFile("docs/messaging.md", misspelt, GuideFrontmatterSchema)).toThrow(/docs\/messaging\.md: .*auther/s);
	});
});
