import { format } from "date-fns";

/**
 * Formats an epoch-ms timestamp (front-matter `lastUpdated` / `date`) as
 * `Aug 2, 2026`. Front-matter dates are stored as UTC midnight, so the date is
 * rebuilt from its UTC calendar components — the same day then reads
 * identically in every timezone. Falls back to `—` for missing / invalid input.
 */
export function formatEpochDate(epoch: number | undefined): string {
	if (epoch === undefined) {
		return "—";
	}
	const parsed = new Date(epoch);
	if (!Number.isFinite(parsed.getTime())) {
		return "—";
	}
	const utcMidnight = new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
	return format(utcMidnight, "MMM d, yyyy");
}

/** Average adult reading speed used for the "N min read" estimate. */
const WORDS_PER_MINUTE = 220;

/** Estimated reading time in whole minutes (at least 1) for a markdown body. */
export function readingMinutes(markdown: string): number {
	const withoutCode = markdown.replace(/```[\s\S]*?```/g, " ");
	const words = withoutCode.split(/\s+/).filter((word) => word.length > 0).length;
	return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
