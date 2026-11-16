import type { LocalDate } from "@workspace/shared";
import { cn } from "@workspace/ui-native/lib/cn";
import { calendarDayMsOf } from "@workspace/ui-native/lib/calendar";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";
import { Text } from "react-native";

import { SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_TODAY } from "../example-support";

/** A night's price: a made-up formula over the day of the month, the same on every render. */
const BASE_PRICE = 70;
const PRICE_STEP = 7;
const PRICE_SPREAD = 11;
/** Below this, a price is a deal and shows in green. */
const DEAL_PRICE = 100;

function priceOf(day: LocalDate): number {
	return BASE_PRICE + ((new Date(calendarDayMsOf(day)).getUTCDate() * PRICE_STEP) % PRICE_SPREAD) * PRICE_STEP;
}

/** The price under a day. */
function PriceFooter(day: LocalDate): React.JSX.Element {
	const price = priceOf(day);
	return <Text className={cn("text-overline font-sans tabular-nums", price < DEAL_PRICE ? "text-success-foreground" : "text-muted-foreground")}>{`$${String(price)}`}</Text>;
}

/** The price, read with the day's name. */
function describePrice(day: LocalDate): string {
	return `$${String(priceOf(day))} a night`;
}

export function Calendar17Example(): React.JSX.Element {
	const [day, setDay] = React.useState<LocalDate | null>(null);
	return (
		<Calendar
			today={SAMPLE_TODAY}
			minDate={SAMPLE_TODAY}
			maxDate={SAMPLE_MAX_DATE}
			locale={SAMPLE_LOCALE}
			value={day}
			onChange={setDay}
			cellSize="lg"
			dayShape="square"
			renderDayFooter={PriceFooter}
			describeDay={describePrice}
		/>
	);
}
