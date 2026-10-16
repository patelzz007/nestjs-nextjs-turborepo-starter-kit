// The profile's demo date fields (a date of birth and a set of available
// days): the days each may be picked from. Demo only — nothing here is sent
// to the API or stored; the fields show the date pickers on a real screen.

import { addLocalDays, type LocalDate } from "@workspace/shared";

import { calendarMonthOf, firstDayOf } from "@workspace/ui-native/lib/calendar";

/** A date of birth may be up to this many years back (from 1 January of that year). */
export const DEMO_BIRTH_YEARS_BACK = 100;
/** Available days run from today to the end of the year this many years ahead. */
export const DEMO_AVAILABILITY_YEARS_AHEAD = 1;
/** The most available days that can be picked. */
export const DEMO_MAX_AVAILABLE_DAYS = 10;

export interface DemoDateBounds {
	readonly birth: { readonly minDate: LocalDate; readonly maxDate: LocalDate };
	readonly availability: { readonly minDate: LocalDate; readonly maxDate: LocalDate };
}

/** The pickable days on `today`: a birth date up to today, available days from today on. */
export function demoDateBoundsOf(today: LocalDate): DemoDateBounds {
	const { year } = calendarMonthOf(today);
	const firstOfYearAfterLast = firstDayOf({ year: year + DEMO_AVAILABILITY_YEARS_AHEAD + 1, month: 1 });
	return {
		birth: { minDate: firstDayOf({ year: year - DEMO_BIRTH_YEARS_BACK, month: 1 }), maxDate: today },
		availability: { minDate: today, maxDate: addLocalDays(firstOfYearAfterLast, -1) },
	};
}
