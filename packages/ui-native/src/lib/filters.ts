// The native filter bar's own rules, beside the ones it shares with the web (@workspace/ui-kit-logic `filters`: the
// query model, operators, drafts, dates, copy): its English copy and operators, built by the shared builders; the
// fields and options it offers (with Lucide icons and React Native editors); finding a field by its path; and the
// text a rule's value reads as on a chip and to a screen reader.

import { formatMessage } from "@workspace/shared";
import {
	buildFilterLabels,
	createFilterOperators,
	FILTER_MESSAGES_EN,
	FILTER_OPERATOR_LABELS_EN,
	filterValueItems,
	foldFilterText,
	formatFilterDate,
	normalizeFilterQuery,
	isFilterDateValue,
	type FilterLabels,
	type FilterOperator,
	type FilterOperatorCatalog,
	type FilterOperatorSource,
	type FilterValue,
	type FilterValueItem,
} from "@workspace/ui-kit-logic";
import type * as React from "react";

import type { LucideIcon } from "../components/icon";

export const DEFAULT_FILTER_LABELS: FilterLabels = buildFilterLabels(FILTER_MESSAGES_EN, (message, values): string => formatMessage("en", message, values));

export const DEFAULT_FILTER_OPERATORS: FilterOperatorCatalog = createFilterOperators(FILTER_OPERATOR_LABELS_EN);

/** One choice of a select or multiselect field. */
export interface FilterBarOption {
	readonly value: string;
	readonly label: string;
	readonly icon?: LucideIcon | undefined;
	/** Before the label in place of a glyph: an avatar, a colour swatch. */
	readonly leading?: React.ReactNode | undefined;
	readonly description?: string | undefined;
	/** Other words the search matches ("zip" for "postcode"). */
	readonly keywords?: readonly string[] | undefined;
	readonly disabled?: boolean | undefined;
	/** Picking it clears every other pick ("Unassigned"), and picking another clears it. */
	readonly exclusive?: boolean | undefined;
}

/** What a custom editor gets: the field, the operator, the value so far, and a way to change it. */
export interface FilterBarEditorProps {
	readonly field: FilterBarField;
	readonly operator: FilterOperator;
	readonly value: FilterValue | undefined;
	readonly onValueChange: (value: FilterValue | undefined) => void;
	readonly labels: FilterLabels;
}

export type FilterBarEditor = React.ComponentType<FilterBarEditorProps>;

/** A field the bar can filter on, or a branch of fields (`fields`). */
export interface FilterBarField extends FilterOperatorSource<FilterBarField> {
	readonly id: string;
	readonly label: string;
	readonly icon?: LucideIcon | undefined;
	readonly description?: string | undefined;
	readonly keywords?: readonly string[] | undefined;
	/** A branch: the fields under it (picked by drilling in). */
	readonly fields?: readonly FilterBarField[] | undefined;
	readonly disabled?: boolean | undefined;
	readonly options?: readonly FilterBarOption[] | undefined;
	/** Options fetched as the person searches. */
	readonly loadOptions?: ((query: string) => Promise<readonly FilterBarOption[]>) | undefined;
	/** The options for values no search has loaded yet (a restored query's ids), so a chip can name them. */
	readonly resolveValues?: ((values: readonly string[]) => Promise<readonly FilterBarOption[]>) | undefined;
	readonly placeholder?: string | undefined;
	/** After a number ("/mo"). */
	readonly unit?: string | undefined;
	/** The value editor in place of the default for the field's type. */
	readonly editor?: FilterBarEditor | undefined;
	/** The value as words, in place of the default. */
	readonly valueText?: ((value: FilterValue) => string) | undefined;
	/** A message when a value is not accepted (`null` when it is). */
	readonly validate?: ((value: FilterValue | undefined) => string | null) | undefined;
}

/** The field a rule's path names, walking into branches; `undefined` for a path the fields do not have. */
export function filterBarFieldAt(fields: readonly FilterBarField[], path: readonly string[]): FilterBarField | undefined {
	const [head, ...rest] = path;
	const field = fields.find((candidate): boolean => candidate.id === head);
	if (field === undefined || rest.length === 0) {
		return field;
	}
	return filterBarFieldAt(field.fields ?? [], rest);
}

/** The labels along a rule's path ("Address › City"), for a chip and a screen reader. */
export function filterBarPathLabel(fields: readonly FilterBarField[], path: readonly string[], separator: string): string {
	const labels: string[] = [];
	let level = fields;
	for (const id of path) {
		const field = level.find((candidate): boolean => candidate.id === id);
		if (field === undefined) {
			return path.join(separator);
		}
		labels.push(field.label);
		level = field.fields ?? [];
	}
	return labels.join(separator);
}

function itemText(item: FilterValueItem, field: FilterBarField | undefined, labels: FilterLabels, now: Date): string {
	if (item === null) {
		return labels.noValue;
	}
	if (isFilterDateValue(item)) {
		return formatFilterDate(item, labels, now);
	}
	if (item === true || item === false) {
		return item ? labels.booleanTrue : labels.booleanFalse;
	}
	const option = field?.options?.find((candidate): boolean => candidate.value === String(item));
	if (option !== undefined) {
		return option.label;
	}
	return field?.unit === undefined ? String(item) : `${String(item)}${field.unit}`;
}

/** Between the picks a chip names. */
const LIST_SEPARATOR = ", ";

/** How many picks a chip names before it says "n values". */
const NAMED_PICKS = 2;

/**
 * A rule's value as words: the field's own `valueText`, else option labels (a count past two), a range as "from – to",
 * a date as a day or a relative phrase, a number with its unit.
 */
export function filterBarValueText(
	value: FilterValue | undefined,
	field: FilterBarField | undefined,
	operator: FilterOperator | undefined,
	labels: FilterLabels,
	now: Date,
): string {
	if (value === undefined) {
		return "";
	}
	if (field?.valueText !== undefined) {
		return field.valueText(value);
	}
	const items = filterValueItems(value);
	const texts = items.map((item): string => itemText(item, field, labels, now));
	if (operator?.arity === "range") {
		const [from = "", to = ""] = texts;
		return labels.valueRange(from, to);
	}
	if (texts.length > NAMED_PICKS) {
		return labels.valueCount(texts.length);
	}
	return texts.join(LIST_SEPARATOR);
}

/** A field the search found, with its path from the top. */
export interface FilterBarFieldMatch {
	readonly field: FilterBarField;
	readonly path: readonly string[];
}

/** How many matches the field search lists at most. */
export const FILTER_BAR_SEARCH_LIMIT = 50;

/**
 * The pickable fields (leaves, not disabled) at any depth whose label or keywords hold `query`, ignoring case, depth
 * first, at most `limit` of them.
 */
export function searchFilterBarFields(fields: readonly FilterBarField[], query: string, limit: number = FILTER_BAR_SEARCH_LIMIT): readonly FilterBarFieldMatch[] {
	const needle = normalizeFilterQuery(query);
	const matches: FilterBarFieldMatch[] = [];
	const walk = (level: readonly FilterBarField[], trail: readonly string[]): void => {
		for (const field of level) {
			if (matches.length >= limit) {
				return;
			}
			const path = [...trail, field.id];
			if ((field.fields ?? []).length > 0) {
				walk(field.fields ?? [], path);
			} else if (field.disabled !== true && [field.label, ...(field.keywords ?? [])].some((text): boolean => foldFilterText(text).includes(needle))) {
				matches.push({ field, path });
			}
		}
	};
	walk(fields, []);
	return matches;
}
