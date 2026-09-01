import { format } from "date-fns";

/**
 * Formats an epoch-ms timestamp (front-matter `lastUpdated`) as `Aug 2, 2026`
 * using date-fns. Front-matter dates are stored as UTC midnight, so the date
 * is normalized to its UTC calendar components and rebuilt as a local-midnight
 * `Date` — the same calendar day then reads identically in every viewer's
 * timezone (date-fns core has no `timeZone` option in v4). Falls back to `—`
 * for non-finite input.
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

/**
 * Derives a friendly download filename from an image `src` — the last path
 * segment (e.g. `/images/email/verification.png` → `verification.png`),
 * falling back to the alt text, then `preview.png`. Pure string logic, so it
 * is trivially unit-testable.
 */
export function downloadFilename(src: string, alt: string): string {
	const pathOnly: string = src.split(/[?#]/)[0] ?? src;
	const segments = pathOnly.split("/");
	let segment: string | undefined;
	for (let i = segments.length - 1; i >= 0; i -= 1) {
		const candidate: string | undefined = segments[i];
		if (candidate !== undefined && candidate.length > 0) {
			segment = candidate;
			break;
		}
	}
	if (segment?.includes(".") === true) {
		return segment;
	}
	const slug = alt
		.trim()
		.replace(/[^a-z0-9-]+/gi, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();
	return slug.length > 0 ? `${slug}.png` : "preview.png";
}
