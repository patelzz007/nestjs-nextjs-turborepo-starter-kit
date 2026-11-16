// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
	coerceFilterValue,
	createFilterOperators,
	FILTER_BUILT_IN_OPERATORS,
	FILTER_OPERATOR_CATALOG,
	getDefaultFilterOperator,
	getFilterArity,
	getFilterOperator,
	negateFilterOperator,
	operatorTakesValue,
	resolveFilterOperators,
	visibleFilterOperators,
} from "../filters-operators";
import { FILTER_OPERATOR_LABELS_EN } from "../filters-messages";
import { FILTER_VALUE_TYPES, type FilterOperator, type FilterValueType } from "../filters-model";
import type { FilterOperatorSource } from "../filters-operators";

const CATALOG = createFilterOperators(FILTER_OPERATOR_LABELS_EN);

/** A kit's field as the operator rules read it (each kit's own field type has this shape and more). */
interface FilterField extends FilterOperatorSource<FilterField> {
	readonly id: string;
	readonly label: string;
}

/** A field, checked as one (an object literal passed straight to a generic would be read as its own type). */
function asField(field: FilterField): FilterField {
	return field;
}

function values(list: readonly FilterOperator[]): string[] {
	return list.map((operator: FilterOperator): string => operator.value);
}

const CUSTOM: readonly FilterOperator[] = [
	{ value: "near", label: "is near" },
	{ value: "secret", label: "secret", hidden: true },
];

function customOperators(): readonly FilterOperator[] {
	return CUSTOM;
}

describe("filters-operators", () => {
	it("builds every value type's catalog with labels from the label pack", (): void => {
		for (const type of FILTER_VALUE_TYPES) {
			expect(CATALOG[type].length).toBe(FILTER_OPERATOR_CATALOG[type].length);
		}
		expect(getFilterOperator(CATALOG.text, "not_contains")?.label).toBe("does not contain");
		expect(getFilterOperator(CATALOG.number, "between")?.arity).toBe("range");
		expect(getFilterOperator(CATALOG.multiselect, "has_any_of")?.arity).toBe("many");
		expect(getFilterOperator(CATALOG.boolean, "empty")?.arity).toBe("none");
		expect(Object.keys(FILTER_OPERATOR_LABELS_EN).sort()).toEqual([...FILTER_BUILT_IN_OPERATORS].sort());
	});

	it("re-labels one operator without restating the catalog", (): void => {
		const catalog = createFilterOperators({ ...FILTER_OPERATOR_LABELS_EN, contains: "includes" });
		expect(getFilterOperator(catalog.text, "contains")?.label).toBe("includes");
	});

	it.each<[FilterValueType, string]>([
		["text", "contains"],
		["number", "eq"],
		["range", "between"],
		["select", "is"],
		["multiselect", "has_any_of"],
		["boolean", "is"],
	])("starts a %s field on %s", (type: FilterValueType, expected: string): void => {
		const field: FilterField = { id: "f", label: "F", type };
		expect(getDefaultFilterOperator(field, resolveFilterOperators(field, CATALOG))).toBe(expected);
	});

	it("prefers a field's own operators, list or function", (): void => {
		expect(values(resolveFilterOperators(asField({ id: "f", label: "F", operators: CUSTOM }), CATALOG))).toEqual(["near", "secret"]);
		expect(values(resolveFilterOperators(asField({ id: "f", label: "F", operators: customOperators }), CATALOG))).toEqual(["near", "secret"]);
		expect(values(resolveFilterOperators(asField({ id: "f", label: "F" }), CATALOG))).toEqual(values(CATALOG.text));
		expect(values(visibleFilterOperators(CUSTOM))).toEqual(["near"]);
	});

	it("honours a valid defaultOperator and falls back from an unknown one", (): void => {
		expect(getDefaultFilterOperator(asField({ id: "f", label: "F", defaultOperator: "ends_with" }), CATALOG.text)).toBe("ends_with");
		expect(getDefaultFilterOperator(asField({ id: "f", label: "F", defaultOperator: "nope" }), CATALOG.text)).toBe("contains");
		expect(getDefaultFilterOperator(asField({ id: "f", label: "F" }), [])).toBeNull();
	});

	it("reads arity with a one-value default", (): void => {
		expect(getFilterArity(undefined)).toBe("one");
		expect(operatorTakesValue(getFilterOperator(CATALOG.text, "empty"))).toBe(false);
		expect(operatorTakesValue(getFilterOperator(CATALOG.text, "is"))).toBe(true);
		expect(getFilterOperator(CATALOG.text, "")).toBeUndefined();
	});

	it("negates to the inverse, else toggles the negated flag", (): void => {
		expect(negateFilterOperator(getFilterOperator(CATALOG.text, "contains"), CATALOG.text, undefined)).toEqual({ operator: "not_contains", negated: false });
		expect(negateFilterOperator(getFilterOperator(CATALOG.text, "starts_with"), CATALOG.text, undefined)).toEqual({ operator: "starts_with", negated: true });
		expect(negateFilterOperator(getFilterOperator(CATALOG.text, "starts_with"), CATALOG.text, true)).toEqual({ operator: "starts_with", negated: false });
	});

	it("reshapes a value when the arity changes", (): void => {
		const is = getFilterOperator(CATALOG.select, "is");
		const anyOf = getFilterOperator(CATALOG.select, "is_any_of");
		const between = getFilterOperator(CATALOG.number, "between");
		const empty = getFilterOperator(CATALOG.select, "empty");
		expect(coerceFilterValue("a", is, anyOf)).toEqual(["a"]);
		expect(coerceFilterValue(["a", "b"], anyOf, is)).toBe("a");
		expect(coerceFilterValue(5, is, between)).toEqual([5, null]);
		expect(coerceFilterValue("a", is, empty)).toBeUndefined();
		expect(coerceFilterValue("a", is, is)).toBe("a");
		expect(coerceFilterValue(undefined, is, anyOf)).toBeUndefined();
		expect(coerceFilterValue([], anyOf, is)).toBeUndefined();
	});
});
