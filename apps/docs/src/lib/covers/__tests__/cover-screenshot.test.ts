import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { coverScreenshot, coverScreenshotNames, guideWords, isPhoneScreenshot } from "../cover-screenshot";

const SCREENSHOTS = fileURLToPath(new URL("../../../../../../docs/images/readme/", import.meta.url));

describe("guideWords", () => {
	it("splits the path into folders and hyphenated words, keeps whole segments, and adds the tags in lower case", () => {
		expect([...guideWords("technical/api/list-queries", ["Pagination"])]).toEqual(["technical", "api", "list-queries", "list", "queries", "pagination"]);
	});
});

describe("isPhoneScreenshot", () => {
	it("is true only for the mobile app's screens", () => {
		expect(isPhoneScreenshot("mobile-home-dark")).toBe(true);
		expect(isPhoneScreenshot("admin-home-dark")).toBe(false);
	});
});

describe("coverScreenshot", () => {
	it.each([
		["a mobile guide by its topic", "technical/mobile/passkeys-on-a-phone", [], "mobile-security-dark"],
		["a mobile guide no mobile rule matches", "technical/mobile/mobile-app", ["expo"], "mobile-home-dark"],
		["a guide by a word of its path", "technical/kanban", [], "admin-kanban-dark"],
		["a guide by a tag", "adr/085-customer-tiers", ["adr", "tiers"], "web-reward"],
		["a specific rule before a broad one", "technical/api-reference/webhooks", ["api", "reference"], "merchant-webhooks"],
		["an ADR no rule matches, by its folder", "adr/999-something", ["adr"], "docs-adr-dark"],
		["a user guide no rule matches, by its folder", "user-guide/99-misc", [], "docs-user-guide"],
		["a page outside the folders", "README", [], "docs-home-dark"],
	])("picks the screen for %s", (_case, slug, tags, screenshot) => {
		expect(coverScreenshot(slug, tags)).toBe(screenshot);
	});

	it("only ever names screenshots that exist", () => {
		expect([...coverScreenshotNames()].filter((name) => !existsSync(`${SCREENSHOTS}${name}.webp`))).toEqual([]);
	});
});
