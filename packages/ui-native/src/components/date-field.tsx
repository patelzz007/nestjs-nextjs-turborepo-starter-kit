// A labelled single date (a date of birth, a start date): the field shows the
// picked day; pressing it opens a month calendar in a bottom sheet, and
// tapping a day picks it and closes the sheet. The month and year in the
// calendar's header list the months and years to jump to, so a birth year
// decades back is a few taps away. Days outside `minDate`…`maxDate` cannot
// be picked.
//
// Controlled and data-agnostic: `value` in, `onChange(day)` out, `onFocus`
// when the calendar opens and `onBlur` when it closes; validation is the
// form's zod schema. Dates are calendar days (`YYYY-MM-DD`). The trigger's
// look, state and ref are CalendarField's.

import { UTC_TIME_ZONE, type LocalDate } from "@workspace/shared";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { calendarDayMsOf, calendarMonthOf, clampCalendarMonth, type CalendarMonth, type RangeDayRole } from "../lib/calendar";
import { playSelectionFeedback } from "../lib/haptics";
import { CalendarField, type CalendarFieldTriggerProps } from "./calendar-field";
import { CalendarMonthGrid } from "./calendar-month-grid";
import { CalendarNavigator } from "./calendar-navigator";

export interface DateFieldProps extends CalendarFieldTriggerProps {
	/** The picked day, or `null`. */
	readonly value: LocalDate | null;
	readonly onChange: (day: LocalDate) => void;
	readonly minDate: LocalDate;
	readonly maxDate: LocalDate;
	/** Ringed on the calendar; the calendar opens on its month while no day is picked. */
	readonly today: LocalDate;
	/** The locale of the month and day names. */
	readonly locale: string;
}

/** The field's summary: "15 March 1990". */
function summaryFormatOf(locale: string): Intl.DateTimeFormat {
	return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: UTC_TIME_ZONE });
}

export const DateField = React.memo(
	React.forwardRef<ViewInstance, DateFieldProps>(function DateField({ value, onChange, minDate, maxDate, today, locale, ...fieldProps }, ref): React.JSX.Element {
		const summaryFormat = React.useMemo(() => summaryFormatOf(locale), [locale]);
		const summary = React.useMemo(() => (value === null ? null : summaryFormat.format(calendarDayMsOf(value))), [summaryFormat, value]);
		const renderSheet = React.useCallback(
			(close: () => void): React.ReactNode => <DateSheet value={value} minDate={minDate} maxDate={maxDate} today={today} locale={locale} onChange={onChange} close={close} />,
			[locale, maxDate, minDate, onChange, today, value],
		);
		return <CalendarField ref={ref} {...fieldProps} summary={summary} renderSheet={renderSheet} />;
	}),
);

interface DateSheetProps {
	readonly value: LocalDate | null;
	readonly minDate: LocalDate;
	readonly maxDate: LocalDate;
	readonly today: LocalDate;
	readonly locale: string;
	readonly onChange: (day: LocalDate) => void;
	readonly close: () => void;
}

const DateSheet = React.memo(function DateSheet({ value, minDate, maxDate, today, locale, onChange, close }: DateSheetProps): React.JSX.Element {
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
});
