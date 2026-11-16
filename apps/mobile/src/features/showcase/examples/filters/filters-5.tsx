import type { LocalDate } from "@workspace/shared";
import { applyFilterRelative, filterValueItems, formatFilterDate, isFilterDateValue, toFilterDateValue, type FilterOperator } from "@workspace/ui-kit-logic";
import { Button } from "@workspace/ui-native/components/button";
import { Calendar } from "@workspace/ui-native/components/calendar";
import type { FilterBarEditorProps, FilterBarField } from "@workspace/ui-native/lib/filters";
import CalendarIcon from "lucide-react-native/icons/calendar";
import * as React from "react";
import { Text, View } from "react-native";

import { SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_MIN_DATE, SAMPLE_TODAY } from "../example-support";
import { FilterBar } from "./filters-sample";

const DATE_OPERATORS: readonly FilterOperator[] = [
	{ value: "is", label: "is on" },
	{ value: "is_before", label: "is before" },
	{ value: "is_after", label: "is after" },
];
const RANGE_OPERATORS: readonly FilterOperator[] = [{ value: "between", label: "is between", arity: "range" }];

const PRESETS: readonly { readonly label: string; readonly days: number }[] = [
	{ label: "Last 7 days", days: -7 },
	{ label: "Last 30 days", days: -30 },
];

/** One day: a relative phrase (today, tomorrow) or a day picked on the calendar. */
function DateEditor({ value, onValueChange, labels }: FilterBarEditorProps): React.JSX.Element {
	const now = React.useMemo((): Date => new Date(), []);
	const [item] = filterValueItems(value);
	const picked = isFilterDateValue(item) ? item : undefined;
	const pick = React.useCallback(
		(day: LocalDate): void => {
			onValueChange({ date: day });
		},
		[onValueChange],
	);
	const today = React.useCallback((): void => {
		onValueChange({ relative: { unit: "day", offset: 0 } });
	}, [onValueChange]);
	const tomorrow = React.useCallback((): void => {
		onValueChange({ relative: { unit: "day", offset: 1 } });
	}, [onValueChange]);
	return (
		<View className="gap-2">
			<View className="flex-row gap-2">
				<Button label={labels.relativeDate({ unit: "day", offset: 0 })} variant="outline" size="sm" onPress={today} />
				<Button label={labels.relativeDate({ unit: "day", offset: 1 })} variant="outline" size="sm" onPress={tomorrow} />
			</View>
			<Calendar today={SAMPLE_TODAY} minDate={SAMPLE_MIN_DATE} maxDate={SAMPLE_MAX_DATE} locale={SAMPLE_LOCALE} value={picked?.date ?? null} onChange={pick} />
			{picked === undefined ? null : <Text className="text-caption font-sans text-muted-foreground">{formatFilterDate(picked, labels, now)}</Text>}
		</View>
	);
}

/** A span of days: the last 7 or 30, from today back. */
function RangeEditor({ onValueChange }: FilterBarEditorProps): React.JSX.Element {
	const now = React.useMemo((): Date => new Date(), []);
	return (
		<View className="flex-row flex-wrap gap-2">
			{PRESETS.map((preset): React.JSX.Element => (
				<PresetButton key={preset.label} label={preset.label} days={preset.days} now={now} onPick={onValueChange} />
			))}
		</View>
	);
}

function PresetButton({
	label,
	days,
	now,
	onPick,
}: {
	readonly label: string;
	readonly days: number;
	readonly now: Date;
	readonly onPick: FilterBarEditorProps["onValueChange"];
}): React.JSX.Element {
	const pick = React.useCallback((): void => {
		onPick([toFilterDateValue(applyFilterRelative({ unit: "day", offset: days }, now)), toFilterDateValue(now)]);
	}, [days, now, onPick]);
	return <Button label={label} variant="outline" size="sm" onPress={pick} />;
}

const FIELDS: readonly FilterBarField[] = [
	{ id: "due", label: "Due date", icon: CalendarIcon, operators: DATE_OPERATORS, editor: DateEditor },
	{ id: "created", label: "Created", icon: CalendarIcon, operators: RANGE_OPERATORS, editor: RangeEditor },
];

// A day by phrase or calendar, and a range from presets: the chip keeps "today" as a phrase, so it never goes stale.
export function Filters5Example(): React.JSX.Element {
	return <FilterBar fields={FIELDS} showQuery />;
}
