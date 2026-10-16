// @vitest-environment node
import { describe, expect, it } from "vitest";

import { UI_KIT_LABELS_EN } from "../../../lib/labels/en";
import { filterIssueLabel, stepPlaceholder } from "../filters-i18n";
import {
	FilterDateValueSchema,
	filterNodeDepth,
	FilterQuerySchema,
	FilterRuleSchema,
	filterValueItems,
	FilterValueSchema,
	isFilterDateValue,
	isFilterValueList,
} from "../filters-types";

const LABELS = UI_KIT_LABELS_EN.filters;

describe("filters-types: schemas", () => {
	it("accepts every stored value shape and nothing else", (): void => {
		for (const value of ["a", 3, false, ["a", 1, null], { date: "2024-01-01" }, { relative: { unit: "day", offset: -2 } }]) {
			expect(FilterValueSchema.safeParse(value).success).toBe(true);
		}
		for (const value of [{ date: "01/01/2024" }, { foo: 1 }, Number.POSITIVE_INFINITY, [[1]]]) {
			expect(FilterValueSchema.safeParse(value).success).toBe(false);
		}
		expect(FilterDateValueSchema.safeParse({ date: "2024-01-01", relative: { unit: "day", offset: 0 } }).success).toBe(false);
	});

	it("validates rules strictly and queries recursively", (): void => {
		expect(FilterRuleSchema.safeParse({ id: "r", type: "rule", path: [], operator: "is" }).success).toBe(false);
		expect(FilterRuleSchema.safeParse({ id: "r", type: "rule", path: ["a"], operator: "is", extra: 1 }).success).toBe(false);
		const query = {
			id: "root",
			type: "group",
			combinator: "and",
			rules: [{ id: "g", type: "group", combinator: "or", rules: [{ id: "r", type: "rule", path: ["a"], operator: "" }] }],
		};
		const parsed = FilterQuerySchema.safeParse(query);
		expect(parsed.success).toBe(true);
		expect(parsed.success ? filterNodeDepth(parsed.data) : 0).toBe(3);
	});

	it("narrows values without typeof", (): void => {
		expect(isFilterDateValue({ date: "2024-01-01" })).toBe(true);
		expect(isFilterDateValue("2024-01-01")).toBe(false);
		expect(isFilterValueList(["a"])).toBe(true);
		expect(isFilterValueList("a")).toBe(false);
		expect(filterValueItems(undefined)).toEqual([]);
		expect(filterValueItems("a")).toEqual(["a"]);
		expect(filterValueItems([1, 2])).toEqual([1, 2]);
	});
});

describe("filters-i18n", () => {
	it("names each issue from the labels, a custom one from its own message", (): void => {
		expect(filterIssueLabel("missing-operator", LABELS)).toBe(LABELS.issueOperator);
		expect(filterIssueLabel("incomplete-range", LABELS)).toBe(LABELS.issueRange);
		expect(filterIssueLabel("reversed-range", LABELS)).toBe(LABELS.issueRangeOrder);
		expect(filterIssueLabel("empty-group", LABELS)).toBe(LABELS.issueEmptyGroup);
		expect(filterIssueLabel({ reason: "missing-value" }, LABELS)).toBe(LABELS.issueValue);
		expect(filterIssueLabel({ reason: "custom", message: "Too long" }, LABELS)).toBe("Too long");
	});

	it("picks a step's search placeholder", (): void => {
		expect(stepPlaceholder("field", LABELS)).toBe(LABELS.searchFields);
		expect(stepPlaceholder("operator", LABELS)).toBe(LABELS.searchOperators);
		expect(stepPlaceholder("value", LABELS)).toBe(LABELS.searchOptions);
	});
});
