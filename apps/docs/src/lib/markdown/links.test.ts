import type { Link, Paragraph, Root } from "mdast";
import { describe, expect, it } from "vitest";

import { remarkContentLinks, resolveContentLink, type ContentRoots } from "./links";

const ROOTS: ContentRoots = { repoRoot: "/repo", githubBlobBase: "https://github.com/acme/app/blob/main" };

describe("resolveContentLink", () => {
	it("maps sibling guides to /docs routes and keeps the anchor", () => {
		expect(resolveContentLink("./database.md#seed-data", "/repo/docs/technical/getting-started.md", ROOTS)).toBe("/docs/technical/database#seed-data");
		expect(resolveContentLink("database.md", "/repo/docs/technical/getting-started.md", ROOTS)).toBe("/docs/technical/database");
	});

	it("resolves guides in and out of sub-folders, keeping id case", () => {
		expect(resolveContentLink("./overview.md", "/repo/docs/technical/authorization/backend.md", ROOTS)).toBe("/docs/technical/authorization/overview");
		expect(resolveContentLink("../../README.md", "/repo/docs/technical/authorization/backend.md", ROOTS)).toBe("/docs/README");
	});

	it("maps blog posts and doc images", () => {
		expect(resolveContentLink("../blog/telescope.md", "/repo/docs/telescope.md", ROOTS)).toBe("/blog/telescope");
		expect(resolveContentLink("../../images/email/a.png", "/repo/docs/technical/email/templates.md", ROOTS)).toBe("/images/email/a.png");
	});

	it("sends other repository files to GitHub", () => {
		expect(resolveContentLink("../../apps/api/prisma/rls/README.md", "/repo/docs/technical/database.md", ROOTS)).toBe(
			"https://github.com/acme/app/blob/main/apps/api/prisma/rls/README.md",
		);
		expect(resolveContentLink("../.cursorrules", "/repo/docs/eslint.md", ROOTS)).toBe("https://github.com/acme/app/blob/main/.cursorrules");
	});

	it("leaves external, absolute, in-page and out-of-repo links alone", () => {
		for (const href of ["https://example.com", "mailto:a@b.c", "/docs/README", "#anchor", "", "../../../etc/passwd"]) {
			expect(resolveContentLink(href, "/repo/docs/a.md", ROOTS)).toBe(href);
		}
	});

	it("normalises Windows separators", () => {
		expect(resolveContentLink("./b.md", "C:\\repo\\docs\\a.md", { ...ROOTS, repoRoot: "C:\\repo" })).toBe("/docs/b");
	});
});

describe("remarkContentLinks", () => {
	function tree(url: string): { readonly root: Root; readonly link: Link } {
		const link: Link = { type: "link", url, children: [{ type: "text", value: "x" }] };
		const paragraph: Paragraph = { type: "paragraph", children: [link] };
		return { root: { type: "root", children: [paragraph] }, link };
	}

	it("rewrites links relative to the source file", () => {
		const { root, link } = tree("./database.md");
		remarkContentLinks(ROOTS)(root, { path: "/repo/docs/technical/getting-started.md" });
		expect(link.url).toBe("/docs/technical/database");
	});

	it("does nothing when the file path is unknown", () => {
		const { root, link } = tree("./database.md");
		remarkContentLinks(ROOTS)(root, {});
		expect(link.url).toBe("./database.md");
	});
});
