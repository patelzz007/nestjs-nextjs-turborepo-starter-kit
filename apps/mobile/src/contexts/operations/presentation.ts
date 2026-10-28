// How the mobile app shows a server (ADR 068): its health as a badge tone and words, the ranges its
// chart offers, and its history thinned to what a phone can draw and touch. Pure functions; the
// numbers themselves are formatted by @workspace/shared, so the phone and the admin panel agree.

import { percentOf, type OpsHealth, type OpsHistoryRange, type OpsServerPoint, type OpsServerProvider } from "@workspace/shared";
import type { StatusBadgeTone } from "@workspace/ui-native/components/status-badge";

export const SERVERS_TITLE = "Servers";
export const SERVER_TITLE = "Server";

/** How each health state reads. */
export const HEALTH_PRESENTATION: Readonly<Record<OpsHealth, { readonly label: string; readonly tone: StatusBadgeTone }>> = {
	UP: { label: "Up", tone: "success" },
	DEGRADED: { label: "Degraded", tone: "warning" },
	DOWN: { label: "Down", tone: "destructive" },
	UNKNOWN: { label: "No data yet", tone: "neutral" },
};

/** How each provider reads. */
export const PROVIDER_LABELS: Readonly<Record<OpsServerProvider, string>> = {
	LOCAL: "This computer",
	DIGITALOCEAN: "DigitalOcean",
	LINODE: "Linode",
	VULTR: "Vultr",
	HETZNER: "Hetzner",
	OTHER: "Other",
};

/** The ranges the phone offers, with their segment labels. */
export const MOBILE_RANGES: readonly { readonly value: OpsHistoryRange; readonly label: string }[] = [
	{ value: "1h", label: "1H" },
	{ value: "24h", label: "24H" },
	{ value: "7d", label: "7D" },
	{ value: "30d", label: "30D" },
];

/** At most this many buckets reach the chart: enough detail, still one finger wide each. */
export const MAX_CHART_BUCKETS = 96;

/** One bucket of the phone's chart: its start and the CPU and memory shares in it. */
export interface UsageBucket {
	readonly at: number;
	readonly cpu: number;
	readonly memory: number;
}

/**
 * The history as at most {@link MAX_CHART_BUCKETS} buckets: consecutive points averaged together,
 * oldest first (a day of minutes becomes 96 quarter-hours).
 */
export function usageBuckets(points: readonly OpsServerPoint[], maxBuckets: number = MAX_CHART_BUCKETS): UsageBucket[] {
	const size = Math.max(1, Math.ceil(points.length / maxBuckets));
	const buckets: UsageBucket[] = [];
	for (let start = 0; start < points.length; start += size) {
		const group = points.slice(start, start + size);
		const [first] = group;
		if (first === undefined) {
			continue;
		}
		buckets.push({
			at: first.bucketStart,
			cpu: group.reduce((sum, point) => sum + point.cpuPercentAvg, 0) / group.length,
			memory: group.reduce((sum, point) => sum + percentOf(point.memoryUsedBytes, point.memoryTotalBytes), 0) / group.length,
		});
	}
	return buckets;
}

const CLOCK = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const FULL = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** A bucket under the plot: a clock time for a day or less, a date beyond. */
export function tickLabel(at: number, range: OpsHistoryRange): string {
	return range === "1h" || range === "24h" ? CLOCK.format(at) : DAY.format(at);
}

/** A bucket in full, for the readout: `Wed, 28 Oct, 14:05`. */
export function bucketLabel(at: number): string {
	return FULL.format(at);
}
