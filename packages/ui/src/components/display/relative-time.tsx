"use client";

import { formatEpochMs, formatRelativeTime, toIsoTimestamp } from "@workspace/ui/lib/format/date-time";
import type { DisplayRegion } from "@workspace/shared";
import * as React from "react";

/** How often a mounted relative time re-reads the clock, so "1 minute ago" keeps moving. */
export const RELATIVE_TIME_REFRESH_INTERVAL_MS = 30_000;

// ── Shared clock ───────────────────────────────────────────────────────────
// One interval serves every mounted `RelativeTime`. The snapshot is cached so
// `useSyncExternalStore` reads a stable value between ticks, and is dropped
// when the last subscriber leaves so the next mount starts from a fresh read.

let clockSnapshot: number | null = null;
let clockTimer: ReturnType<typeof setInterval> | undefined;
const clockListeners = new Set<() => void>();

function readClock(): number {
	clockSnapshot ??= Date.now();
	return clockSnapshot;
}

function tickClock(): void {
	clockSnapshot = Date.now();
	for (const listener of clockListeners) {
		listener();
	}
}

function subscribeToClock(listener: () => void): () => void {
	clockListeners.add(listener);
	clockTimer ??= setInterval(tickClock, RELATIVE_TIME_REFRESH_INTERVAL_MS);
	return (): void => {
		clockListeners.delete(listener);
		if (clockListeners.size === 0 && clockTimer !== undefined) {
			clearInterval(clockTimer);
			clockTimer = undefined;
			clockSnapshot = null;
		}
	};
}

/** The server — and the hydrating client — have no "now" to render against. */
function readServerClock(): null {
	return null;
}

export interface RelativeTimeProps extends Omit<React.ComponentProps<"time">, "children" | "dateTime"> {
	/** The instant to describe (epoch milliseconds). */
	readonly epochMs: number;
	/** Locale and time zone of the absolute time (shown before hydration and as the tooltip) and of the relative wording. */
	readonly region: DisplayRegion;
}

/**
 * "5 minutes ago" — rendered hydration-safely. The server and the hydrating
 * client both render the absolute time (pinned to `region`, so they match);
 * only after mount does it switch to the relative wording against the
 * browser's clock, refreshing every {@link RELATIVE_TIME_REFRESH_INTERVAL_MS}.
 * The absolute time stays available as the tooltip.
 */
export const RelativeTime = React.forwardRef<HTMLTimeElement, RelativeTimeProps>(function RelativeTime({ epochMs, region, ...props }, ref): React.JSX.Element {
	const nowMs = React.useSyncExternalStore(subscribeToClock, readClock, readServerClock);
	const absolute = formatEpochMs(epochMs, "dateTime", region);

	return (
		<time ref={ref} dateTime={toIsoTimestamp(epochMs)} title={absolute} {...props}>
			{nowMs === null ? absolute : formatRelativeTime(epochMs, nowMs, region.locale)}
		</time>
	);
});
