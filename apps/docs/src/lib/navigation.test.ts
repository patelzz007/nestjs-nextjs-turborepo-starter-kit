import { describe, expect, it } from "vitest";

import {
	buildNavSections,
	contentId,
	docHref,
	DocsMetaSchema,
	findNeighbours,
	findSection,
	MORE_GUIDES_SECTION,
	sectionSlug,
	TILE_TONES,
	tileTone,
	type GuideSummary,
} from "./navigation";

function guide(id: string, title: string, tags: readonly string[] = []): GuideSummary {
	return { id, title, description: `${title} description`, tags };
}

const GUIDES: readonly GuideSummary[] = [
	guide("getting-started", "Getting Started"),
	guide("README", "Overview"),
	guide("prisma", "Prisma"),
	guide("zeta", "Zeta notes"),
	guide("alpha", "Alpha notes"),
	guide("legacy", "Legacy design", ["superseded"]),
];

const META = DocsMetaSchema.parse({
	pages: ["--- Engineering Basics ---", "getting-started", "README", "--- Tooling & DX ---", "prisma", "missing-page", "prisma", "--- Empty ---"],
});

describe("buildNavSections", () => {
	const sections = buildNavSections(META, GUIDES);

	it("groups listed guides under their separators, in meta order", () => {
		expect(sections.map((section) => section.title)).toEqual(["Engineering Basics", "Tooling & DX", MORE_GUIDES_SECTION]);
		expect(sections[0]?.items.map((item) => item.id)).toEqual(["getting-started", "README"]);
	});

	it("skips unknown ids, duplicates and empty sections", () => {
		expect(sections[1]?.items.map((item) => item.id)).toEqual(["prisma"]);
	});

	it("lists unlisted guides alphabetically but hides superseded ones", () => {
		expect(sections[2]?.items.map((item) => item.id)).toEqual(["alpha", "zeta"]);
	});

	it("assigns hrefs and icons", () => {
		expect(sections[0]?.items[1]).toMatchObject({ href: "/docs/README", icon: "bookOpen" });
		expect(sections[0]?.icon).toBe("rocket");
		expect(sections[2]?.items[0]?.icon).toBe("fileText");
	});

	it("puts guides before the first separator into a default section", () => {
		const loose = buildNavSections(DocsMetaSchema.parse({ pages: ["prisma"] }), [guide("prisma", "Prisma")]);
		expect(loose[0]?.title).toBe("Guides");
	});
});

describe("neighbours and sections", () => {
	const sections = buildNavSections(META, GUIDES);

	it("finds previous and next across section boundaries", () => {
		const { previous, next } = findNeighbours(sections, "README");
		expect(previous?.id).toBe("getting-started");
		expect(next?.id).toBe("prisma");
	});

	it("returns nulls at the ends and for pages outside the sidebar", () => {
		expect(findNeighbours(sections, "getting-started").previous).toBeNull();
		expect(findNeighbours(sections, "legacy")).toEqual({ previous: null, next: null });
	});

	it("finds the containing section", () => {
		expect(findSection(sections, "prisma")?.title).toBe("Tooling & DX");
		expect(findSection(sections, "legacy")).toBeNull();
	});
});

describe("ids and hrefs", () => {
	it("derives ids from paths, keeping case and folders", () => {
		expect(contentId("technical/authorization/overview.md")).toBe("technical/authorization/overview");
		expect(contentId("technical/README.md")).toBe("technical/README");
		expect(docHref("README")).toBe("/docs/README");
	});

	it("rejects malformed meta files", () => {
		expect(DocsMetaSchema.safeParse({ pages: [""] }).success).toBe(false);
		expect(DocsMetaSchema.safeParse({ pages: ["a"], extra: true }).success).toBe(false);
	});
});

describe("learning-center helpers", () => {
	it("slugs section titles for anchors", () => {
		expect(sectionSlug("Architecture & Auth")).toBe("architecture-auth");
		expect(sectionSlug("  Tooling & DX ")).toBe("tooling-dx");
	});

	it("cycles tile tones from 1", () => {
		expect(tileTone(0)).toBe(1);
		expect(tileTone(TILE_TONES - 1)).toBe(TILE_TONES);
		expect(tileTone(TILE_TONES)).toBe(1);
	});
});
