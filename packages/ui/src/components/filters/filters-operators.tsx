import { z } from "zod";

import {
	filterValueItems,
	type FilterField,
	type FilterOperator,
	type FilterOperatorArity,
	type FilterOperatorCatalog,
	type FilterValue,
	type FilterValueItem,
	type FilterValueType,
} from "./filters-types";

/** Every operator the built-in catalog ships, by stored value. */
export const FILTER_BUILT_IN_OPERATORS: readonly [
	"contains",
	"not_contains",
	"starts_with",
	"ends_with",
	"is",
	"is_not",
	"is_any_of",
	"is_none_of",
	"has_any_of",
	"has_all_of",
	"has_none_of",
	"eq",
	"neq",
	"gt",
	"gte",
	"lt",
	"lte",
	"between",
	"not_between",
	"is_before",
	"is_after",
	"is_on_or_before",
	"is_on_or_after",
	"empty",
	"not_empty",
] = [
	"contains",
	"not_contains",
	"starts_with",
	"ends_with",
	"is",
	"is_not",
	"is_any_of",
	"is_none_of",
	"has_any_of",
	"has_all_of",
	"has_none_of",
	"eq",
	"neq",
	"gt",
	"gte",
	"lt",
	"lte",
	"between",
	"not_between",
	"is_before",
	"is_after",
	"is_on_or_before",
	"is_on_or_after",
	"empty",
	"not_empty",
];

export const FilterBuiltInOperatorSchema = z.enum(FILTER_BUILT_IN_OPERATORS);
export type FilterBuiltInOperator = z.infer<typeof FilterBuiltInOperatorSchema>;

/**
 * Every built-in operator's wording, keyed by value. Split from `FilterLabels`
 * (its own label family, `filterOperators`): operator wording is reworded per
 * domain, chrome copy is translated once per app. A consumer's own operators
 * carry their label on `FilterOperator.label`.
 */
export type FilterOperatorLabels = Readonly<Record<FilterBuiltInOperator, string>>;

/** One structural catalog entry: no label, which comes from the labels family. */
export interface FilterOperatorCatalogEntry {
	readonly value: FilterBuiltInOperator;
	readonly arity?: FilterOperatorArity;
	readonly inverse?: FilterBuiltInOperator;
}

/**
 * The operator catalog per value type: value, arity and inverse. `arity` of
 * "none" drops the chip's value segment and the wizard's value step.
 */
export const FILTER_OPERATOR_CATALOG: Readonly<Record<FilterValueType, readonly FilterOperatorCatalogEntry[]>> = {
	text: [
		{ value: "contains", inverse: "not_contains" },
		{ value: "not_contains", inverse: "contains" },
		{ value: "starts_with" },
		{ value: "ends_with" },
		{ value: "is", inverse: "is_not" },
		{ value: "is_not", inverse: "is" },
		{ value: "empty", arity: "none", inverse: "not_empty" },
		{ value: "not_empty", arity: "none", inverse: "empty" },
	],
	number: [
		{ value: "eq", inverse: "neq" },
		{ value: "neq", inverse: "eq" },
		{ value: "gt", inverse: "lte" },
		{ value: "gte", inverse: "lt" },
		{ value: "lt", inverse: "gte" },
		{ value: "lte", inverse: "gt" },
		{ value: "between", arity: "range", inverse: "not_between" },
		{ value: "not_between", arity: "range", inverse: "between" },
		{ value: "empty", arity: "none", inverse: "not_empty" },
		{ value: "not_empty", arity: "none", inverse: "empty" },
	],
	range: [
		{ value: "between", arity: "range", inverse: "not_between" },
		{ value: "not_between", arity: "range", inverse: "between" },
		{ value: "empty", arity: "none", inverse: "not_empty" },
		{ value: "not_empty", arity: "none", inverse: "empty" },
	],
	select: [
		{ value: "is", inverse: "is_not" },
		{ value: "is_not", inverse: "is" },
		{ value: "is_any_of", arity: "many", inverse: "is_none_of" },
		{ value: "is_none_of", arity: "many", inverse: "is_any_of" },
		{ value: "empty", arity: "none", inverse: "not_empty" },
		{ value: "not_empty", arity: "none", inverse: "empty" },
	],
	multiselect: [
		{ value: "has_any_of", arity: "many", inverse: "has_none_of" },
		{ value: "has_all_of", arity: "many" },
		{ value: "has_none_of", arity: "many", inverse: "has_any_of" },
		{ value: "empty", arity: "none", inverse: "not_empty" },
		{ value: "not_empty", arity: "none", inverse: "empty" },
	],
	boolean: [
		{ value: "is", inverse: "is_not" },
		{ value: "is_not", inverse: "is" },
		{ value: "empty", arity: "none", inverse: "not_empty" },
		{ value: "not_empty", arity: "none", inverse: "empty" },
	],
};

export const DEFAULT_FILTER_VALUE_TYPE: FilterValueType = "text";

/** The arity an operator has when it does not say: one value. */
export const DEFAULT_FILTER_ARITY: FilterOperatorArity = "one";

/**
 * Builds the operator catalog for one set of labels. Callers memoize on the
 * label object, so translating one operator never restates the catalog.
 */
export function createFilterOperators(labels: FilterOperatorLabels): FilterOperatorCatalog {
	const build = (type: FilterValueType): readonly FilterOperator[] =>
		FILTER_OPERATOR_CATALOG[type].map((entry: FilterOperatorCatalogEntry): FilterOperator => ({
			value: entry.value,
			label: labels[entry.value],
			arity: entry.arity ?? DEFAULT_FILTER_ARITY,
			inverse: entry.inverse,
		}));
	return {
		text: build("text"),
		number: build("number"),
		range: build("range"),
		select: build("select"),
		multiselect: build("multiselect"),
		boolean: build("boolean"),
	};
}

/**
 * The operators for a field: its own `operators` wins, list or function,
 * otherwise the catalog entry for its `type`.
 */
export function resolveFilterOperators(field: FilterField, catalog: FilterOperatorCatalog): readonly FilterOperator[] {
	const { operators } = field;
	if (operators === undefined) {
		return catalog[field.type ?? DEFAULT_FILTER_VALUE_TYPE];
	}
	if (isOperatorList(operators)) {
		return operators;
	}
	return operators(field);
}

function isOperatorList(operators: readonly FilterOperator[] | ((field: FilterField) => readonly FilterOperator[])): operators is readonly FilterOperator[] {
	return z.instanceof(Array).safeParse(operators).success;
}

export function visibleFilterOperators(operators: readonly FilterOperator[]): readonly FilterOperator[] {
	return operators.filter((operator: FilterOperator): boolean => operator.hidden !== true);
}

export function getFilterOperator(operators: readonly FilterOperator[], value: string | null | undefined): FilterOperator | undefined {
	if (value === null || value === undefined || value === "") {
		return undefined;
	}
	return operators.find((operator: FilterOperator): boolean => operator.value === value);
}

export function getFilterArity(operator: FilterOperator | undefined): FilterOperatorArity {
	return operator?.arity ?? DEFAULT_FILTER_ARITY;
}

export function operatorTakesValue(operator: FilterOperator | undefined): boolean {
	return getFilterArity(operator) !== "none";
}

/**
 * The operator a field starts with: `defaultOperator` when it names one the
 * field offers, otherwise the first visible operator.
 */
export function getDefaultFilterOperator(field: FilterField, operators: readonly FilterOperator[]): string | null {
	const named = getFilterOperator(operators, field.defaultOperator);
	if (named !== undefined) {
		return named.value;
	}
	const [firstVisible] = visibleFilterOperators(operators);
	const [first] = operators;
	return firstVisible?.value ?? first?.value ?? null;
}

export interface FilterNegation {
	readonly operator: string | null;
	readonly negated: boolean;
}

/**
 * Negating a rule: swap to the declared `inverse` so the chip reads "does not
 * contain", else toggle `negated` so Negate still works without an inverse.
 */
export function negateFilterOperator(operator: FilterOperator | undefined, operators: readonly FilterOperator[], negated: boolean | undefined): FilterNegation {
	const inverse = getFilterOperator(operators, operator?.inverse);
	if (inverse !== undefined) {
		return { operator: inverse.value, negated: negated === true };
	}
	return { operator: operator?.value ?? null, negated: negated !== true };
}

/**
 * Reshapes a value when arity changes: widening "is" to "is any of" keeps what
 * the user picked, narrowing keeps the first of them, `"none"` always drops it.
 */
export function coerceFilterValue(value: FilterValue | undefined, from: FilterOperator | undefined, to: FilterOperator | undefined): FilterValue | undefined {
	const nextArity = getFilterArity(to);
	if (nextArity === "none" || value === undefined) {
		return undefined;
	}
	if (getFilterArity(from) === nextArity) {
		return value;
	}
	const items = filterValueItems(value);
	const [first = null, second = null] = items;
	switch (nextArity) {
		case "many":
			return items;
		case "range":
			return [first, second];
		case "one":
			return singleItem(first);
		default:
			return assertNeverFilterArity(nextArity);
	}
}

function singleItem(item: FilterValueItem): FilterValue | undefined {
	return item ?? undefined;
}

function assertNeverFilterArity(value: never): never {
	throw new Error(`Unhandled filter operator arity: ${JSON.stringify(value)}`);
}
