// How the operations console (ADR 068) reads a machine, on every client: its sizes and shares in
// words ("6.0 GB", "75%", "3d 4h"), when a share counts as high, its total storage, and its spec in
// one line. Pure functions, shared by the admin panel and the mobile app so both say the same thing.

import type { OpsDisk, OpsServerLive } from "./schemas/operations";

const BYTE_UNITS: readonly string[] = ["B", "KB", "MB", "GB", "TB", "PB"];
const KILO = 1_024;
const HUNDRED = 100;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/** A share turns amber at this percent… */
export const USAGE_WARNING_PERCENT = 75;
/** …and red at this one. */
export const USAGE_DANGER_PERCENT = 90;

/** How full something is: fine, high, or nearly full. */
export type UsageLevel = "ok" | "warning" | "danger";

/** `1536` → `1.5 KB`; `null` → `—`. */
export function formatBytes(bytes: number | null): string {
	if (bytes === null) {
		return "—";
	}
	let value = bytes;
	let unit = 0;
	while (value >= KILO && unit < BYTE_UNITS.length - 1) {
		value /= KILO;
		unit += 1;
	}
	return `${value >= HUNDRED || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${BYTE_UNITS.at(unit) ?? "B"}`;
}

/** `42.37` → `42%`; `null` → `—` (not measured on this platform). */
export function formatPercent(value: number | null): string {
	return value === null ? "—" : `${value.toFixed(0)}%`;
}

/** Seconds as `3d 4h`, `5h 12m`, `8m` or `40s`. */
export function formatUptime(seconds: number | null): string {
	if (seconds === null) {
		return "—";
	}
	const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
	const hours = Math.floor(minutes / MINUTES_PER_HOUR);
	const days = Math.floor(hours / HOURS_PER_DAY);
	if (days > 0) {
		return `${String(days)}d ${String(hours % HOURS_PER_DAY)}h`;
	}
	if (hours > 0) {
		return `${String(hours)}h ${String(minutes % MINUTES_PER_HOUR)}m`;
	}
	return minutes > 0 ? `${String(minutes)}m` : `${String(Math.round(seconds))}s`;
}

/** Percent of a part in a whole, capped at 100 (0 for an empty whole: no swap means none in use). */
export function percentOf(part: number, whole: number): number {
	return whole <= 0 ? 0 : Math.min(HUNDRED, (part / whole) * HUNDRED);
}

/** How full a share is. */
export function usageLevel(percent: number): UsageLevel {
	if (percent >= USAGE_DANGER_PERCENT) {
		return "danger";
	}
	return percent >= USAGE_WARNING_PERCENT ? "warning" : "ok";
}

/** Total and used storage of a machine's disks. */
export interface StorageTotals {
	readonly totalBytes: number;
	readonly usedBytes: number;
}

/**
 * The machine's storage: every distinct disk added up. Volumes that share one container (macOS APFS:
 * `/` and `/System/Volumes/Data`) report the same size, so a size seen before is counted once — the
 * container, at its fullest volume's usage.
 */
export function storageTotals(disks: readonly OpsDisk[]): StorageTotals {
	const bySize = new Map<number, number>();
	for (const disk of disks) {
		bySize.set(disk.totalBytes, Math.max(bySize.get(disk.totalBytes) ?? 0, disk.usedBytes));
	}
	let totalBytes = 0;
	let usedBytes = 0;
	for (const [size, used] of bySize) {
		totalBytes += size;
		usedBytes += used;
	}
	return { totalBytes, usedBytes };
}

/** What a machine's spec line reads from. */
export interface MachineSpecSource {
	readonly cpuModel: string | null;
	readonly cpuCores: number | null;
	readonly memoryTotalBytes: number | null;
	readonly live: Pick<OpsServerLive, "disks"> | null;
}

/** The spec in one line: `Apple M4 Pro · 12 cores · 36 GB RAM · 1000 GB storage`. */
export function machineSpecLine(server: MachineSpecSource): string {
	const parts: string[] = [];
	if (server.cpuModel !== null) {
		parts.push(server.cpuModel);
	}
	if (server.cpuCores !== null) {
		parts.push(`${String(server.cpuCores)} cores`);
	}
	if (server.memoryTotalBytes !== null) {
		parts.push(`${formatBytes(server.memoryTotalBytes)} RAM`);
	}
	if (server.live !== null && server.live.disks.length > 0) {
		parts.push(`${formatBytes(storageTotals(server.live.disks).totalBytes)} storage`);
	}
	return parts.length === 0 ? "Spec arrives with the agent's first report" : parts.join(" · ");
}
