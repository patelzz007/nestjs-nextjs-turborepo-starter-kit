// ============================================
// lib/dates.ts - date-fns based date formatting
// ============================================
// The whole codebase stores timestamps as **epoch milliseconds** (BigInt in
// the DB, `EpochMs` branded numbers in the shared schemas). These helpers are
// the ONLY sanctioned way to render them — every call site must go through
// date-fns, never raw `Intl.DateTimeFormat` / `toLocaleString` / ISO slicing.

import { differenceInSeconds, format } from "date-fns";

/** "Aug 14, 2026, 1:33 AM" — the default table/card timestamp label. */
export function formatDateTime(ms: number): string {
	return format(new Date(ms), "MMM d, yyyy, h:mm a");
}

/** "Aug 14, 2026, 1:33:15 AM" — with seconds, for detail views. */
export function formatDateTimeWithSeconds(ms: number): string {
	return format(new Date(ms), "MMM d, yyyy, h:mm:ss a");
}

/** "1:33 PM" — compact clock label for charts and inline rows. */
export function formatTimeOfDay(ms: number): string {
	return format(new Date(ms), "h:mm a");
}

/** "1:33 PM" on a 24h clock — for monospace/log contexts. */
export function formatTimeOfDay24(ms: number): string {
	return format(new Date(ms), "HH:mm:ss");
}

/** "Aug 14" — compact date label for axis/tooltip contexts. */
export function formatShortDate(ms: number): string {
	return format(new Date(ms), "MMM d");
}

// ── Relative time ──────────────────────────────────────────────────────────

/** "just now" / "42s ago" / "5m ago" / "2h ago" / "3d ago" — compact label. */
export function timeAgo(ms: number, nowMs: number = Date.now()): string {
	const seconds: number = Math.max(0, differenceInSeconds(nowMs, ms));
	if (seconds < 5) {
		return "just now";
	}
	if (seconds < 60) {
		return `${String(seconds)}s ago`;
	}
	const minutes: number = Math.floor(seconds / 60);
	if (minutes < 60) {
		return `${String(minutes)}m ago`;
	}
	const hours: number = Math.floor(minutes / 60);
	if (hours < 24) {
		return `${String(hours)}h ago`;
	}
	return `${String(Math.floor(hours / 24))}d ago`;
}
