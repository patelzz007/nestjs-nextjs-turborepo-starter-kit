import { describe, expect, it } from "vitest";

import {
	docsLineProblem,
	handEditedGeneratedFiles,
	isBotAuthor,
	isSyncOwnedPath,
	outOfBoundsFiles,
	parseManifestText,
	parseNameStatus,
	reviewReasons,
	type ChangedFile,
	type DocsManifest,
} from "../docs-guard.ts";

const PAGE = { sourceId: "a", slug: "guides/a", section: "Guides", order: 1, filePath: "docs/guides/a.md" };
const MANIFEST: DocsManifest = { entries: [PAGE] };

function modified(path: string): ChangedFile {
	return { path, status: "modified" };
}

describe("parseNameStatus", () => {
	it("reads added, modified and deleted files", () => {
		expect(parseNameStatus("A\tdocs/a.md\nM\tdocs/b.md\nD\tdocs/c.md\n")).toEqual([
			{ path: "docs/a.md", status: "added" },
			{ path: "docs/b.md", status: "modified" },
			{ path: "docs/c.md", status: "deleted" },
		]);
	});

	it("treats a status it does not know as a change", () => {
		expect(parseNameStatus("T\tdocs/a.md")).toEqual([{ path: "docs/a.md", status: "modified" }]);
	});
});

describe("parseManifestText", () => {
	it("reads the fields it needs and ignores the rest", () => {
		expect(parseManifestText(JSON.stringify({ version: 1, entries: [{ ...PAGE, title: "A" }], tombstones: [] })).entries).toHaveLength(1);
	});

	it("answers an empty manifest for a branch that has none", () => {
		expect(parseManifestText(null)).toEqual({ entries: [] });
	});
});

describe("isSyncOwnedPath", () => {
	it.each(["docs/sync/manifest.json", "docs/images/synced/a.png", "docs/meta.json", "docs/blog/meta.json", "docs/guides/a.md"])("the sync owns %s", (path) => {
		expect(isSyncOwnedPath(path, [MANIFEST])).toBe(true);
	});

	it.each([
		"apps/api/src/main.ts",
		".github/workflows/ci.yml",
		"AGENTS.md",
		"rules/00-non-negotiables.md",
		"docs/generated/openapi.json",
		"docs/history/PROGRESS.md",
		"docs/guides/not-synced.md",
	])("the sync does not own %s", (path) => {
		expect(isSyncOwnedPath(path, [MANIFEST])).toBe(false);
	});

	it("owns a page in either manifest, so a removed page's file can go", () => {
		expect(isSyncOwnedPath("docs/guides/a.md", [{ entries: [] }, MANIFEST])).toBe(true);
	});
});

describe("handEditedGeneratedFiles", () => {
	it("catches an edit to a generated page or the sync's state", () => {
		expect(handEditedGeneratedFiles([modified("docs/guides/a.md"), modified("docs/sync/redirects.json"), modified("docs/sync/manifest.json")], MANIFEST)).toHaveLength(3);
	});

	it("leaves hand-written pages alone", () => {
		expect(handEditedGeneratedFiles([modified("docs/guides/hand-written.md"), modified("apps/api/src/main.ts")], MANIFEST)).toEqual([]);
	});
});

describe("outOfBoundsFiles", () => {
	it("names what the sync should never have touched", () => {
		expect(outOfBoundsFiles([modified("docs/guides/a.md"), modified("apps/api/src/main.ts")], MANIFEST, MANIFEST)).toEqual(["apps/api/src/main.ts"]);
	});
});

describe("reviewReasons", () => {
	it("lets an edit to an existing page merge by itself", () => {
		expect(reviewReasons([modified("docs/guides/a.md"), modified("docs/sync/manifest.json")], MANIFEST, MANIFEST)).toEqual([]);
	});

	it("reviews a new page", () => {
		expect(reviewReasons([], { entries: [] }, MANIFEST)).toEqual(["New page: guides/a"]);
	});

	it("reviews a removed page", () => {
		expect(reviewReasons([], MANIFEST, { entries: [] })).toEqual(["Page removed: guides/a"]);
	});

	it("reviews a changed slug", () => {
		expect(reviewReasons([], MANIFEST, { entries: [{ ...PAGE, slug: "guides/b" }] })).toEqual(["Slug changed: guides/a → guides/b"]);
	});

	it.each([
		["section", { section: "Other" }],
		["order", { order: 2 }],
	])("reviews a changed %s", (_name, change) => {
		expect(reviewReasons([], MANIFEST, { entries: [{ ...PAGE, ...change }] })).toEqual(["Navigation changed: guides/a"]);
	});

	it("reviews a redirect", () => {
		expect(reviewReasons([modified("docs/sync/redirects.json")], MANIFEST, MANIFEST)).toEqual(["The redirects changed"]);
	});

	it.each(["docs/adr/084-x.md", "docs/architecture/plan.md", "docs/technical/security/x.md"])("reviews a sensitive section: %s", (path) => {
		expect(reviewReasons([modified(path)], MANIFEST, MANIFEST)).toEqual([`Sensitive section: ${path}`]);
	});
});

describe("docsLineProblem", () => {
	it.each(["Docs: updated in https://www.notion.so/abc", "Fixes a bug.\n\nDocs: not needed, internal refactor\n"])("accepts %j", (body) => {
		expect(docsLineProblem(body)).toBeNull();
	});

	it.each(["", "Docs:", "docs: not needed", "Docs: not needed", "Docs: updated in"])("asks for the line in %j", (body) => {
		expect(docsLineProblem(body)).toContain("Docs:");
	});
});

describe("isBotAuthor", () => {
	it("tells a bot from a person", () => {
		expect(isBotAuthor("dependabot[bot]")).toBe(true);
		expect(isBotAuthor("patelzz007")).toBe(false);
	});
});
