// A labelled single date (a date of birth, a start date): the field shows the
// picked day; pressing it opens a month calendar in a bottom sheet, and
// tapping a day picks it and closes the sheet. The month and year in the
// calendar's header list the months and years to jump to, so a birth year
// decades back is a few taps away. Days outside `minDate`…`maxDate` cannot
// be picked.
//
// Controlled and data-agnostic: `value` in, `onChange(day)` out; validation
// is the form's zod schema. Dates are calendar days (`YYYY-MM-DD`).

import { UTC_TIME_ZONE, type LocalDate } from "@workspace/shared";
import * as React from "react";

import { calendarDayMsOf, calendarMonthOf, clampCalendarMonth, type CalendarMonth, type RangeDayRole } from "../lib/calendar";
import { playSelectionFeedback } from "../lib/haptics";
import { CalendarField } from "./calendar-field";
import { CalendarMonthGrid } from "./calendar-month-grid";
import { CalendarNavigator } from "./calendar-navigator";

export interface DateFieldProps {
	/** Visible label, the sheet's title and the field's accessible name. */
	readonly label: string;
	/** The picked day, or `null`. */
	readonly value: LocalDate | null;
	readonly onChange: (day: LocalDate) => void;
	readonly onBlur?: () => void;
	/** Shown while no day is picked — supplied by the caller. */
	readonly placeholder: string;
	readonly minDate: LocalDate;
	readonly maxDate: LocalDate;
	/** Ringed on the calendar; the calendar opens on its month while no day is picked. */
	readonly today: LocalDate;
	/** The locale of the month and day names. */
	readonly locale: string;
	readonly error?: string | undefined;
	readonly hint?: string;
	readonly disabled?: boolean;
	readonly testID?: string;
}

export function DateField({ label, value, onChange, onBlur, placeholder, minDate, maxDate, today, locale, error, hint, disabled, testID }: DateFieldProps): React.JSX.Element {
	const summaryFormat = React.useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: UTC_TIME_ZONE }), [locale]);
	const renderSheet = React.useCallback(
		(close: () => void): React.ReactNode => <DateSheet value={value} minDate={minDate} maxDate={maxDate} today={today} locale={locale} onChange={onChange} close={close} />,
		[locale, maxDate, minDate, onChange, today, value],
	);
	return (
		<CalendarField
			label={label}
			summary={value === null ? null : summaryFormat.format(calendarDayMsOf(value))}
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

interface DateSheetProps {
	readonly value: LocalDate | null;
	readonly minDate: LocalDate;
	readonly maxDate: LocalDate;
	readonly today: LocalDate;
	readonly locale: string;
	readonly onChange: (day: LocalDate) => void;
	readonly close: () => void;
}

function DateSheet({ value, minDate, maxDate, today, locale, onChange, close }: DateSheetProps): React.JSX.Element {
	const minMonth = React.useMemo(() => calendarMonthOf(minDate), [minDate]);
	const maxMonth = React.useMemo(() => calendarMonthOf(maxDate), [maxDate]);
	const [month, setMonth] = React.useState<CalendarMonth>(() => clampCalendarMonth(calendarMonthOf(value ?? today), minMonth, maxMonth));
	const roleOf = React.useCallback((day: LocalDate): RangeDayRole => (day === value ? "single" : "none"), [value]);
	const pick = React.useCallback(
		(day: LocalDate): void => {
			playSelectionFeedback();
			if (day !== value) {
				onChange(day);
			}
			close();
		},
		[close, onChange, value],
	);
	return (
		<CalendarNavigator month={month} minMonth={minMonth} maxMonth={maxMonth} locale={locale} onMonthChange={setMonth}>
			<CalendarMonthGrid month={month} today={today} minDate={minDate} maxDate={maxDate} locale={locale} roleOf={roleOf} onPick={pick} />
		</CalendarNavigator>
	);
}
