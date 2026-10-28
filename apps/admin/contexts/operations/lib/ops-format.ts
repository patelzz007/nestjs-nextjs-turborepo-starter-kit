// The operations console's number formats (ADR 068): bytes, rates, percents, durations and times —
// one place, so every screen writes "1.2 GB" and "340 ms" the same way.

import { formatBytes, type OpsHealth, usageLevel } from "@workspace/shared";
import type { StatusTone } from "@workspace/ui/components/status-badge";

// The machine figures every client formats the same way live in @workspace/shared (machine-usage).
export { formatBytes, formatPercent, formatUptime, percentOf } from "@workspace/shared";

const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/** A byte rate: `2.1 MB/s`. */
export function formatByteRate(bytesPerSecond: number | null): string {
	return bytesPerSecond === null ? "—" : `${formatBytes(bytesPerSecond)}/s`;
}

/** `12.4` → `12 ms`; above a second, `1.24 s`. */
export function formatMs(value: number | null): string {
	if (value === null) {
		return "—";
	}
	return value >= MS_PER_SECOND ? `${(value / MS_PER_SECOND).toFixed(2)} s` : `${value.toFixed(0)} ms`;
}

/** A count with thousands separators. */
export function formatCount(value: number | null): string {
	return value === null ? "—" : new Intl.NumberFormat("en-MY").format(Math.round(value));
}

/** How long ago `at` was, from `now`: `just now`, `3 min ago`, `2 h ago`, `5 d ago`. */
export function formatAgo(at: number | null, now: number): string {
	if (at === null) {
		return "never";
	}
	const seconds = Math.max(0, Math.round((now - at) / MS_PER_SECOND));
	if (seconds < SECONDS_PER_MINUTE) {
		return "just now";
	}
	const minutes = Math.round(seconds / SECONDS_PER_MINUTE);
	if (minutes < MINUTES_PER_HOUR) {
		return `${String(minutes)} min ago`;
	}
	const hours = Math.round(minutes / MINUTES_PER_HOUR);
	return hours < HOURS_PER_DAY ? `${String(hours)} h ago` : `${String(Math.round(hours / HOURS_PER_DAY))} d ago`;
}

/** A gauge's tone for a percent. */
export function gaugeTone(percent: number): StatusTone {
	const level = usageLevel(percent);
	return level === "ok" ? "success" : level;
}

/** How a health state reads. */
export const HEALTH_PRESENTATION: Readonly<Record<OpsHealth, { readonly label: string; readonly tone: StatusTone }>> = {
	UP: { label: "Up", tone: "success" },
	DEGRADED: { label: "Degraded", tone: "warning" },
	DOWN: { label: "Down", tone: "danger" },
	UNKNOWN: { label: "No data yet", tone: "muted" },
};

/** A time of day for chart ticks: `14:05`. */
export function formatClock(at: number): string {
	return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(at);
}

/** A date and time in full: `28 Oct 2026, 14:05`. */
export function formatDateTimeShort(at: number | null): string {
	return at === null ? "—" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(at);
}
