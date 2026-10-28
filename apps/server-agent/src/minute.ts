// ============================================
// minute.ts — the agent's own minute: its samples averaged into one history point
// ============================================
// Pure functions (no I/O): the API stores what the agent rolled up, once a minute.

import { epochMs, type OpsServerLive, type OpsServerPoint } from "@workspace/shared";

const HUNDRED = 100;

function average(values: readonly number[]): number {
	return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageOrNull(values: readonly (number | null)[]): number | null {
	const measured: number[] = values.flatMap((value) => (value === null ? [] : [value]));
	return measured.length === 0 ? null : average(measured);
}

function peakOrNull(values: readonly (number | null)[]): number | null {
	const measured: number[] = values.flatMap((value) => (value === null ? [] : [value]));
	return measured.length === 0 ? null : Math.max(...measured);
}

function percent(part: number, whole: number): number {
	return whole <= 0 ? 0 : Math.min(HUNDRED, (part / whole) * HUNDRED);
}

/** The fullest disk of a sample: used, total and percent. */
function fullestDisk(sample: OpsServerLive): { readonly used: number; readonly total: number; readonly percent: number; readonly inodes: number | null } {
	const [fullest] = [...sample.disks].sort((left, right) => percent(right.usedBytes, right.totalBytes) - percent(left.usedBytes, left.totalBytes));
	return fullest === undefined
		? { used: 0, total: 0, percent: 0, inodes: null }
		: { used: fullest.usedBytes, total: fullest.totalBytes, percent: percent(fullest.usedBytes, fullest.totalBytes), inodes: fullest.inodesPercent };
}

/** One minute's samples (oldest first) as a history point; `null` for no samples. */
export function minutePoint(samples: readonly OpsServerLive[], bucketStart: number): OpsServerPoint | null {
	const [latest] = samples.slice(-1);
	if (latest === undefined) {
		return null;
	}
	const disks = samples.map(fullestDisk);
	const latestDisk = fullestDisk(latest);
	return {
		bucketStart: epochMs(bucketStart),
		cpuPercentAvg: average(samples.map((sample) => sample.cpuPercent)),
		cpuPercentMax: Math.max(...samples.map((sample) => sample.cpuPercent)),
		stealPercentAvg: averageOrNull(samples.map((sample) => sample.stealPercent)),
		iowaitPercentAvg: averageOrNull(samples.map((sample) => sample.iowaitPercent)),
		load1Avg: average(samples.map((sample) => sample.load1)),
		memoryUsedBytes: Math.round(average(samples.map((sample) => sample.memoryUsedBytes))),
		memoryTotalBytes: latest.memoryTotalBytes,
		memoryPercentMax: Math.max(...samples.map((sample) => percent(sample.memoryUsedBytes, sample.memoryTotalBytes))),
		swapUsedBytes: Math.round(average(samples.map((sample) => sample.swapUsedBytes))),
		diskUsedBytes: latestDisk.used,
		diskTotalBytes: latestDisk.total,
		diskPercentMax: Math.max(...disks.map((disk) => disk.percent)),
		inodesPercentMax: peakOrNull(disks.map((disk) => disk.inodes)),
		diskReadBytesPerSec: average(samples.map((sample) => sample.diskReadBytesPerSec)),
		diskWriteBytesPerSec: average(samples.map((sample) => sample.diskWriteBytesPerSec)),
		netRxBytesPerSec: average(samples.map((sample) => sample.netRxBytesPerSec)),
		netTxBytesPerSec: average(samples.map((sample) => sample.netTxBytesPerSec)),
		tcpConnections: Math.round(average(samples.map((sample) => sample.tcpConnections))),
		processCount: Math.round(average(samples.map((sample) => sample.processCount))),
	};
}

/** The start of the minute `at` is in. */
export function minuteOf(at: number): number {
	const minuteMs = 60_000;
	return Math.floor(at / minuteMs) * minuteMs;
}
