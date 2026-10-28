import { addLocalDays, epochMs, LocalDateSchema, PLATFORM_DISPLAY_REGION, startOfLocalDateInTimeZone, type DisplayRegion, type EpochMs } from "@workspace/shared";
import { z } from "zod";

/** How long an extra permission or a share lasts: a preset, a date, or for good (ADR 067). */
export const AccessDurationSchema = z.enum(["24h", "48h", "7d", "custom", "permanent"]);
export type AccessDuration = z.output<typeof AccessDurationSchema>;

const HOUR_MS = 60 * 60 * 1000;
const PRESET_HOURS: Readonly<Record<"24h" | "48h" | "7d", number>> = { "24h": 24, "48h": 48, "7d": 7 * 24 };

export const ACCESS_DURATION_OPTIONS: readonly { readonly value: AccessDuration; readonly label: string }[] = [
	{ value: "24h", label: "24 hours" },
	{ value: "48h", label: "48 hours" },
	{ value: "7d", label: "7 days" },
	{ value: "custom", label: "Until a date" },
	{ value: "permanent", label: "Permanent" },
];

export type ResolvedExpiry = { readonly ok: true; readonly expiresAt: EpochMs | undefined } | { readonly ok: false; readonly message: string };

/**
 * The end time a duration means, from `now`: a preset counts hours; "Until a date" runs to the end of that
 * day in the tenant's time zone; "Permanent" has none (`undefined`).
 */
export function resolveExpiresAt(duration: AccessDuration, now: number, customDate: string, timeZone: string): ResolvedExpiry {
	switch (duration) {
		case "permanent":
			return { ok: true, expiresAt: undefined };
		case "custom": {
			const date = LocalDateSchema.safeParse(customDate);
			if (!date.success) {
				return { ok: false, message: "Choose the last day it should last." };
			}
			const endOfDay = startOfLocalDateInTimeZone(addLocalDays(date.data, 1), timeZone);
			return endOfDay <= now ? { ok: false, message: "Choose a day that has not passed." } : { ok: true, expiresAt: epochMs(endOfDay) };
		}
		case "24h":
		case "48h":
		case "7d":
			return { ok: true, expiresAt: epochMs(now + PRESET_HOURS[duration] * HOUR_MS) };
	}
}

/** The tenant's own locale and zone for absolute times ("ends 30 Oct, 23:59"). */
export function tenantDisplayRegion(timeZone: string): DisplayRegion {
	return { locale: PLATFORM_DISPLAY_REGION.locale, timeZone };
}
