import { describe, expect, it } from "vitest";

import { absoluteUrl, editLinkOf, githubEditUrl, GITHUB_URL, HEADER_TABS, isExternalTab, isTabActive, normalizePathname, robotsTxt, type HeaderTab } from "../site";

const GUIDES: HeaderTab = { label: "Guides", href: "/", activePaths: ["/", "/docs"] };
const EXTERNAL: HeaderTab = { label: "Admin", href: "https://admin.example.com", activePaths: [] };

describe("normalizePathname", () => {
	it("drops the .html suffix and trailing slashes", () => {
		expect(normalizePathname("/docs.html")).toBe("/docs");
		expect(normalizePathname("/docs/")).toBe("/docs");
		expect(normalizePathname("/docs/technical/authorization/overview.html")).toBe("/docs/technical/authorization/overview");
	});

	it("maps the root in every form to /", () => {
		expect(normalizePathname("/")).toBe("/");
		expect(normalizePathname("/index.html")).toBe("/");
		expect(normalizePathname("")).toBe("/");
	});
});

describe("isTabActive", () => {
	it("matches the tab's own path and everything below it", () => {
		expect(isTabActive(GUIDES, "/docs")).toBe(true);
		expect(isTabActive(GUIDES, "/docs.html")).toBe(true);
		expect(isTabActive(GUIDES, "/docs/technical/database")).toBe(true);
	});

	it("matches the home page exactly, never as a prefix", () => {
		expect(isTabActive(GUIDES, "/")).toBe(true);
		expect(isTabActive(GUIDES, "/index.html")).toBe(true);
		expect(isTabActive(GUIDES, "/blog")).toBe(false);
	});

	it("does not match siblings sharing a prefix, or external tabs", () => {
		expect(isTabActive(GUIDES, "/docsearch")).toBe(false);
		expect(isTabActive(EXTERNAL, "/docs")).toBe(false);
	});

	it("keeps internal tabs before outbound ones", () => {
		expect(HEADER_TABS.map((tab) => isExternalTab(tab))).toEqual([false, false, false, true, true]);
	});
});

describe("editLinkOf", () => {
	it("sends a synced page to its writing tool, because a GitHub edit would be overwritten", () => {
		expect(editLinkOf("docs", "a.md", { kind: "NOTION", id: "page-1", url: "https://www.notion.so/page-1" })).toEqual({
			editUrl: "https://www.notion.so/page-1",
			editLabel: "Edit in Notion",
		});
	});

	it("keeps GitHub for a page no source owns", () => {
		expect(editLinkOf("blog", "a.md", undefined)).toEqual({ editUrl: `${GITHUB_URL}/blob/main/docs/blog/a.md`, editLabel: "Edit on GitHub" });
	});

	it("falls back to GitHub for a tool with no web address", () => {
		expect(editLinkOf("docs", "a.md", { kind: "NOTION", id: "page-1", url: null }).editLabel).toBe("Edit on GitHub");
	});
});

describe("githubEditUrl", () => {
	it("points at the file on the default branch", () => {
		expect(githubEditUrl("docs", "technical/authorization/overview.md")).toBe(`${GITHUB_URL}/blob/main/docs/technical/authorization/overview.md`);
		expect(githubEditUrl("blog", "telescope.md")).toBe(`${GITHUB_URL}/blob/main/docs/blog/telescope.md`);
	});
});

describe("robots and absolute URLs", () => {
	it("should allow everything and point at the sitemap on the site's origin", () => {
		expect(robotsTxt("https://docs.example.com/base")).toBe("User-agent: *\nAllow: /\n\nSitemap: https://docs.example.com/sitemap.xml\n");
	});

	it("should resolve site paths against the origin and keep absolute URLs", () => {
		expect(absoluteUrl("/docs/README", "https://docs.example.com")).toBe("https://docs.example.com/docs/README");
		expect(absoluteUrl("https://images.example/cover.jpg", "https://docs.example.com")).toBe("https://images.example/cover.jpg");
	});
});
