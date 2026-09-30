import { describe, expect, it } from "vitest";

import { githubEditUrl, GITHUB_URL, HEADER_TABS, isExternalTab, isTabActive, normalizePathname, type HeaderTab } from "./site";

const GUIDES: HeaderTab = { label: "Learning Center", href: "/", activePaths: ["/", "/docs"] };
const EXTERNAL: HeaderTab = { label: "Admin", href: "https://admin.example.com", activePaths: [] };

describe("normalizePathname", () => {
	it("drops the .html suffix and trailing slashes", () => {
		expect(normalizePathname("/docs.html")).toBe("/docs");
		expect(normalizePathname("/docs/")).toBe("/docs");
		expect(normalizePathname("/docs/authorization-system/overview.html")).toBe("/docs/authorization-system/overview");
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
		expect(isTabActive(GUIDES, "/docs/prisma")).toBe(true);
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
		expect(HEADER_TABS.map((tab) => isExternalTab(tab))).toEqual([false, false, true, true]);
	});
});

describe("githubEditUrl", () => {
	it("points at the file on the default branch", () => {
		expect(githubEditUrl("docs", "authorization-system/overview.md")).toBe(`${GITHUB_URL}/blob/main/docs/authorization-system/overview.md`);
		expect(githubEditUrl("blog", "telescope.md")).toBe(`${GITHUB_URL}/blob/main/blog/telescope.md`);
	});
});
