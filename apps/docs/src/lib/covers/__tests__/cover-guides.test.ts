import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readCoverGuides } from "../cover-guides";

const FIXTURE_DOCS = fileURLToPath(new URL("fixtures/docs/", import.meta.url));

describe("readCoverGuides", () => {
	it("reads every guide, sorted by slug, and skips the folders that hold no guides", () => {
		expect(readCoverGuides(FIXTURE_DOCS)).toEqual([
			{
				slug: "adr/001-first",
				title: "ADR 001: First",
				description: undefined,
				tags: ["adr", "rbac"],
				body: "\n**Status:** Accepted\n",
				cover: "/images/covers/adr/001-first.webp",
			},
			{ slug: "guide", title: "Guide", description: "A guide.", tags: [], body: "\n## One\n", cover: undefined },
		]);
	});
});
