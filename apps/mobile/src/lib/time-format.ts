// Dates and relative times for the device list. Rendered in the platform's
// display region (the same one the web uses, PLATFORM_DISPLAY_REGION), so a
// session reads the same on every client.

import { PLATFORM_DISPLAY_REGION, type DisplayRegion } from "@workspace/shared";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Under this, "just now" / "in a moment". */
const JUST_NOW_MS = MINUTE_MS;

interface RelativeUnit {
	readonly ms: number;
	readonly singular: string;
	readonly plural: string;
}

/** Largest unit first. */
const RELATIVE_UNITS: readonly RelativeUnit[] = [
	{ ms: DAY_MS, singular: "day", plural: "days" },
	{ ms: HOUR_MS, singular: "hour", plural: "hours" },
	{ ms: MINUTE_MS, singular: "minute", plural: "minutes" },
];

/** "5 minutes ago", "in 6 days", "just now". */
export function formatRelativeTime(epochMs: number, nowMs: number): string {
	const deltaMs = epochMs - nowMs;
	const distanceMs = Math.abs(deltaMs);
	if (distanceMs < JUST_NOW_MS) {
		return deltaMs < 0 ? "just now" : "in a moment";
	}
	const unit = RELATIVE_UNITS.find((candidate: RelativeUnit): boolean => distanceMs >= candidate.ms) ?? { ms: MINUTE_MS, singular: "minute", plural: "minutes" };
	const count = Math.floor(distanceMs / unit.ms);
	const label = `${String(count)} ${count === 1 ? unit.singular : unit.plural}`;
	return deltaMs < 0 ? `${label} ago` : `in ${label}`;
}

/** "3 Oct 2026, 14:05" in the display region. */
export function formatDateTime(epochMs: number, region: DisplayRegion = PLATFORM_DISPLAY_REGION): string {
	return new Intl.DateTimeFormat(region.locale, { dateStyle: "medium", timeStyle: "short", timeZone: region.timeZone }).format(epochMs);
}
