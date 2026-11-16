import type { FilterOperator } from "@workspace/ui-kit-logic";

import {
	DEFAULT_FILTER_LABELS,
	DEFAULT_FILTER_OPERATORS,
	filterBarFieldAt,
	filterBarPathLabel,
	filterBarValueText,
	searchFilterBarFields,
	type FilterBarField,
} from "../filters";

const NOW = new Date(2026, 10, 15, 12);

const FIELDS: readonly FilterBarField[] = [
	{ id: "status", label: "Status", type: "select", options: [{ value: "todo", label: "To Do" }] },
	{ id: "spend", label: "Spend", type: "number", unit: " $/mo" },
	{
		id: "address",
		label: "Address",
		fields: [
			{ id: "city", label: "City", type: "text" },
			{ id: "postcode", label: "Postcode", type: "text", keywords: ["zip"] },
			{ id: "legacy", label: "Old zip", type: "text", disabled: true },
		],
	},
	{ id: "empty", label: "Empty branch", fields: [] },
];

const RANGE: FilterOperator = { value: "between", label: "is between", arity: "range" };
const IS: FilterOperator = { value: "is", label: "is" };

describe("the native filter defaults", () => {
	it("speak English and offer operators for every value type", () => {
		expect(DEFAULT_FILTER_LABELS.addFilter).toBe("Add filter");
		expect(DEFAULT_FILTER_OPERATORS.text.length).toBeGreaterThan(0);
	});
});

describe("filterBarFieldAt", () => {
	it("finds a field at the top, inside a branch, or nothing", () => {
		expect(filterBarFieldAt(FIELDS, ["status"])?.label).toBe("Status");
		expect(filterBarFieldAt(FIELDS, ["address", "city"])?.label).toBe("City");
		expect(filterBarFieldAt(FIELDS, ["status", "city"])).toBeUndefined();
		expect(filterBarFieldAt(FIELDS, ["missing"])).toBeUndefined();
	});
});

describe("filterBarPathLabel", () => {
	it("joins the labels along a path, or the ids when a step is unknown", () => {
		expect(filterBarPathLabel(FIELDS, ["address", "city"], " › ")).toBe("Address › City");
		expect(filterBarPathLabel(FIELDS, ["address", "town"], " › ")).toBe("address › town");
		expect(filterBarPathLabel(FIELDS, ["status", "deeper"], "/")).toBe("status/deeper");
	});
});

describe("filterBarValueText", () => {
	const status = filterBarFieldAt(FIELDS, ["status"]);
	const spend = filterBarFieldAt(FIELDS, ["spend"]);

	it("says nothing for no value, and defers to the field's own words", () => {
		expect(filterBarValueText(undefined, status, IS, DEFAULT_FILTER_LABELS, NOW)).toBe("");
		expect(filterBarValueText("todo", { id: "x", label: "X", valueText: (): string => "custom" }, IS, DEFAULT_FILTER_LABELS, NOW)).toBe("custom");
	});

	it("names options, adds units, and reads booleans, blanks and dates", () => {
		expect(filterBarValueText("todo", status, IS, DEFAULT_FILTER_LABELS, NOW)).toBe("To Do");
		expect(filterBarValueText("other", status, IS, DEFAULT_FILTER_LABELS, NOW)).toBe("other");
		expect(filterBarValueText(40, spend, IS, DEFAULT_FILTER_LABELS, NOW)).toBe("40 $/mo");
		expect(filterBarValueText(40, undefined, undefined, DEFAULT_FILTER_LABELS, NOW)).toBe("40");
		expect(filterBarValueText(true, undefined, IS, DEFAULT_FILTER_LABELS, NOW)).toBe(DEFAULT_FILTER_LABELS.booleanTrue);
		expect(filterBarValueText(false, undefined, IS, DEFAULT_FILTER_LABELS, NOW)).toBe(DEFAULT_FILTER_LABELS.booleanFalse);
		expect(filterBarValueText([null], undefined, IS, DEFAULT_FILTER_LABELS, NOW)).toBe(DEFAULT_FILTER_LABELS.noValue);
		expect(filterBarValueText({ relative: { unit: "day", offset: 0 } }, undefined, IS, DEFAULT_FILTER_LABELS, NOW)).toBe(
			DEFAULT_FILTER_LABELS.relativeDate({ unit: "day", offset: 0 }),
		);
	});

	it("reads a range as its two bounds, filling a missing one, and counts picks past two", () => {
		expect(filterBarValueText([1, 5], spend, RANGE, DEFAULT_FILTER_LABELS, NOW)).toBe(DEFAULT_FILTER_LABELS.valueRange("1 $/mo", "5 $/mo"));
		expect(filterBarValueText([], spend, RANGE, DEFAULT_FILTER_LABELS, NOW)).toBe(DEFAULT_FILTER_LABELS.valueRange("", ""));
		expect(filterBarValueText(["a", "b"], undefined, IS, DEFAULT_FILTER_LABELS, NOW)).toBe("a, b");
		expect(filterBarValueText(["a", "b", "c"], undefined, IS, DEFAULT_FILTER_LABELS, NOW)).toBe(DEFAULT_FILTER_LABELS.valueCount(3));
	});
});

describe("searchFilterBarFields", () => {
	it("finds enabled leaves at any depth by label or keyword, ignoring case", () => {
		expect(searchFilterBarFields(FIELDS, "ZIP").map((match) => match.path)).toEqual([["address", "postcode"]]);
		expect(searchFilterBarFields(FIELDS, "city").map((match) => match.field.label)).toEqual(["City"]);
		expect(searchFilterBarFields(FIELDS, "old")).toEqual([]);
	});

	it("treats a branch with no fields as a leaf, as the web does", () => {
		expect(searchFilterBarFields(FIELDS, "branch").map((match) => match.path)).toEqual([["empty"]]);
	});

	it("stops at the limit", () => {
		expect(searchFilterBarFields(FIELDS, "", 2)).toHaveLength(2);
		expect(searchFilterBarFields(FIELDS, "")).toHaveLength(5);
	});
});
