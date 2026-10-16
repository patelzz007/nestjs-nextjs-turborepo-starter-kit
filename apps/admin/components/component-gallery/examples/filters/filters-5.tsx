"use client";

import { CalendarIcon, CalendarRangeIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Filters } from "@workspace/ui/components/filters/filters";
import { formatFilterDate, parseFilterDate, RELATIVE_TODAY, resolveFilterDate, toFilterDateValue } from "@workspace/ui/components/filters/filters-date";
import type { FilterOperatorCatalogEntry, FilterOperatorLabels } from "@workspace/ui/components/filters/filters-operators";
import { createFilterQuery, createFilterRule } from "@workspace/ui/components/filters/filters-query";
import {
	isFilterDateValue,
	isFilterValueList,
	type FilterDateValue,
	type FilterEditorProps,
	type FilterField,
	type FilterLabels,
	type FilterOperator,
	type FilterQuery,
	type FilterValue,
	type FilterValueDisplayContext,
} from "@workspace/ui/components/filters/filters-types";
import { Input } from "@workspace/ui/components/input";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";

/* -------------------------------------------------------------------------- */
/*                                  Values                                    */
/* -------------------------------------------------------------------------- */

/**
 * Two date values: what an `arity: "range"` operator carries, matching how
 * every other range in the primitive is stored — a plain list the host
 * normalises to `values` for free.
 */
type DateRangeValue = readonly [from: FilterDateValue, to: FilterDateValue];

/** The calendar's range selection, as the Calendar's `range` mode hands it over. */
interface CalendarRange {
	readonly from: Date | undefined;
	readonly to?: Date | undefined;
}

/** The clock, read at the display edge only. The date helpers take `now` explicitly. */
function readClock(): Date {
	return new Date();
}

/** The one date a single-date operator holds, or the start of a stored range. */
function singleDateOf(value: FilterValue | undefined): FilterDateValue | undefined {
	if (isFilterDateValue(value)) return value;
	if (isFilterValueList(value)) {
		const [first] = value;
		return isFilterDateValue(first) ? first : undefined;
	}
	return undefined;
}

/** Both bounds of a stored range, or undefined until both are dates. */
function dateRangeOf(value: FilterValue | undefined): DateRangeValue | undefined {
	if (!isFilterValueList(value)) return undefined;
	const [from, to] = value;
	return isFilterDateValue(from) && isFilterDateValue(to) ? [from, to] : undefined;
}

/* -------------------------------------------------------------------------- */
/*                              Panel geometry                                */
/* -------------------------------------------------------------------------- */

/**
 * The grid IS the panel's width, and its height is the whole budget.
 *
 * The chip's value popover is `w-auto`, so whatever this editor measures, the
 * popover measures. An earlier version put a fixed `w-72` on the panel and left
 * the calendar at its natural size inside it, and a calendar is seven columns
 * of `--cell-size`: 224px in most styles, 196 in nova and lyra, 168 in mira,
 * never 288. So every style drew a strip of empty popover down one side of the
 * grid. The cell is PINNED here instead, so seven of them is a width this file
 * knows, and the calendar's own padding goes to zero because the panel already
 * carries some.
 *
 * The row gap is the height half, and it was the one that overflowed. The
 * shadcn calendar gives every week `mt-2`, so a 28px cell runs on a 36px pitch:
 * flush across, airy down, and six of those gaps are 48px of a popover that has
 * roughly 380 to spend before it flips up over the bar it is anchored to. The
 * two arbitrary variants below out-specify the defaults they replace (both are
 * a descendant selector against a bare utility class), so the grid tightens
 * without the primitive being touched. `tbody tr` rather than `.rdp-week`
 * because the table is the calendar's own markup, not a class name it happens
 * to carry.
 *
 * One constant, both panels: a single date and a range are the same grid at the
 * same density, and the range simply draws two of them.
 */
const DAY_GRID = "p-0 [--cell-size:--spacing(7)] [&_.rdp-month]:gap-2 [&_tbody_tr]:mt-1";

/* -------------------------------------------------------------------------- */
/*                                One date                                    */
/* -------------------------------------------------------------------------- */

/**
 * Two ways to say one day, and no third.
 *
 * A box that parses a phrase and a grid that takes a click. The placeholder is
 * what carries the vocabulary, which is where a control's own instructions
 * belong.
 */
function SingleDateBody({ value, onValueChange, commit, cancel, autoFocusProps, field, labels }: FilterEditorProps): React.JSX.Element {
	const [now] = React.useState<Date>(readClock);
	const current = singleDateOf(value);
	const [text, setText] = React.useState<string>((): string => formatFilterDate(current, labels, now));
	const selected = resolveFilterDate(current, now) ?? undefined;
	// A CONTROLLED month WITH its `onMonthChange`: a controlled month without one
	// is a calendar whose arrows do nothing.
	const [month, setMonth] = React.useState<Date>(selected ?? now);

	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			setText(event.target.value);
			// Null means nothing matched, so a half-typed phrase never wipes the
			// value the user already had.
			const parsed = parseFilterDate(event.target.value, now);
			if (parsed !== null) onValueChange(parsed);
		},
		[now, onValueChange],
	);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>): void => {
			if (event.key === "Enter") {
				event.preventDefault();
				commit(parseFilterDate(text, now) ?? current);
			}
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				cancel();
			}
		},
		[cancel, commit, current, now, text],
	);

	// A day is a COMPLETE pick, so it commits rather than waiting for an Apply:
	// both a typed phrase and a click on a day finish the filter. Escape and a
	// click outside still leave without writing.
	const handleSelect = React.useCallback(
		(date: Date | undefined): void => {
			if (date !== undefined) commit(toFilterDateValue(date));
		},
		[commit],
	);

	return (
		<div className="flex flex-col gap-2 p-2">
			<Input {...autoFocusProps} value={text} placeholder="today, next friday..." aria-label={field.label} onChange={handleChange} onKeyDown={handleKeyDown} />
			<Calendar mode="single" className={DAY_GRID} selected={selected} month={month} onMonthChange={setMonth} onSelect={handleSelect} />
		</div>
	);
}

/* -------------------------------------------------------------------------- */
/*                                Two dates                                   */
/* -------------------------------------------------------------------------- */

/** Days back from today that open the "last 7 days" window (today counts as one). */
const LAST_7_DAYS_OFFSET = -6;
/** Days back from today that open the "last 30 days" window. */
const LAST_30_DAYS_OFFSET = -29;
/** The range editor draws two months side by side. */
const RANGE_MONTHS = 2;

const TODAY: FilterDateValue = { relative: RELATIVE_TODAY };
const LAST_7_DAYS: DateRangeValue = [{ relative: { unit: "day", offset: LAST_7_DAYS_OFFSET } }, TODAY];
const LAST_30_DAYS: DateRangeValue = [{ relative: { unit: "day", offset: LAST_30_DAYS_OFFSET } }, TODAY];

interface RangePreset {
	readonly label: string;
	readonly range: DateRangeValue;
}

/** Relative on both ends, so a saved view keeps meaning "the last 7 days". */
const RANGE_PRESETS: readonly RangePreset[] = [
	{ label: "Last 7 days", range: LAST_7_DAYS },
	{ label: "Last 30 days", range: LAST_30_DAYS },
];

interface RangePresetButtonProps {
	readonly preset: RangePreset;
	readonly commit: FilterEditorProps["commit"];
}

function RangePresetButton({ preset, commit }: RangePresetButtonProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		commit(preset.range);
	}, [commit, preset.range]);
	return (
		<Button variant="outline" size="sm" onClick={handleClick}>
			{preset.label}
		</Button>
	);
}

/**
 * The first preset is the panel's first focusable element, which is where the
 * host's popover moves focus when it opens, so it needs no autofocus marker.
 */
function CalendarRangeBody({ value, onValueChange, commit, cancel, labels }: FilterEditorProps): React.JSX.Element {
	const [now] = React.useState<Date>(readClock);
	const bounds = dateRangeOf(value);
	const [fromValue, toValue] = bounds ?? [];
	const from = resolveFilterDate(fromValue, now) ?? undefined;
	const to = resolveFilterDate(toValue, now) ?? undefined;
	const selected = React.useMemo((): CalendarRange => ({ from, to }), [from, to]);
	const [month, setMonth] = React.useState<Date>(from ?? now);

	const handleSelect = React.useCallback(
		(range: CalendarRange | undefined): void => {
			if (range?.from === undefined) return;
			const next: DateRangeValue = [toFilterDateValue(range.from), toFilterDateValue(range.to ?? range.from)];
			onValueChange(next);
		},
		[onValueChange],
	);
	const handleApply = React.useCallback((): void => {
		commit();
	}, [commit]);

	return (
		<div className="flex flex-col gap-2 p-2">
			<div className="grid grid-cols-2 gap-1.5">
				{RANGE_PRESETS.map((preset: RangePreset): React.JSX.Element => (
					<RangePresetButton key={preset.label} preset={preset} commit={commit} />
				))}
			</div>

			<Calendar mode="range" numberOfMonths={RANGE_MONTHS} className={DAY_GRID} selected={selected} month={month} onMonthChange={setMonth} onSelect={handleSelect} />

			{/*
				A range keeps its confirm, for the reason the primitive's own range
				editor gives: it takes TWO clicks to say, and a panel that closed on the
				first one would commit a bound the user had not finished choosing.
			*/}
			<div className="-mx-2 flex items-center justify-end gap-1.5 border-t px-2 pt-2">
				<Button variant="ghost" size="sm" onClick={cancel}>
					{labels.discard}
				</Button>
				<Button size="sm" disabled={bounds === undefined} onClick={handleApply}>
					{labels.apply}
				</Button>
			</div>
		</div>
	);
}

/**
 * A date control the CONSUMER owns.
 *
 * The primitive deliberately ships no date editor: every product wants a
 * different one. An editor is a plain component that receives the draft value,
 * the chosen OPERATOR and what commit means, so this one reads the operator's
 * arity and shows one calendar or two without the primitive knowing anything
 * about dates.
 */
function DateEditor(props: FilterEditorProps): React.JSX.Element {
	const { operator } = props;
	return operator.arity === "range" ? <CalendarRangeBody {...props} /> : <SingleDateBody {...props} />;
}

/* -------------------------------------------------------------------------- */
/*                                   Schema                                   */
/* -------------------------------------------------------------------------- */

/**
 * Dates need their own operator set, since the core catalog has no date type.
 * The STRUCTURE is written here; the wording comes from the `filterOperators`
 * label family, so it translates with the rest of the bar.
 */
const DATE_OPERATOR_ENTRIES: readonly FilterOperatorCatalogEntry[] = [
	{ value: "is", inverse: "is_not" },
	{ value: "is_not", inverse: "is" },
	{ value: "is_before", inverse: "is_on_or_after" },
	{ value: "is_after", inverse: "is_on_or_before" },
	{ value: "is_on_or_before", inverse: "is_after" },
	{ value: "is_on_or_after", inverse: "is_before" },
	{ value: "between", arity: "range", inverse: "not_between" },
	{ value: "not_between", arity: "range", inverse: "between" },
	{ value: "empty", arity: "none", inverse: "not_empty" },
	{ value: "not_empty", arity: "none", inverse: "empty" },
];

function createDateOperators(labels: FilterOperatorLabels): readonly FilterOperator[] {
	return DATE_OPERATOR_ENTRIES.map((entry: FilterOperatorCatalogEntry): FilterOperator => ({
		value: entry.value,
		label: labels[entry.value],
		arity: entry.arity,
		inverse: entry.inverse,
	}));
}

/** The value as one plain string: a phrase for a relative day, a date otherwise. */
function dateText(value: FilterValue | undefined, labels: FilterLabels, now: Date): string {
	const bounds = dateRangeOf(value);
	if (bounds !== undefined) {
		const [from, to] = bounds;
		return labels.valueRange(formatFilterDate(from, labels, now), formatFilterDate(to, labels, now));
	}
	const text = formatFilterDate(singleDateOf(value), labels, now);
	return text === "" ? labels.selectPlaceholder : text;
}

/**
 * One function serves both hooks. `renderValue` draws the chip; `valueText` is
 * what the accessible names, the titles and the advanced builder's cell read,
 * and a date token is an object that would otherwise announce as nothing useful.
 * The chip shows the PHRASE, so "today" keeps saying today rather than freezing
 * to the day the filter was made.
 */
function dateValueText({ value, labels }: FilterValueDisplayContext): string {
	return dateText(value, labels, readClock());
}

/** The icon arrives as an argument; everything the two fields share stays here. */
function dateField(id: string, label: string, defaultOperator: string, icon: React.ReactNode, operators: readonly FilterOperator[]): FilterField {
	return {
		id,
		label,
		operators,
		defaultOperator,
		editor: DateEditor,
		renderValue: dateValueText,
		valueText: dateValueText,
		icon,
	};
}

/** The seeded window is RELATIVE on both ends, so it means "the last 7 days" every day. */
const INITIAL_QUERY: FilterQuery = createFilterQuery([
	createFilterRule({
		id: "seed-1",
		path: ["window"],
		operator: "between",
		value: LAST_7_DAYS,
	}),
]);

export function Filters5Example(): React.JSX.Element {
	const operatorLabels = useUiKitLabels("filterOperators");
	// Two fields, one per control: the single picker opens on "is", the
	// two-month picker on "is between". Either field reaches either control by
	// changing the condition, which is the point of an editor that reads the
	// operator's arity.
	const fields = React.useMemo((): readonly FilterField[] => {
		const operators = createDateOperators(operatorLabels);
		return [dateField("createdAt", "Created", "is", <CalendarIcon />, operators), dateField("window", "Active window", "between", <CalendarRangeIcon />, operators)];
	}, [operatorLabels]);
	const [query, setQuery] = React.useState<FilterQuery>(INITIAL_QUERY);

	return <Filters fields={fields} query={query} onQueryChange={setQuery} showClear />;
}
