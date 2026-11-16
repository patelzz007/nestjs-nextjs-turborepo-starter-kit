import { createFilterGroup, createFilterQuery, createFilterRule, type FilterCondition } from "@workspace/ui-kit-logic";

import { filterStaff, staffMatches } from "../examples/filters/filters-7";
import { validateDomain } from "../examples/filters/filters-9";
import { scalarText } from "../examples/filters/filters-sample";

const ADA = { id: "s1", name: "Ada Lovelace", team: "platform", role: "Engineer", years: 6 };

function condition(field: string, operator: string, values: FilterCondition["values"], negated = false): FilterCondition {
	return { path: [field], field, operator, values, negated };
}

describe("scalarText", () => {
	it("reads scalars as text and leaves out no value and dates", () => {
		expect(scalarText("todo")).toBe("todo");
		expect(scalarText(4)).toBe("4");
		expect(scalarText(true)).toBe("true");
		expect(scalarText(null)).toBe("");
		expect(scalarText(undefined)).toBe("");
		expect(scalarText({ date: "2026-11-15" })).toBe("");
	});
});

describe("staffMatches", () => {
	it.each([
		["name", "contains", ["love"], true],
		["name", "contains", ["hopper"], false],
		["name", "not_contains", ["hopper"], true],
		["team", "is_any_of", ["platform", "growth"], true],
		["team", "has_any_of", ["design"], false],
		["team", "is_none_of", ["design"], true],
		["team", "has_none_of", ["platform"], false],
		["years", "gt", [5], true],
		["years", "gte", [6], true],
		["years", "lt", [6], false],
		["years", "lte", [6], true],
		["years", "eq", [6], true],
		["years", "between", [2, 5], false],
		["years", "between", [5, 10], true],
		["years", "starts_with", ["x"], true],
	] satisfies [string, string, FilterCondition["values"], boolean][])("%s %s %j keeps Ada: %s", (field, operator, values, kept) => {
		expect(staffMatches(ADA, condition(field, operator, values))).toBe(kept);
	});

	it("turns a negated condition around", () => {
		expect(staffMatches(ADA, condition("years", "gt", [5], true))).toBe(false);
	});
});

describe("filterStaff", () => {
	it("keeps the rows every complete rule keeps, at any depth", () => {
		const grace = { ...ADA, id: "s2", name: "Grace Hopper", years: 11 };
		const alan = { ...ADA, id: "s3", name: "Alan Turing", team: "growth", years: 3 };
		const query = createFilterQuery([
			createFilterRule({ id: "team", path: ["team"], operator: "has_any_of", value: ["platform"] }),
			createFilterGroup({ id: "g", rules: [createFilterRule({ id: "years", path: ["years"], operator: "gt", value: 8 })] }),
		]);
		expect(filterStaff([ADA, grace, alan], query)).toEqual([grace]);
		expect(filterStaff([ADA, grace, alan], createFilterQuery())).toHaveLength(3);
	});
});

describe("validateDomain", () => {
	it("accepts a domain or nothing, and says why it refuses anything else", () => {
		expect(validateDomain("example.com")).toBeNull();
		expect(validateDomain("@Mail.Example.co")).toBeNull();
		expect(validateDomain(undefined)).toBeNull();
		expect(validateDomain("not a domain")).toBe("Enter a domain, like example.com");
	});
});
