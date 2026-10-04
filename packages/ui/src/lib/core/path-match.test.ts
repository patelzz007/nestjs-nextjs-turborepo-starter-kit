import { describe, expect, it } from "vitest";

import { isPathWithin } from "./path-match";

describe("isPathWithin", () => {
	it("matches the prefix itself and paths below it", () => {
		expect(isPathWithin("/settings", "/settings")).toBe(true);
		expect(isPathWithin("/settings/team", "/settings")).toBe(true);
	});

	it("never matches a look-alike sibling or a parent", () => {
		expect(isPathWithin("/settings-old", "/settings")).toBe(false);
		expect(isPathWithin("/settingsx/team", "/settings")).toBe(false);
		expect(isPathWithin("/", "/settings")).toBe(false);
	});

	it("treats a query or fragment as the end of the path", () => {
		expect(isPathWithin("/rewardhub?tab=1", "/rewardhub")).toBe(true);
		expect(isPathWithin("/rewardhub#top", "/rewardhub")).toBe(true);
	});

	it("lets the root contain only itself", () => {
		expect(isPathWithin("/", "/")).toBe(true);
		expect(isPathWithin("/?a=1", "/")).toBe(true);
		expect(isPathWithin("/settings", "/")).toBe(false);
	});
});
