"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { DatePicker } from "@workspace/ui/components/date-picker";
import { Label } from "@workspace/ui/components/label";
import { MultiDatePicker } from "@workspace/ui/components/multi-date-picker";
import { formatDateInputString } from "@workspace/ui/lib/form/date-input";
import { addYears, endOfYear, startOfYear } from "date-fns";
import * as React from "react";

/** A date of birth may be up to this many years back (from 1 January of that year). */
export const DEMO_BIRTH_YEARS_BACK = 100;
/** Available days run from today to the end of the year this many years ahead. */
export const DEMO_AVAILABILITY_YEARS_AHEAD = 1;
/** The most available days that can be picked. */
export const DEMO_MAX_AVAILABLE_DAYS = 10;

export interface DemoDateBounds {
	readonly birth: { readonly fromDate: string; readonly toDate: string };
	readonly availability: { readonly fromDate: string; readonly toDate: string };
}

/** The pickable days (`yyyy-MM-dd`) on `today`: a birth date up to today, available days from today on. */
export function demoDateBoundsOf(today: Date): DemoDateBounds {
	const todayString = formatDateInputString(today);
	return {
		birth: { fromDate: formatDateInputString(startOfYear(addYears(today, -DEMO_BIRTH_YEARS_BACK))), toDate: todayString },
		availability: { fromDate: todayString, toDate: formatDateInputString(endOfYear(addYears(today, DEMO_AVAILABILITY_YEARS_AHEAD))) },
	};
}

const NO_DAYS: readonly string[] = [];

/**
 * The profile's "Dates (demo)" card: a date of birth (`DatePicker`) and a set
 * of available days (`MultiDatePicker`). Demo only — the values live in this
 * component's state while the page is open; nothing is sent to the API or
 * stored, and the card says so.
 */
export function ProfileDemoDates(): React.JSX.Element {
	// Read once per mount: the bounds only need to be right for the visit.
	const bounds = React.useMemo(() => demoDateBoundsOf(new Date()), []);
	const [birthDate, setBirthDate] = React.useState<string>("");
	const [availableDays, setAvailableDays] = React.useState<readonly string[]>(NO_DAYS);

	return (
		// A dashed edge marks the card as a demo whose values are not saved, beside the solid cards that are.
		<Card className="border border-dashed border-foreground/20 shadow-none ring-0" data-testid="profile-demo-dates">
			<CardHeader>
				<CardTitle>Dates (demo)</CardTitle>
				<CardDescription>Demo only — these dates are not saved.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5">
				<div className="space-y-1.5">
					<Label htmlFor="profile-birth-date">Date of birth</Label>
					<DatePicker
						id="profile-birth-date"
						value={birthDate}
						onValueChange={setBirthDate}
						placeholder="Pick your date of birth"
						fromDate={bounds.birth.fromDate}
						toDate={bounds.birth.toDate}
						ariaDescribedBy="profile-birth-date-hint"
					/>
					<p id="profile-birth-date-hint" className="text-sm text-muted-foreground">
						Pick the month and year from the calendar&apos;s dropdowns to jump there.
					</p>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="profile-available-days">Available days</Label>
					<MultiDatePicker
						id="profile-available-days"
						value={availableDays}
						onValueChange={setAvailableDays}
						placeholder="Pick the days you are available"
						fromDate={bounds.availability.fromDate}
						toDate={bounds.availability.toDate}
						maxDates={DEMO_MAX_AVAILABLE_DAYS}
						ariaDescribedBy="profile-available-days-hint"
					/>
					<p id="profile-available-days-hint" className="text-sm text-muted-foreground">
						Up to {DEMO_MAX_AVAILABLE_DAYS} days, in any months. Click a day again to remove it.
					</p>
				</div>
			</CardContent>
		</Card>
	);
}
