import { describe, expect, it } from "vitest";

import { catalogIssues, catalogMessages, MessageCatalogSchema, type MessageCatalog } from "../message-catalog";

const ENGLISH: MessageCatalog = {
	dialog: { confirm: "Confirm", remove: "Remove {label}", count: "{count, plural, one {# item} other {# items}}", none: "" },
	months: ["January", "February"],
};

describe("catalogIssues", () => {
	it("passes a complete translation that rewords, reorders and pluralises", () => {
		const malay: MessageCatalog = {
			dialog: { confirm: "Sahkan", remove: "Buang {label}", count: "{count, plural, other {# item}}", none: "" },
			months: ["Januari", "Februari"],
		};
		expect(catalogIssues(ENGLISH, malay)).toEqual([]);
	});

	it("names every missing, extra, empty and misshapen entry", () => {
		const broken: MessageCatalog = {
			dialog: { confirm: " ", count: ["#"], none: "", extra: "x" },
			months: ["Januari"],
			added: "y",
		};
		expect(catalogIssues(ENGLISH, broken)).toEqual([
			"dialog.confirm: is empty",
			"dialog.remove: is missing",
			"dialog.count: should be a message",
			"dialog.extra: is not in English",
			"months: has 1 entries, English has 2",
			"added: is not in English",
		]);
	});

	it("refuses a message that drops, renames or retypes a placeholder, or doesn't parse", () => {
		const issues = catalogIssues(
			{ a: "Remove {label}", b: "Remove {label}", c: "{count, plural, one {#} other {#}}", d: "Hello", e: { f: "x" } },
			{ a: "Buang", b: "Buang {name}", c: "{count}", d: "Hello {", e: "flat" },
		);
		expect(issues).toHaveLength(5);
		expect(issues.slice(0, 3).every((issue: string): boolean => issue.includes("takes other values than English's"))).toBe(true);
		expect(issues.at(3)).toMatch(/^d: is not a valid ICU message/u);
		expect(issues.at(4)).toBe("e: should be a group");
	});

	it("checks each list entry as a message", () => {
		expect(catalogIssues({ days: ["Day {n}"] }, { days: ["Hari"] })).toEqual([expect.stringMatching(/^days\[0\]: takes other values/u)]);
		expect(catalogIssues({ days: ["Mon"] }, { days: "Isnin" })).toEqual(["days: should be a list"]);
	});
});

describe("catalogMessages", () => {
	it("lists every message by path, list entries included", () => {
		expect([...catalogMessages(ENGLISH).keys()]).toEqual(["dialog.confirm", "dialog.remove", "dialog.count", "dialog.none", "months[0]", "months[1]"]);
	});
});

describe("MessageCatalogSchema", () => {
	it("accepts nested groups of messages and lists, and nothing else", () => {
		expect(MessageCatalogSchema.safeParse(ENGLISH).success).toBe(true);
		expect(MessageCatalogSchema.safeParse({ a: 1 }).success).toBe(false);
	});
});
