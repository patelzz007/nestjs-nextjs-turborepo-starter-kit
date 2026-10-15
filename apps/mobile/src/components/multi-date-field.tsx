// A labelled set of separate dates (4 Sep, 14 Sep, 3 Oct): the field lists
// the picked days; pressing it opens a month calendar in a bottom sheet where
// each tap picks or unpicks a day, across as many months as needed (the
// header's month and year jump anywhere). The picked days show as chips above
// the calendar — tapping one removes it — and Apply hands the set back;
// Cancel or closing the sheet keeps the field as it was. Days outside
// `minDate`…`maxDate` cannot be picked, and `maxDates`, when set, caps how many.
//
// Controlled and data-agnostic: `value` in, `onChange(days)` out, always in
// date order without repeats; validation is the form's zod schema. Dates are
// calendar days (`YYYY-MM-DD`).

import { UTC_TIME_ZONE, type LocalDate } from "@workspace/shared";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { calendarDayMsOf, calendarMonthOf, clampCalendarMonth, toggleCalendarDay, type CalendarMonth, type RangeDayRole } from "../lib/calendar";
import { playSelectionFeedback } from "../lib/haptics";
import { Button } from "./button";
import { CalendarField } from "./calendar-field";
import { CalendarMonthGrid } from "./calendar-month-grid";
import { CalendarNavigator } from "./calendar-navigator";
import { Icon } from "./icon";

export interface MultiDateFieldProps {
	/** Visible label, the sheet's title and the field's accessible name. */
	readonly label: string;
	/** The picked days, in date order. */
	readonly value: readonly LocalDate[];
	readonly onChange: (days: readonly LocalDate[]) => void;
	readonly onBlur?: () => void;
	/** Shown while no day is picked — supplied by the caller. */
	readonly placeholder: string;
	readonly minDate: LocalDate;
	readonly maxDate: LocalDate;
	/** Ringed on the calendar; the calendar opens on its month while no day is picked. */
	readonly today: LocalDate;
	/** The locale of the month and day names. */
	readonly locale: string;
	/** The most days that can be picked; no limit when absent. */
	readonly maxDates?: number;
	readonly error?: string | undefined;
	readonly hint?: string;
	readonly disabled?: boolean;
	readonly testID?: string;
}

function shortFormatOf(locale: string): Intl.DateTimeFormat {
	return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: UTC_TIME_ZONE });
}

export function MultiDateField({
	label,
	value,
	onChange,
	onBlur,
	placeholder,
	minDate,
	maxDate,
	today,
	locale,
	maxDates,
	error,
	hint,
	disabled,
	testID,
}: MultiDateFieldProps): React.JSX.Element {
	const shortFormat = React.useMemo(() => shortFormatOf(locale), [locale]);
	const summary = value.length === 0 ? null : value.map((day: LocalDate): string => shortFormat.format(calendarDayMsOf(day))).join(", ");
	const renderSheet = React.useCallback(
		(close: () => void): React.ReactNode => (
			<MultiDateSheet
				value={value}
				minDate={minDate}
				maxDate={maxDate}
				today={today}
				locale={locale}
				maxDates={maxDates ?? null}
				onChange={onChange}
				close={close}
				{...(testID === undefined ? {} : { testID })}
			/>
		),
		[locale, maxDate, maxDates, minDate, onChange, testID, today, value],
	);
	return (
		<CalendarField
			label={label}
			summary={summary}
			placeholder={placeholder}
			error={error}
			{...(hint === undefined ? {} : { hint })}
			{...(disabled === undefined ? {} : { disabled })}
			{...(onBlur === undefined ? {} : { onBlur })}
			{...(testID === undefined ? {} : { testID })}
			renderSheet={renderSheet}
		/>
	);
}

interface MultiDateSheetProps {
	readonly value: readonly LocalDate[];
	readonly minDate: LocalDate;
	readonly maxDate: LocalDate;
	readonly today: LocalDate;
	readonly locale: string;
	readonly maxDates: number | null;
	readonly onChange: (days: readonly LocalDate[]) => void;
	readonly close: () => void;
	readonly testID?: string;
}

/** "3 dates picked", "1 date picked", and the cap when there is one ("2 of 5 dates picked"). */
function pickedCountLabel(count: number, maxDates: number | null): string {
	const noun = (maxDates ?? count) === 1 ? "date" : "dates";
	return maxDates === null ? `${String(count)} ${noun} picked` : `${String(count)} of ${String(maxDates)} ${noun} picked`;
}

function MultiDateSheet({ value, minDate, maxDate, today, locale, maxDates, onChange, close, testID }: MultiDateSheetProps): React.JSX.Element {
	const minMonth = React.useMemo(() => calendarMonthOf(minDate), [minDate]);
	const maxMonth = React.useMemo(() => calendarMonthOf(maxDate), [maxDate]);
	const [draft, setDraft] = React.useState<readonly LocalDate[]>(value);
	const [month, setMonth] = React.useState<CalendarMonth>(() => {
		const [firstPicked] = value;
		return clampCalendarMonth(calendarMonthOf(firstPicked ?? today), minMonth, maxMonth);
	});
	const shortFormat = React.useMemo(() => shortFormatOf(locale), [locale]);

	const isFull = maxDates !== null && draft.length >= maxDates;
	const isUnavailable = React.useCallback((day: LocalDate): boolean => isFull && !draft.includes(day), [draft, isFull]);
	const roleOf = React.useCallback((day: LocalDate): RangeDayRole => (draft.includes(day) ? "single" : "none"), [draft]);
	const toggle = React.useCallback(
		(day: LocalDate): void => {
			playSelectionFeedback();
			setDraft((current: readonly LocalDate[]): readonly LocalDate[] => toggleCalendarDay(current, day, maxDates));
		},
		[maxDates],
	);
	const clear = React.useCallback((): void => {
		setDraft([]);
	}, []);
	const apply = React.useCallback((): void => {
		onChange(draft);
		close();
	}, [close, draft, onChange]);

	const status = draft.length === 0 ? "Tap each date you want. Tap it again to remove it." : pickedCountLabel(draft.length, maxDates);

	return (
		<View className="gap-4">
			{draft.length === 0 ? null : (
				<View className="flex-row flex-wrap gap-2">
					{draft.map((day: LocalDate): React.JSX.Element => (
						<PickedDayChip key={day} day={day} text={shortFormat.format(calendarDayMsOf(day))} onRemove={toggle} />
					))}
				</View>
			)}
			<CalendarNavigator month={month} minMonth={minMonth} maxMonth={maxMonth} locale={locale} onMonthChange={setMonth}>
				<CalendarMonthGrid month={month} today={today} minDate={minDate} maxDate={maxDate} locale={locale} roleOf={roleOf} onPick={toggle} isUnavailable={isUnavailable} />
			</CalendarNavigator>
			<Text accessibilityLiveRegion="polite" className="font-sans text-sm text-muted-foreground">
				{isFull ? `${status}. Remove one to pick another.` : status}
			</Text>
			<View className="flex-row items-center justify-between gap-2">
				<Button label="Clear" variant="ghost" onPress={clear} disabled={draft.length === 0} />
				<View className="flex-row gap-2">
					<Button label="Cancel" variant="ghost" onPress={close} />
					<Button label="Apply" onPress={apply} {...(testID === undefined ? {} : { testID: `${testID}-apply` })} />
				</View>
			</View>
		</View>
	);
}

interface PickedDayChipProps {
	readonly day: LocalDate;
	readonly text: string;
	readonly onRemove: (day: LocalDate) => void;
}

function PickedDayChip({ day, text, onRemove }: PickedDayChipProps): React.JSX.Element {
	const remove = React.useCallback((): void => {
		onRemove(day);
	}, [day, onRemove]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`Remove ${text}`}
			onPress={remove}
			hitSlop={4}
			className="h-9 flex-row items-center gap-1 rounded-full bg-primary/10 ps-3 pe-2 active:opacity-70">
			<Text className="font-sans-medium text-sm text-foreground tabular-nums">{text}</Text>
			<Icon icon={XIcon} size="sm" colorClassName="accent-muted-foreground" />
		</Pressable>
	);
}
