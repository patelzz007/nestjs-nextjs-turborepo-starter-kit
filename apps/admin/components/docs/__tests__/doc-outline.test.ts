import { describe, expect, it } from "vitest";

import { extractDocOutline, slugifyHeading } from "../doc-outline";

describe("slugifyHeading", () => {
	it.each([
		["Going live", "going-live"],
		["Reading an existing HTTP API (`useApi`)", "reading-an-existing-http-api-useapi"],
		["  Spaces -- and   dashes  ", "spaces-and-dashes"],
		["Café & crème", "cafe-creme"],
		["???", "section"],
	])("%s → %s", (text, slug) => {
		expect(slugifyHeading(text)).toBe(slug);
	});
});

describe("extractDocOutline", () => {
	it("lists ## and ### headings in order, with their plain text", () => {
		const outline = extractDocOutline("Intro\n\n## Setup\n\n### The `env` file\n\n#### Too deep\n\n## Next steps\n");

		expect(outline).toStrictEqual([
			{ id: "setup", text: "Setup", depth: 2 },
			{ id: "the-env-file", text: "The env file", depth: 3 },
			{ id: "next-steps", text: "Next steps", depth: 2 },
		]);
	});

	it("gives repeated headings unique ids", () => {
		expect(extractDocOutline("## Example\n\n## Example\n\n## Example\n").map(({ id }) => id)).toStrictEqual(["example", "example-2", "example-3"]);
	});

	it("ignores heading-like lines inside code fences", () => {
		expect(extractDocOutline("```md\n## Not a heading\n```\n")).toStrictEqual([]);
	});
});
