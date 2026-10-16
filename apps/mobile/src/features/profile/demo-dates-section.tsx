// The profile's "Dates (demo)" card: a date of birth (DateField) and a set of
// available days (MultiDateField). Demo only — the values live in this
// component's state for as long as the screen is open; nothing is sent to the
// API or stored, and the card says so.

import { localDateInTimeZone, PLATFORM_DISPLAY_REGION, type LocalDate } from "@workspace/shared";
import * as React from "react";

import { Card } from "@workspace/ui-native/components/card";
import { DateField } from "@workspace/ui-native/components/date-field";
import { MultiDateField } from "@workspace/ui-native/components/multi-date-field";
import { useNow } from "../../lib/use-now";
import { demoDateBoundsOf, DEMO_MAX_AVAILABLE_DAYS } from "./demo-dates";

/** How often "today" is re-read, so the bounds move on at midnight while the screen stays open. */
const TODAY_REFRESH_MS = 60_000;

const NO_DAYS: readonly LocalDate[] = [];

export function DemoDatesSection(): React.JSX.Element {
	const nowMs = useNow({ intervalMs: TODAY_REFRESH_MS, running: true });
	const today = localDateInTimeZone(nowMs, PLATFORM_DISPLAY_REGION.timeZone);
	const bounds = React.useMemo(() => demoDateBoundsOf(today), [today]);
	const [birthDate, setBirthDate] = React.useState<LocalDate | null>(null);
	const [availableDays, setAvailableDays] = React.useState<readonly LocalDate[]>(NO_DAYS);

	return (
		<Card title="Dates (demo)" description="Demo only — these dates are not saved." testID="profile-demo-dates">
			<DateField
				label="Date of birth"
				value={birthDate}
				onChange={setBirthDate}
				placeholder="Pick your date of birth"
				minDate={bounds.birth.minDate}
				maxDate={bounds.birth.maxDate}
				today={today}
				locale={PLATFORM_DISPLAY_REGION.locale}
				hint="Tap the year or month in the calendar to jump there."
				testID="profile-birth-date"
			/>
			<MultiDateField
				label="Available days"
				value={availableDays}
				onChange={setAvailableDays}
				placeholder="Pick the days you are available"
				minDate={bounds.availability.minDate}
				maxDate={bounds.availability.maxDate}
				today={today}
				locale={PLATFORM_DISPLAY_REGION.locale}
				maxDates={DEMO_MAX_AVAILABLE_DAYS}
				hint={`Up to ${String(DEMO_MAX_AVAILABLE_DAYS)} days, in any months.`}
				testID="profile-available-days"
			/>
		</Card>
	);
}
