// The Home screen's greeting for the person signed in (src/app/(app)/index.tsx), by the time of day on the
// phone's clock. The expo-boilerplate app greets the same way.

/** The hour (24-hour clock, phone's time zone) each part of the day starts at; night runs past midnight. */
const MORNING_STARTS_AT = 5;
const AFTERNOON_STARTS_AT = 12;
const EVENING_STARTS_AT = 17;
const NIGHT_STARTS_AT = 21;

export type PartOfDay = "morning" | "afternoon" | "evening" | "night";

/** Which part of the day `now` falls in, on the phone's clock. */
export function partOfDayOf(now: Date): PartOfDay {
	const hour = now.getHours();
	if (hour >= NIGHT_STARTS_AT || hour < MORNING_STARTS_AT) {
		return "night";
	}
	if (hour >= EVENING_STARTS_AT) {
		return "evening";
	}
	return hour >= AFTERNOON_STARTS_AT ? "afternoon" : "morning";
}

/** Greets the person signed in by name: "Good morning, Alex Morgan". */
export function greetingOf(name: string, now: Date): string {
	return `Good ${partOfDayOf(now)}, ${name}`;
}
