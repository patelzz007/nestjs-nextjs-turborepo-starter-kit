/** Copy and format helpers for the backup panel — owned by the smart layer. */

export const STATUS_FILTER_OPTIONS: readonly { value: string; label: string }[] = [
	{ value: "pending", label: "Queued" },
	{ value: "processing", label: "Processing" },
	{ value: "completed", label: "Completed" },
	{ value: "failed", label: "Failed" },
];

export const KIND_FILTER_OPTIONS: readonly { value: string; label: string }[] = [
	{ value: "false", label: "Full dump" },
	{ value: "true", label: "Schema only" },
];

export const STAGE_LABELS: Readonly<Record<string, string>> = {
	queued: "Waiting for the dump to start…",
	dumping: "Dumping the database…",
	compressing: "Compressing the dump…",
	finalizing: "Verifying checksum…",
	done: "Complete",
	failed: "Failed",
};

/** Friendly copy for machine-readable failure categories. */
export const ERROR_CODE_COPY: Readonly<Record<string, string>> = {
	CANCELLED: "Cancelled by an administrator",
	TIMEOUT: "The dump exceeded its time limit and was killed",
	DISK_FULL: "Not enough free disk space",
	PGDUMP_UNAVAILABLE: "pg_dump could not be started — is PostgreSQL installed?",
	DUMP_SIZE_MISMATCH: "The dump was truncated while writing",
	RESTORE_FAILED: "The restore step failed",
};

/** Warning threshold for large databases (10GB). */
export const LARGE_DB_THRESHOLD_BYTES = 10 * 1024 * 1024 * 1024;

/** 1234567 → "1.2 MB" — compact human size for the table. */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${String(bytes)} B`;
	const units: readonly string[] = ["KB", "MB", "GB", "TB"];
	let value = bytes / 1024;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}
	return `${value.toFixed(1)} ${units[unitIndex] ?? "KB"}`;
}

/** Estimates backup time based on DB size (rough heuristic: ~100MB/min for pg_dump). */
export function estimateBackupTime(dbSizeBytes: number | null): string {
	if (dbSizeBytes === null) return "Unknown";
	const sizeGB = dbSizeBytes / (1024 * 1024 * 1024);
	if (sizeGB < 0.1) return "~1 min";
	if (sizeGB < 1) return `~${String(Math.max(1, Math.round(sizeGB * 10)))} min`;
	if (sizeGB < 10) return `~${String(Math.round(sizeGB * 1.5))} min`;
	if (sizeGB < 50) return `~${String(Math.round(sizeGB * 2))} min`;
	return `~${String(Math.round(sizeGB * 3))} min`;
}

/** Triggers a browser download for a same-origin URL (Content-Disposition drives the filename). */
export function triggerDownload(url: string): void {
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.rel = "noopener";
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
}
