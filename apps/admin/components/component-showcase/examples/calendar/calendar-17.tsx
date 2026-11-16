"use client";

import { Calendar, CalendarDayButton } from "@workspace/ui/components/calendar";
import { startOfToday } from "date-fns";
import type * as React from "react";
import { useState } from "react";

// A deterministic sample price per day: a linear congruential step over the
// date's YYYYMMDD number, scaled into the price band. No network, same price every render.
const YEAR_WEIGHT = 10_000;
const MONTH_WEIGHT = 100;
const LCG_MULTIPLIER = 9301;
const LCG_INCREMENT = 49_297;
const LCG_MODULUS = 233_280;
const MIN_PRICE = 50;
const PRICE_SPREAD = 200;
/** Prices under this are highlighted as a deal. */
const DEAL_PRICE_THRESHOLD = 100;

function priceForDate(date: Date): number {
	const seed = date.getFullYear() * YEAR_WEIGHT + (date.getMonth() + 1) * MONTH_WEIGHT + date.getDate();
	const value = (seed * LCG_MULTIPLIER + LCG_INCREMENT) % LCG_MODULUS;
	return Math.floor(MIN_PRICE + (value / LCG_MODULUS) * PRICE_SPREAD);
}

/** The kit's day button with the day's sample price under the number. */
function PricedDayButton({ children, modifiers, day, ...props }: React.ComponentProps<typeof CalendarDayButton>): React.JSX.Element {
	const price = priceForDate(day.date);

	return (
		<CalendarDayButton day={day} modifiers={modifiers} {...props}>
			{children}
			{modifiers.outside ? null : <span className={price < DEAL_PRICE_THRESHOLD ? "text-success" : undefined}>${String(price)}</span>}
		</CalendarDayButton>
	);
}

const PRICED_DAY_COMPONENTS: NonNullable<React.ComponentProps<typeof Calendar>["components"]> = {
	DayButton: PricedDayButton,
};

export function Calendar17Example(): React.JSX.Element {
	const [date, setDate] = useState<Date | undefined>(startOfToday);

	return (
		<Calendar
			className="rounded-lg border [--cell-size:--spacing(12)]"
			components={PRICED_DAY_COMPONENTS}
			mode="single"
			onSelect={setDate}
			selected={date}
			showOutsideDays={false}
		/>
	);
}
