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

/** Average adult reading speed used for the "N min read" estimate and the "On this page" time left. */
export const WORDS_PER_MINUTE = 220;

/** Whitespace-separated words in `text`. */
export function countWords(text: string): number {
	return text.split(/\s+/).filter((word) => word.length > 0).length;
}

/** Whole minutes to read `words` (at least 1 when there is anything to read, 0 when there is nothing). */
export function minutesForWords(words: number): number {
	return words <= 0 ? 0 : Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** Estimated reading time in whole minutes (at least 1) for a markdown body; code blocks are not counted. */
export function readingMinutes(markdown: string): number {
	return Math.max(1, minutesForWords(countWords(markdown.replace(/```[\s\S]*?```/g, " "))));
}
